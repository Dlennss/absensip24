import copy
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "profile_tests_not_connected")

from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError

import server
from marketing_profile import MarketingProfilePatch, profile_update, profile_values


class ProfileValidationTests(unittest.TestCase):
    def test_legacy_record_is_read_without_mutation(self):
        doc = {"_id": ObjectId(), "name": "Lama", "name_lower": "lama"}
        before = copy.deepcopy(doc)
        profile = server.serialize_marketing_profile(doc)
        self.assertEqual(doc, before)
        self.assertTrue(profile["profile"]["is_active"])
        self.assertEqual(profile["profile"]["account_number"], "")
        self.assertEqual(profile["profile"]["inventory"]["uniforms"], 0)

    def test_account_is_text_and_preserves_leading_zeroes(self):
        value = MarketingProfilePatch(account_number=" 000123 456 ")
        self.assertEqual(value.account_number, "000123 456")
        for invalid in (123456, "123abc", "１２３"):
            with self.assertRaises(ValidationError):
                MarketingProfilePatch(account_number=invalid)

    def test_partial_patch_does_not_reset_other_fields(self):
        value = MarketingProfilePatch(inventory={"vest": True})
        self.assertEqual(profile_update(value), {"profile.inventory.vest": True})
        self.assertEqual(profile_update(MarketingProfilePatch(phone="0812")), {"profile.phone": "0812"})

    def test_invalid_dates_quantities_and_unknown_fields_rejected(self):
        for data in ({"joined_on": "2026-02-30"}, {"inventory": {"uniforms": -1}},
                     {"inventory": {"uniforms": 1.5}}, {"inventory": {"vest": "false"}},
                     {"is_active": None}, {"name": "Rename"}):
            with self.assertRaises(ValidationError):
                MarketingProfilePatch(**data)

    def test_public_serializer_has_no_sensitive_fields(self):
        doc = {"_id": ObjectId(), "name": "Marketing", "profile": {
            "phone": "08123", "account_number": "0001", "bank": "BCA"}}
        self.assertEqual(set(server.serialize_marketing(doc)), {"id", "name", "created_at"})

    def test_profile_routes_require_admin(self):
        routes = [route for route in server.app.routes if route.path in (
            "/api/marketing/profiles", "/api/marketing/{marketing_id}/profile")]
        self.assertEqual(len(routes), 2)
        for route in routes:
            self.assertIn(server.get_current_admin, [d.call for d in route.dependant.dependencies])


class ProfileEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_invalid_or_missing_id_never_creates_profile(self):
        collection = SimpleNamespace(find_one=AsyncMock(return_value=None), update_one=AsyncMock())
        with patch.object(server, "db", SimpleNamespace(marketing=collection)):
            for value, status in (("bad-id", 400), (str(ObjectId()), 404)):
                with self.assertRaises(HTTPException) as error:
                    await server.update_marketing_profile(value, MarketingProfilePatch(phone="0812"), {})
                self.assertEqual(error.exception.status_code, status)
        collection.update_one.assert_not_awaited()

    async def test_update_only_writes_profile_and_inventory_history(self):
        oid = ObjectId()
        original = {"_id": oid, "name": "Tetap", "name_lower": "tetap", "created_at": "old",
                    "profile": {"account_number": "000123", "inventory": {"uniforms": 2}}}
        before = copy.deepcopy(original)
        updated = copy.deepcopy(original)
        updated["profile"]["inventory"]["vest"] = True
        collection = SimpleNamespace(find_one=AsyncMock(side_effect=[original, updated]), update_one=AsyncMock())
        with patch.object(server, "db", SimpleNamespace(marketing=collection)):
            result = await server.update_marketing_profile(str(oid), MarketingProfilePatch(inventory={"vest": True}), {"email": "admin"})
        self.assertEqual(original, before)
        mutation = collection.update_one.call_args.args[1]
        self.assertEqual(set(mutation["$set"]), {"profile.inventory.vest", "profile_updated_at"})
        event = mutation["$push"]["inventory_history"]
        self.assertEqual(event["changes"], {"vest": True})
        self.assertEqual(result["profile"]["account_number"], "000123")
        self.assertEqual(result["profile"]["inventory"]["uniforms"], 2)

    async def test_empty_patch_is_read_only(self):
        doc = {"_id": ObjectId(), "name": "Test"}
        collection = SimpleNamespace(find_one=AsyncMock(return_value=doc), update_one=AsyncMock())
        with patch.object(server, "db", SimpleNamespace(marketing=collection)):
            await server.update_marketing_profile(str(doc["_id"]), MarketingProfilePatch(), {})
        collection.update_one.assert_not_awaited()

    async def test_inactive_cannot_submit_but_historical_lookup_remains_available(self):
        doc = {"name": "Test", "name_lower": "test", "profile": {"is_active": False}}
        with patch.object(server, "require_registered_marketing", AsyncMock(return_value=doc)):
            with self.assertRaises(HTTPException) as error:
                await server.submit_attendance(name="Test", photo=None, latitude="0", longitude="0", location_accuracy="10")
            self.assertEqual(error.exception.status_code, 403)
        collection = SimpleNamespace(find_one=AsyncMock(return_value=doc))
        with patch.object(server, "db", SimpleNamespace(marketing=collection)):
            self.assertEqual(await server.require_registered_marketing("Test"), doc)

    async def test_available_filter_hides_inactive_without_writing(self):
        cursor = Mock()
        cursor.sort.return_value = cursor
        cursor.to_list = AsyncMock(return_value=[])
        marketing = SimpleNamespace(find=Mock(return_value=cursor))
        attendance = SimpleNamespace(distinct=AsyncMock(return_value=[]))
        with patch.object(server, "db", SimpleNamespace(marketing=marketing, attendance=attendance)):
            await server.list_available_marketing()
        self.assertEqual(marketing.find.call_args.args[0]["profile.is_active"], {"$ne": False})


if __name__ == "__main__":
    unittest.main()
