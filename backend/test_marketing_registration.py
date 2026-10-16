import copy
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "registration_tests_not_connected")

from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError
from pymongo.errors import DuplicateKeyError

import server
from marketing_profile import MarketingRegistrationProfile
from test_ktp_uploads import upload


def complete_profile():
    return {"phone": "081234567890", "joined_on": "2026-10-16", "bank": "BCA",
            "account_number": "000123456789", "account_holder": "Marketing Baru",
            "inventory": {"uniforms": 0, "vest": False, "id_card": False}}


class RegistrationValidationTests(unittest.TestCase):
    def test_all_identity_and_bank_fields_are_required(self):
        for field in ("phone", "joined_on", "bank", "account_number", "account_holder"):
            for missing in (None, "", "   "):
                profile = complete_profile()
                if missing is None:
                    del profile[field]
                else:
                    profile[field] = missing
                with self.assertRaises(ValidationError):
                    MarketingRegistrationProfile.model_validate(profile)

    def test_inventory_can_be_not_received_but_receipts_require_a_date(self):
        profile = complete_profile()
        MarketingRegistrationProfile.model_validate(profile)
        profile["inventory"]["uniforms"] = 2
        with self.assertRaises(ValidationError):
            MarketingRegistrationProfile.model_validate(profile)
        profile["inventory"]["received_on"] = "2026-10-16"
        MarketingRegistrationProfile.model_validate(profile)
        profile["inventory"]["returned_on"] = "2026-10-15"
        with self.assertRaises(ValidationError):
            MarketingRegistrationProfile.model_validate(profile)

    def test_short_or_invalid_phone_is_rejected(self):
        for phone in ("0812", "abcdefghijk", "++++ 12345"):
            profile = complete_profile()
            profile["phone"] = phone
            with self.assertRaises(ValidationError):
                MarketingRegistrationProfile.model_validate(profile)

    def test_endpoint_requires_photo_and_profile_and_admin(self):
        route = next(route for route in server.app.routes if route.path == "/api/marketing" and "POST" in route.methods)
        fields = route.body_field.type_.model_fields
        self.assertTrue(fields["photo"].is_required())
        self.assertTrue(fields["profile"].is_required())
        self.assertTrue(fields["name"].is_required())
        self.assertIn(server.get_current_admin, [dependency.call for dependency in route.dependant.dependencies])


class RegistrationTests(unittest.IsolatedAsyncioTestCase):
    def collection(self, existing=None, error=None):
        return SimpleNamespace(find_one=AsyncMock(return_value=existing), insert_one=AsyncMock(
            return_value=SimpleNamespace(inserted_id=ObjectId()), side_effect=error))

    async def test_complete_registration_inserts_everything_once(self):
        collection = self.collection()
        profile = complete_profile()
        profile["inventory"] = {"uniforms": 2, "vest": True, "received_on": "2026-10-16"}
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(server, "PRIVATE_KTP_DIR", Path(temp)), patch.object(server, "db", SimpleNamespace(marketing=collection)):
                response = await server.create_marketing(" Marketing Baru ", json.dumps(profile), upload(), {"email": "admin"})
            self.assertEqual(len(list(Path(temp).iterdir())), 1)
            doc = collection.insert_one.call_args.args[0]
            self.assertEqual(doc["name"], "Marketing Baru")
            self.assertEqual(doc["profile"]["account_number"], "000123456789")
            self.assertEqual(doc["inventory_history"][0]["changes"]["uniforms"], 2)
            self.assertTrue((Path(temp) / doc["ktp_photo"]["filename"]).is_file())
            self.assertNotIn("filename", response["ktp_photo"])
        collection.insert_one.assert_awaited_once()

    async def test_incomplete_profile_or_bad_image_never_inserts_a_name(self):
        collection = self.collection()
        cases = [("{}", upload()), (json.dumps(complete_profile()), upload(b"bad image"))]
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(server, "PRIVATE_KTP_DIR", Path(temp)), patch.object(server, "db", SimpleNamespace(marketing=collection)):
                for profile, photo in cases:
                    with self.assertRaises(HTTPException) as error:
                        await server.create_marketing("Test", profile, photo, {})
                    self.assertEqual(error.exception.status_code, 400)
                self.assertEqual(list(Path(temp).iterdir()), [])
        collection.insert_one.assert_not_awaited()

    async def test_duplicate_does_not_modify_existing_marketing_or_store_photo(self):
        existing = {"_id": ObjectId(), "name": "Marketing Baru", "profile": {"account_number": "old"}}
        before = copy.deepcopy(existing)
        collection = self.collection(existing=existing)
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(server, "PRIVATE_KTP_DIR", Path(temp)), patch.object(server, "db", SimpleNamespace(marketing=collection)):
                with self.assertRaises(HTTPException) as error:
                    await server.create_marketing("Marketing Baru", json.dumps(complete_profile()), upload(), {})
                self.assertEqual(error.exception.status_code, 409)
                self.assertEqual(list(Path(temp).iterdir()), [])
        self.assertEqual(existing, before)
        collection.insert_one.assert_not_awaited()

    async def test_duplicate_race_or_database_failure_cleans_only_new_photo(self):
        for failure in (DuplicateKeyError("duplicate"), RuntimeError("unavailable")):
            collection = self.collection(error=failure)
            with tempfile.TemporaryDirectory() as temp:
                original = Path(temp) / "existing.jpg"
                original.write_bytes(b"old data")
                with patch.object(server, "PRIVATE_KTP_DIR", Path(temp)), patch.object(server, "db", SimpleNamespace(marketing=collection)):
                    with self.assertRaises((HTTPException, RuntimeError)):
                        await server.create_marketing("Test", json.dumps(complete_profile()), upload(), {})
                self.assertEqual(list(Path(temp).iterdir()), [original])
                self.assertEqual(original.read_bytes(), b"old data")


if __name__ == "__main__":
    unittest.main()
