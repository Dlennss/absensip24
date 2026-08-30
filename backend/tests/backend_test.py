"""Backend API tests for Absensi Karyawan app."""
import io
import os
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
import requests

from conftest import BASE_URL, make_png

JAKARTA = ZoneInfo("Asia/Jakarta")
TODAY = datetime.now(JAKARTA).date().isoformat()
THIS_MONTH = TODAY[:7]


def uniq(prefix="TEST_"):
    return f"{prefix}{uuid.uuid4().hex[:8]}"


# ---------------- Health ----------------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert "message" in r.json()


# ---------------- Auth ----------------
class TestAuth:
    def test_login_success(self, api_client, test_credentials):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_credentials["email"], "password": test_credentials["password"]},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("access_token"), str) and len(data["access_token"]) > 20
        assert data["email"] == test_credentials["email"].lower()
        assert "password_hash" not in data

    def test_login_wrong_password(self, api_client, test_credentials):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_credentials["email"], "password": "definitely-wrong"},
        )
        assert r.status_code == 401
        assert "salah" in r.json()["detail"].lower()
        # restore counter so admin is not locked out for subsequent tests
        ok = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_credentials["email"], "password": test_credentials["password"]},
        )
        assert ok.status_code == 200

    def test_login_missing_fields(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": "a@b.com"})
        assert r.status_code == 422

    def test_me_with_token(self, api_client, admin_headers, test_credentials):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == test_credentials["email"].lower()
        assert data["role"] == "admin"
        assert "password_hash" not in data

    def test_me_without_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
        assert r.status_code == 401

    def test_brute_force_lockout(self, api_client):
        """After 5 failed attempts the API must answer 429 (never 500)."""
        fake_email = f"{uniq('test_bf_')}@example.com"
        statuses = []
        for _ in range(20):
            r = api_client.post(
                f"{BASE_URL}/api/auth/login", json={"email": fake_email, "password": "x"}
            )
            statuses.append(r.status_code)
            if r.status_code != 401:
                break
        assert 500 not in statuses, f"login raised 500 during lockout: {statuses}"
        assert 429 in statuses, f"lockout never triggered: {statuses}"
        assert statuses.count(401) <= 5, f"more than 5 failed attempts allowed: {statuses}"


# ---------------- Public attendance submit ----------------
class TestPublicSubmit:
    def test_submit_and_persist(self, api_client, photo_bytes, admin_headers, created_ids):
        name = uniq("TEST_Karyawan_")
        r = api_client.post(
            f"{BASE_URL}/api/attendance",
            data={"name": name},
            files={"photo": ("p.png", io.BytesIO(photo_bytes), "image/png")},
        )
        assert r.status_code == 201, r.text
        data = r.json()
        created_ids.append(data["id"])
        assert data["name"] == name
        assert data["date"] == TODAY
        assert data["day_name"] in ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
        assert data["photo_url"].startswith("/api/uploads/")
        assert "_id" not in data

        # verify persisted via admin listing
        lst = api_client.get(f"{BASE_URL}/api/attendance", headers=admin_headers, params={"month": THIS_MONTH})
        assert lst.status_code == 200
        match = [x for x in lst.json() if x["id"] == data["id"]]
        assert len(match) == 1
        assert match[0]["name"] == name
        assert match[0]["date"] == TODAY

        # uploaded photo is publicly retrievable
        photo = requests.get(f"{BASE_URL}{data['photo_url']}")
        assert photo.status_code == 200
        assert photo.headers.get("content-type", "").startswith("image/")

    def test_duplicate_same_day_returns_409(self, api_client, photo_bytes, created_ids):
        name = uniq("TEST_Dup_")
        payload = {"name": name}
        first = api_client.post(
            f"{BASE_URL}/api/attendance",
            data=payload,
            files={"photo": ("p.png", io.BytesIO(photo_bytes), "image/png")},
        )
        assert first.status_code == 201, first.text
        created_ids.append(first.json()["id"])
        second = api_client.post(
            f"{BASE_URL}/api/attendance",
            data=payload,
            files={"photo": ("p.png", io.BytesIO(photo_bytes), "image/png")},
        )
        assert second.status_code == 409, second.text
        assert second.json()["detail"] == "Anda sudah melakukan absensi hari ini"

    def test_duplicate_case_insensitive(self, api_client, photo_bytes, created_ids):
        name = uniq("TEST_Case_")
        first = api_client.post(
            f"{BASE_URL}/api/attendance",
            data={"name": name},
            files={"photo": ("p.png", io.BytesIO(photo_bytes), "image/png")},
        )
        assert first.status_code == 201
        created_ids.append(first.json()["id"])
        second = api_client.post(
            f"{BASE_URL}/api/attendance",
            data={"name": name.upper()},
            files={"photo": ("p.png", io.BytesIO(photo_bytes), "image/png")},
        )
        assert second.status_code == 409, second.text

    def test_submit_without_photo(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/attendance", data={"name": uniq("TEST_NoPhoto_")})
        assert r.status_code == 422

    def test_submit_empty_name(self, api_client, photo_bytes):
        r = api_client.post(
            f"{BASE_URL}/api/attendance",
            data={"name": "   "},
            files={"photo": ("p.png", io.BytesIO(photo_bytes), "image/png")},
        )
        assert r.status_code == 400
        assert "Nama" in r.json()["detail"]

    def test_submit_non_image(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/attendance",
            data={"name": uniq("TEST_Txt_")},
            files={"photo": ("doc.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert r.status_code == 400
        assert "gambar" in r.json()["detail"].lower()

    def test_submit_photo_over_5mb(self, api_client):
        big = make_png(padding=6 * 1024 * 1024)
        assert len(big) > 5 * 1024 * 1024
        r = api_client.post(
            f"{BASE_URL}/api/attendance",
            data={"name": uniq("TEST_Big_")},
            files={"photo": ("big.png", io.BytesIO(big), "image/png")},
        )
        assert r.status_code == 400, r.text
        assert "5MB" in r.json()["detail"]


# ---------------- Admin authorization ----------------
class TestAdminAuthorization:
    @pytest.mark.parametrize(
        "method,path",
        [
            ("get", "/api/attendance"),
            ("get", "/api/recap"),
            ("post", "/api/attendance/manual"),
            ("put", "/api/rates"),
            ("put", "/api/attendance/000000000000000000000000"),
            ("delete", "/api/attendance/000000000000000000000000"),
        ],
    )
    def test_requires_token(self, api_client, method, path):
        r = getattr(api_client, method)(f"{BASE_URL}{path}")
        assert r.status_code == 401, f"{method.upper()} {path} -> {r.status_code}"


# ---------------- Admin CRUD ----------------
class TestAdminCrud:
    def test_manual_add_and_persist(self, api_client, admin_headers, photo_bytes, created_ids):
        name = uniq("TEST_Manual_")
        date = f"{THIS_MONTH}-05"
        r = api_client.post(
            f"{BASE_URL}/api/attendance/manual",
            headers=admin_headers,
            data={"name": name, "date": date},
            files={"photo": ("p.png", io.BytesIO(photo_bytes), "image/png")},
        )
        assert r.status_code == 201, r.text
        data = r.json()
        created_ids.append(data["id"])
        assert data["name"] == name
        assert data["date"] == date
        assert data["photo_url"]

        got = api_client.get(f"{BASE_URL}/api/attendance", headers=admin_headers, params={"month": THIS_MONTH})
        assert any(x["id"] == data["id"] and x["date"] == date for x in got.json())

    def test_manual_add_without_photo(self, api_client, admin_headers, created_ids):
        name = uniq("TEST_NoPhotoManual_")
        r = api_client.post(
            f"{BASE_URL}/api/attendance/manual",
            headers=admin_headers,
            data={"name": name, "date": f"{THIS_MONTH}-06"},
        )
        assert r.status_code == 201, r.text
        created_ids.append(r.json()["id"])
        assert r.json()["photo_url"] is None

    def test_manual_add_invalid_date(self, api_client, admin_headers):
        r = api_client.post(
            f"{BASE_URL}/api/attendance/manual",
            headers=admin_headers,
            data={"name": uniq("TEST_BadDate_"), "date": "31-12-2026"},
        )
        assert r.status_code == 400
        assert "tanggal" in r.json()["detail"].lower()

    def test_manual_add_duplicate(self, api_client, admin_headers, created_ids):
        name = uniq("TEST_ManualDup_")
        date = f"{THIS_MONTH}-07"
        first = api_client.post(
            f"{BASE_URL}/api/attendance/manual", headers=admin_headers, data={"name": name, "date": date}
        )
        assert first.status_code == 201
        created_ids.append(first.json()["id"])
        second = api_client.post(
            f"{BASE_URL}/api/attendance/manual", headers=admin_headers, data={"name": name, "date": date}
        )
        assert second.status_code == 409, second.text

    def test_update_and_persist(self, api_client, admin_headers, photo_bytes, created_ids):
        name = uniq("TEST_Upd_")
        create = api_client.post(
            f"{BASE_URL}/api/attendance/manual",
            headers=admin_headers,
            data={"name": name, "date": f"{THIS_MONTH}-08"},
        )
        assert create.status_code == 201
        aid = create.json()["id"]
        created_ids.append(aid)

        new_name = name + "_edited"
        new_date = f"{THIS_MONTH}-09"
        upd = api_client.put(
            f"{BASE_URL}/api/attendance/{aid}",
            headers=admin_headers,
            data={"name": new_name, "date": new_date},
            files={"photo": ("p2.png", io.BytesIO(photo_bytes), "image/png")},
        )
        assert upd.status_code == 200, upd.text
        body = upd.json()
        assert body["name"] == new_name
        assert body["date"] == new_date
        assert body["photo_url"]

        got = api_client.get(f"{BASE_URL}/api/attendance", headers=admin_headers, params={"month": THIS_MONTH})
        row = [x for x in got.json() if x["id"] == aid]
        assert len(row) == 1
        assert row[0]["name"] == new_name
        assert row[0]["date"] == new_date
        assert row[0]["photo_url"] == body["photo_url"]

    def test_update_invalid_id(self, api_client, admin_headers):
        r = api_client.put(
            f"{BASE_URL}/api/attendance/not-an-oid", headers=admin_headers, data={"name": "X"}
        )
        assert r.status_code == 400

    def test_update_not_found(self, api_client, admin_headers):
        r = api_client.put(
            f"{BASE_URL}/api/attendance/000000000000000000000000",
            headers=admin_headers,
            data={"name": "X"},
        )
        assert r.status_code == 404

    def test_delete_and_verify_removal(self, api_client, admin_headers):
        name = uniq("TEST_Del_")
        create = api_client.post(
            f"{BASE_URL}/api/attendance/manual",
            headers=admin_headers,
            data={"name": name, "date": f"{THIS_MONTH}-10"},
        )
        assert create.status_code == 201
        aid = create.json()["id"]

        d = api_client.delete(f"{BASE_URL}/api/attendance/{aid}", headers=admin_headers)
        assert d.status_code == 200, d.text

        got = api_client.get(f"{BASE_URL}/api/attendance", headers=admin_headers, params={"month": THIS_MONTH})
        assert all(x["id"] != aid for x in got.json())

        again = api_client.delete(f"{BASE_URL}/api/attendance/{aid}", headers=admin_headers)
        assert again.status_code == 404

    def test_month_filter(self, api_client, admin_headers, created_ids):
        name = uniq("TEST_OldMonth_")
        create = api_client.post(
            f"{BASE_URL}/api/attendance/manual",
            headers=admin_headers,
            data={"name": name, "date": "2020-01-15"},
        )
        assert create.status_code == 201
        aid = create.json()["id"]
        created_ids.append(aid)

        jan = api_client.get(f"{BASE_URL}/api/attendance", headers=admin_headers, params={"month": "2020-01"})
        assert jan.status_code == 200
        assert any(x["id"] == aid for x in jan.json())

        cur = api_client.get(f"{BASE_URL}/api/attendance", headers=admin_headers, params={"month": THIS_MONTH})
        assert all(x["id"] != aid for x in cur.json())


# ---------------- Recap + rates ----------------
class TestRecapAndRates:
    def test_recap_days_and_salary(self, api_client, admin_headers, created_ids):
        name = uniq("TEST_Recap_")
        for day in ["11", "12", "13"]:
            r = api_client.post(
                f"{BASE_URL}/api/attendance/manual",
                headers=admin_headers,
                data={"name": name, "date": f"{THIS_MONTH}-{day}"},
            )
            assert r.status_code == 201, r.text
            created_ids.append(r.json()["id"])

        recap = api_client.get(f"{BASE_URL}/api/recap", headers=admin_headers, params={"month": THIS_MONTH})
        assert recap.status_code == 200
        row = next(x for x in recap.json() if x["name"] == name)
        assert row["total_days"] == 3
        assert row["daily_rate"] == 0
        assert row["total_salary"] == 0

        rate = api_client.put(
            f"{BASE_URL}/api/rates", headers=admin_headers, json={"name": name, "daily_rate": 125000}
        )
        assert rate.status_code == 200, rate.text

        recap2 = api_client.get(f"{BASE_URL}/api/recap", headers=admin_headers, params={"month": THIS_MONTH})
        row2 = next(x for x in recap2.json() if x["name"] == name)
        assert row2["daily_rate"] == 125000
        assert row2["total_salary"] == 3 * 125000

        # recap sorted alphabetically
        names = [x["name"].lower() for x in recap2.json()]
        assert names == sorted(names)

    def test_rate_empty_name_rejected(self, api_client, admin_headers):
        r = api_client.put(f"{BASE_URL}/api/rates", headers=admin_headers, json={"name": "  ", "daily_rate": 1})
        assert r.status_code == 400

    def test_rate_invalid_payload(self, api_client, admin_headers):
        r = api_client.put(
            f"{BASE_URL}/api/rates", headers=admin_headers, json={"name": "X", "daily_rate": "abc"}
        )
        assert r.status_code == 422


# ---------------- Regression tests (iteration_2 fixes) ----------------
class TestRegressionFixes:
    def test_negative_daily_rate_rejected(self, api_client, admin_headers):
        r = api_client.put(
            f"{BASE_URL}/api/rates", headers=admin_headers, json={"name": uniq("TEST_Neg_"), "daily_rate": -5000}
        )
        assert r.status_code in (400, 422), r.text

    def test_zero_daily_rate_allowed(self, api_client, admin_headers):
        r = api_client.put(
            f"{BASE_URL}/api/rates", headers=admin_headers, json={"name": uniq("TEST_Zero_"), "daily_rate": 0}
        )
        assert r.status_code == 200, r.text

    @pytest.mark.parametrize("bad_month", ["abc", ".*", "2026-1", "2026/01", "^2026", "2026-13-01"])
    def test_invalid_month_param_attendance(self, api_client, admin_headers, bad_month):
        r = api_client.get(f"{BASE_URL}/api/attendance", headers=admin_headers, params={"month": bad_month})
        assert r.status_code == 400, f"month={bad_month} -> {r.status_code} {r.text[:200]}"

    @pytest.mark.parametrize("bad_month", ["abc", ".*", "2026-1"])
    def test_invalid_month_param_recap(self, api_client, admin_headers, bad_month):
        r = api_client.get(f"{BASE_URL}/api/recap", headers=admin_headers, params={"month": bad_month})
        assert r.status_code == 400, f"month={bad_month} -> {r.status_code} {r.text[:200]}"

    def test_valid_month_still_works(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/attendance", headers=admin_headers, params={"month": THIS_MONTH})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_manual_future_date_rejected(self, api_client, admin_headers):
        r = api_client.post(
            f"{BASE_URL}/api/attendance/manual",
            headers=admin_headers,
            data={"name": uniq("TEST_Future_"), "date": "2099-12-31"},
        )
        assert r.status_code == 400, r.text
        assert "masa depan" in r.json()["detail"].lower()

    def test_update_future_date_rejected(self, api_client, admin_headers, created_ids):
        name = uniq("TEST_FutureUpd_")
        create = api_client.post(
            f"{BASE_URL}/api/attendance/manual",
            headers=admin_headers,
            data={"name": name, "date": f"{THIS_MONTH}-01"},
        )
        assert create.status_code == 201, create.text
        aid = create.json()["id"]
        created_ids.append(aid)
        r = api_client.put(
            f"{BASE_URL}/api/attendance/{aid}",
            headers=admin_headers,
            data={"name": name, "date": "2099-01-01"},
        )
        assert r.status_code == 400, r.text

    def test_today_date_still_accepted(self, api_client, admin_headers, created_ids):
        r = api_client.post(
            f"{BASE_URL}/api/attendance/manual",
            headers=admin_headers,
            data={"name": uniq("TEST_TodayOK_"), "date": TODAY},
        )
        assert r.status_code == 201, r.text
        created_ids.append(r.json()["id"])

    def test_lockout_returns_429_and_recovers(self, api_client, test_credentials):
        """5 wrong passwords -> 429 (never 500); after clearing login_attempts login works."""
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import dotenv_values

        env = dotenv_values("/app/backend/.env")
        mongo_url = os.environ.get("MONGO_URL") or env.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME") or env.get("DB_NAME")

        def clear_attempts():
            async def _c():
                cl = AsyncIOMotorClient(mongo_url)
                try:
                    await cl[db_name].login_attempts.delete_many({})
                finally:
                    cl.close()

            asyncio.run(_c())

        clear_attempts()
        email = test_credentials["email"]
        statuses = []
        try:
            for _ in range(8):
                r = api_client.post(
                    f"{BASE_URL}/api/auth/login", json={"email": email, "password": "definitely-wrong"}
                )
                statuses.append(r.status_code)
                if r.status_code == 429:
                    break
            assert 500 not in statuses, f"login returned 500 during lockout: {statuses}"
            assert 429 in statuses, f"lockout never triggered: {statuses}"
            assert statuses.count(401) <= 5, f"more than 5 attempts allowed: {statuses}"
        finally:
            clear_attempts()

        ok = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": test_credentials["password"]},
        )
        assert ok.status_code == 200, f"login broken after lockout cleanup: {ok.status_code} {ok.text[:200]}"
        assert ok.json().get("access_token")


# ---------------- Security / infra ----------------
class TestSecurityConfig:
    def test_bcrypt_hash_format(self):
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import dotenv_values

        env = dotenv_values("/app/backend/.env")
        mongo_url = os.environ.get("MONGO_URL") or env.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME") or env.get("DB_NAME")
        assert mongo_url and db_name

        async def check():
            cl = AsyncIOMotorClient(mongo_url)
            try:
                user = await cl[db_name].users.find_one({"role": "admin"})
                assert user is not None, "No admin user seeded"
                assert user["password_hash"].startswith("$2b$"), user["password_hash"][:8]
                idx = await cl[db_name].users.index_information()
                assert any(i.get("unique") and ("email", 1) in i["key"] for i in idx.values())
            finally:
                cl.close()

        asyncio.run(check())

    def test_cors_headers_present(self, api_client):
        r = api_client.options(
            f"{BASE_URL}/api/auth/login",
            headers={
                "Origin": BASE_URL,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert r.status_code in (200, 204), r.status_code
        assert r.headers.get("access-control-allow-origin") is not None
