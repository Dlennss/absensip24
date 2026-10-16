import copy
from io import BytesIO
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "ktp_tests_not_connected")

from bson import ObjectId
from fastapi import HTTPException, UploadFile
from PIL import Image
from starlette.datastructures import Headers

import server
from ktp_images import normalize_ktp_image


def sample_image():
    output = BytesIO()
    image = Image.new("RGB", (400, 250), "white")
    exif = Image.Exif()
    exif[270] = "private camera metadata"
    image.save(output, format="JPEG", exif=exif)
    return output.getvalue()


def upload(content=None, content_type="image/jpeg"):
    return UploadFile(filename="camera.jpg", file=BytesIO(sample_image() if content is None else content),
                      headers=Headers({"content-type": content_type}))


class KtpImageTests(unittest.TestCase):
    def test_real_image_is_encoded_without_exif(self):
        result = normalize_ktp_image(sample_image())
        with Image.open(BytesIO(result)) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertEqual(image.size, (400, 250))
            self.assertFalse(image.getexif())

    def test_fake_or_unsupported_images_are_rejected(self):
        with self.assertRaises(ValueError):
            normalize_ktp_image(b"not a photo")
        output = BytesIO()
        Image.new("RGB", (5, 5)).save(output, format="GIF")
        with self.assertRaises(ValueError):
            normalize_ktp_image(output.getvalue())

    def test_ktp_routes_require_admin_and_are_not_static(self):
        routes = [route for route in server.app.routes if route.path == "/api/marketing/{marketing_id}/ktp"]
        self.assertEqual(len(routes), 2)
        for route in routes:
            self.assertIn(server.get_current_admin, [d.call for d in route.dependant.dependencies])
        self.assertNotIn(server.UPLOAD_DIR, server.PRIVATE_KTP_DIR.parents)

    def test_private_storage_is_preserved_by_deploy_and_ignored_by_git(self):
        root = Path(__file__).resolve().parent.parent
        self.assertIn('--exclude "uploads-private"', (root / ".github/workflows/deploy.yml").read_text())
        self.assertIn("backend/uploads-private/", (root / ".gitignore").read_text())


class KtpUploadTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.doc = {"_id": ObjectId(), "name": "Test", "name_lower": "test", "profile": {
            "account_number": "000123", "inventory": {"ktp_verified": True}}}

    async def test_upload_and_profile_changes_save_together_without_touching_old_data(self):
        before = copy.deepcopy(self.doc)
        updated = copy.deepcopy(self.doc)
        updated["ktp_photo"] = {"filename": "a" * 32 + ".jpg", "uploaded_at": "now"}
        collection = SimpleNamespace(find_one=AsyncMock(side_effect=[self.doc, updated]),
                                     update_one=AsyncMock(return_value=SimpleNamespace(matched_count=1)))
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            old = directory / ("b" * 32 + ".jpg")
            old.write_bytes(b"old photo preserved")
            with patch.object(server, "PRIVATE_KTP_DIR", directory), patch.object(server, "db", SimpleNamespace(marketing=collection)):
                response = await server.upload_marketing_ktp(str(self.doc["_id"]), upload(), '{"phone":"0812"}', {"email": "admin"})
            self.assertEqual(old.read_bytes(), b"old photo preserved")
            self.assertEqual(len(list(directory.iterdir())), 2)
            mutation = collection.update_one.call_args.args[1]
            self.assertEqual(set(mutation["$set"]), {"profile.phone", "profile_updated_at", "ktp_photo"})
            filename = mutation["$set"]["ktp_photo"]["filename"]
            with Image.open(directory / filename) as image:
                self.assertEqual(image.format, "JPEG")
        self.assertEqual(self.doc, before)
        self.assertEqual(response["profile"]["account_number"], "000123")
        self.assertTrue(response["profile"]["inventory"]["ktp_verified"])
        self.assertNotIn("filename", response["ktp_photo"])
        self.assertNotIn("ktp_photo", server.serialize_marketing(updated))

    async def test_invalid_uploads_never_change_profile(self):
        collection = SimpleNamespace(find_one=AsyncMock(return_value=self.doc), update_one=AsyncMock())
        cases = [(upload(b"bad"), "{}"), (upload(content_type="application/pdf"), "{}"),
                 (upload(b"x" * (server.MAX_PHOTO_SIZE + 1)), "{}"), (upload(), '{"name":"rename"}')]
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(server, "PRIVATE_KTP_DIR", Path(temp)), patch.object(server, "db", SimpleNamespace(marketing=collection)):
                for photo, changes in cases:
                    with self.assertRaises(HTTPException) as error:
                        await server.upload_marketing_ktp(str(self.doc["_id"]), photo, changes, {})
                    self.assertEqual(error.exception.status_code, 400)
                self.assertEqual(list(Path(temp).iterdir()), [])
        collection.update_one.assert_not_awaited()

    async def test_failed_database_write_removes_only_the_new_file(self):
        collection = SimpleNamespace(find_one=AsyncMock(return_value=self.doc), update_one=AsyncMock(side_effect=RuntimeError("DB failure")))
        with tempfile.TemporaryDirectory() as temp:
            old = Path(temp) / ("a" * 32 + ".jpg")
            old.write_bytes(b"old")
            with patch.object(server, "PRIVATE_KTP_DIR", Path(temp)), patch.object(server, "db", SimpleNamespace(marketing=collection)):
                with self.assertRaises(RuntimeError):
                    await server.upload_marketing_ktp(str(self.doc["_id"]), upload(), "{}", {})
            self.assertEqual(list(Path(temp).iterdir()), [old])

    async def test_private_read_is_not_cached_and_rejects_unsafe_paths(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / ("a" * 32 + ".jpg")
            path.write_bytes(sample_image())
            self.doc["ktp_photo"] = {"filename": path.name}
            collection = SimpleNamespace(find_one=AsyncMock(return_value=self.doc))
            with patch.object(server, "PRIVATE_KTP_DIR", Path(temp)), patch.object(server, "db", SimpleNamespace(marketing=collection)):
                response = await server.get_marketing_ktp(str(self.doc["_id"]), {})
                self.assertEqual(response.path, path)
                self.assertIn("no-store", response.headers["cache-control"])
                self.doc["ktp_photo"]["filename"] = "../secret.jpg"
                with self.assertRaises(HTTPException) as error:
                    await server.get_marketing_ktp(str(self.doc["_id"]), {})
                self.assertEqual(error.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
