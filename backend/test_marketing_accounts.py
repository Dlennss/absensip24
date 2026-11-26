import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "marketing_account_tests_not_connected")

from bson import ObjectId
from fastapi import HTTPException
from starlette.requests import Request

import server


class MarketingAccountTests(unittest.IsolatedAsyncioTestCase):
    async def test_new_account_is_linked_by_id_and_only_hash_is_stored(self):
        marketing_id = ObjectId()
        marketing = {"_id": marketing_id, "name": "Sari", "name_lower": "sari"}
        accounts = SimpleNamespace(find_one=AsyncMock(return_value=None), insert_one=AsyncMock(return_value=SimpleNamespace(inserted_id=ObjectId())))
        database = SimpleNamespace(marketing=SimpleNamespace(find_one=AsyncMock(return_value=marketing)), marketing_accounts=accounts)
        with patch.object(server, "db", database):
            result = await server.create_marketing_account(str(marketing_id), server.MarketingAccountInput(username="sari-01", password="rahasia-panjang"), {})
        stored = accounts.insert_one.call_args.args[0]
        self.assertEqual(stored["marketing_id"], str(marketing_id))
        self.assertTrue(server.verify_password("rahasia-panjang", stored["password_hash"]))
        self.assertNotIn("password_hash", result)
        self.assertNotIn("password", result)
        self.assertEqual(result["username"], "sari-01")

    async def test_existing_account_is_not_overwritten(self):
        marketing_id = ObjectId()
        accounts = SimpleNamespace(find_one=AsyncMock(return_value={"username": "existing"}), insert_one=AsyncMock())
        database = SimpleNamespace(marketing=SimpleNamespace(find_one=AsyncMock(return_value={"_id": marketing_id})), marketing_accounts=accounts)
        with patch.object(server, "db", database):
            with self.assertRaises(HTTPException) as error:
                await server.create_marketing_account(str(marketing_id), server.MarketingAccountInput(username="another", password="rahasia-panjang"), {})
        self.assertEqual(error.exception.status_code, 409)
        accounts.insert_one.assert_not_awaited()

    async def test_personal_performance_query_is_scoped_to_token_identity_and_legacy_name(self):
        marketing_id = ObjectId()
        marketing = {"_id": marketing_id, "name": "Sari", "name_lower": "sari"}
        cursor = Mock()
        cursor.sort.return_value = cursor
        cursor.to_list = AsyncMock(return_value=[])
        attendance = SimpleNamespace(find=Mock(return_value=cursor))
        with patch.object(server, "db", SimpleNamespace(attendance=attendance)):
            result = await server.marketing_performance("2026-10", {"marketing": marketing})
        query = attendance.find.call_args.args[0]
        self.assertEqual(query["$or"][0], {"marketing_id": str(marketing_id)})
        self.assertEqual(query["$or"][1], {"marketing_id": {"$exists": False}, "name_lower": "sari"})
        self.assertEqual(query["date"], {"$regex": "^2026-10-"})
        self.assertEqual(result["attendance_days"], 0)

    async def test_personal_response_contains_no_location_or_profile_data(self):
        marketing = {"_id": ObjectId(), "name": "Sari", "name_lower": "sari", "profile": {"address": "private"}}
        cursor = Mock()
        cursor.sort.return_value = cursor
        cursor.to_list = AsyncMock(return_value=[{"date": "2026-10-01", "day_name": "Kamis", "photo_url": "/photo.jpg", "location": {"latitude": 1}}])
        with patch.object(server, "db", SimpleNamespace(attendance=SimpleNamespace(find=Mock(return_value=cursor)))):
            result = await server.marketing_performance("2026-10", {"marketing": marketing})
        self.assertEqual(result["attendance"][0], {"date": "2026-10-01", "day_name": "Kamis", "photo_url": "/photo.jpg"})
        self.assertNotIn("address", result)

    def test_marketing_private_routes_require_marketing_auth(self):
        paths = {"/api/marketing/auth/me", "/api/marketing/me/performance"}
        routes = [route for route in server.app.routes if route.path in paths]
        self.assertEqual({route.path for route in routes}, paths)
        for route in routes:
            self.assertIn(server.get_current_marketing, [dep.call for dep in route.dependant.dependencies])

    async def test_password_reset_invalidates_existing_token(self):
        account_id = ObjectId()
        token = server.jwt.encode(
            {"sub": str(account_id), "type": "marketing_access", "auth_version": 0},
            "test-secret-with-at-least-32-bytes", algorithm=server.JWT_ALGORITHM,
        )
        request = Request({"type": "http", "headers": [(b"authorization", f"Bearer {token}".encode())]})
        accounts = SimpleNamespace(find_one=AsyncMock(return_value={"_id": account_id, "marketing_id": str(ObjectId()), "is_active": True, "auth_version": 1}))
        with patch.object(server, "get_jwt_secret", return_value="test-secret-with-at-least-32-bytes"), patch.object(server, "db", SimpleNamespace(marketing_accounts=accounts)):
            with self.assertRaises(HTTPException) as error:
                await server.get_current_marketing(request)
        self.assertEqual(error.exception.status_code, 401)

    def test_account_management_routes_require_admin(self):
        paths = {
            "/api/marketing/{marketing_id}/account",
            "/api/marketing/{marketing_id}/account/password",
        }
        routes = [route for route in server.app.routes if route.path in paths]
        self.assertEqual({route.path for route in routes}, paths)
        for route in routes:
            self.assertIn(server.get_current_admin, [dep.call for dep in route.dependant.dependencies])


if __name__ == "__main__":
    unittest.main()
