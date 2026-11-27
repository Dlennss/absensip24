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
    @staticmethod
    def cursor_with(documents):
        cursor = Mock()
        cursor.sort.return_value = cursor
        cursor.to_list = AsyncMock(return_value=documents)
        return cursor

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
        attendance_id = ObjectId()
        cursor.to_list = AsyncMock(return_value=[{"_id": attendance_id, "date": "2026-10-01", "day_name": "Kamis", "photo_url": "/photo.jpg", "location": {"latitude": 1}}])
        with patch.object(server, "db", SimpleNamespace(attendance=SimpleNamespace(find=Mock(return_value=cursor)))):
            result = await server.marketing_performance("2026-10", {"marketing": marketing})
        self.assertEqual(result["attendance"][0], {"id": str(attendance_id), "date": "2026-10-01", "day_name": "Kamis", "photo_url": "/photo.jpg"})
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

    async def test_personal_salary_uses_shared_payroll_calculation(self):
        marketing = {"_id": ObjectId(), "name": "Sari", "name_lower": "sari", "profile": {"ptkp_by_year": {"2026": "TK/0"}}}
        attendance = self.cursor_with([{}, {}])
        adjustments = self.cursor_with([
            {"amount": 6000, "note": "Bonus"},
            {"amount": -10000, "kind": "cash_advance", "note": "Kasbon"},
            {"amount": -2000, "kind": "other", "note": "Potongan"},
            {"amount": 0, "kind": "absence_note", "note": "Izin"},
        ])
        database = SimpleNamespace(
            attendance=SimpleNamespace(find=Mock(return_value=attendance)),
            salary_adjustments=SimpleNamespace(find=Mock(return_value=adjustments)),
            salary_slips=SimpleNamespace(find_one=AsyncMock(return_value=None)),
        )
        with patch.object(server, "db", database), patch.object(server, "monthly_ter", return_value=(0, 3000)):
            slip = await server.build_salary_slip(marketing, "2026-11")
        self.assertEqual(slip["attendance_days"], 2)
        self.assertEqual(slip["gross_pay"], 313692)
        self.assertEqual(slip["total_deductions"], 15000)
        self.assertEqual(slip["net_pay"], 298692)
        self.assertEqual(slip["absence_notes"], ["Izin"])

    def test_salary_and_correction_personal_routes_require_marketing_auth(self):
        paths = {
            "/api/marketing/me/salary-slip",
            "/api/marketing/me/correction-requests",
            "/api/marketing/me/password",
        }
        routes = [route for route in server.app.routes if route.path in paths]
        self.assertEqual({route.path for route in routes}, paths)
        for route in routes:
            self.assertIn(server.get_current_marketing, [dep.call for dep in route.dependant.dependencies])

    def test_review_queue_routes_require_admin(self):
        routes = [route for route in server.app.routes if route.path in (
            "/api/attendance-correction-requests",
            "/api/attendance-correction-requests/{request_id}",
        )]
        self.assertEqual(len(routes), 2)
        for route in routes:
            self.assertIn(server.get_current_admin, [dep.call for dep in route.dependant.dependencies])

    async def test_correction_request_only_references_owned_attendance(self):
        marketing_id, attendance_id = ObjectId(), ObjectId()
        marketing = {"_id": marketing_id, "name": "Sari", "name_lower": "sari"}
        attendance = SimpleNamespace(find_one=AsyncMock(return_value=None))
        requests = SimpleNamespace(find_one=AsyncMock(), insert_one=AsyncMock())
        database = SimpleNamespace(attendance=attendance, attendance_correction_requests=requests)
        with patch.object(server, "db", database):
            with self.assertRaises(HTTPException) as error:
                await server.create_attendance_correction(
                    server.AttendanceCorrectionInput(attendance_id=str(attendance_id), reason="Tanggal foto salah"),
                    {"marketing": marketing},
                )
        self.assertEqual(error.exception.status_code, 404)
        requests.insert_one.assert_not_awaited()

    async def test_approved_date_correction_updates_day_and_keeps_photo(self):
        request_id, marketing_id, attendance_id = ObjectId(), ObjectId(), ObjectId()
        correction = {
            "_id": request_id, "marketing_id": str(marketing_id), "marketing_name": "Sari",
            "attendance_id": str(attendance_id), "original_date": "2026-11-02",
            "corrected_date": "2026-11-03", "reason": "Tanggal absensi perlu dibetulkan", "status": "pending", "created_at": "then",
        }
        marketing = {"_id": marketing_id, "name": "Sari", "name_lower": "sari"}
        attendance_record = {"_id": attendance_id, "name_lower": "sari", "marketing_id": str(marketing_id), "date": "2026-11-02", "photo_url": "/photo.jpg"}
        updated_attendance = AsyncMock(return_value=SimpleNamespace(matched_count=1))
        attendance = SimpleNamespace(find_one=AsyncMock(side_effect=[attendance_record, None]), update_one=updated_attendance)
        final_correction = {**correction, "status": "approved", "reviewed_at": "now", "reviewed_by": "admin", "review_note": "ok"}
        requests = SimpleNamespace(
            find_one=AsyncMock(side_effect=[correction, final_correction]),
            update_one=AsyncMock(return_value=SimpleNamespace(matched_count=1)),
        )
        database = SimpleNamespace(attendance=attendance, attendance_correction_requests=requests, marketing=SimpleNamespace(find_one=AsyncMock(return_value=marketing)))
        with patch.object(server, "db", database):
            result = await server.review_attendance_correction(
                str(request_id), server.AttendanceCorrectionReviewInput(decision="approve", review_note="ok"), {"email": "admin"}
            )
        attendance_update = updated_attendance.call_args.args[1]["$set"]
        self.assertEqual(attendance_update["date"], "2026-11-03")
        self.assertEqual(attendance_update["day_name"], "Selasa")
        self.assertNotIn("photo_url", attendance_update)
        self.assertEqual(result["status"], "approved")


if __name__ == "__main__":
    unittest.main()
