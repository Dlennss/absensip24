import os
import re
import io
import struct
import zlib
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing from the process environment and /app/frontend/.env")
BASE_URL = base_url.rstrip("/")


def make_png(width=8, height=8, padding=0) -> bytes:
    """Generate a minimal valid PNG. `padding` adds bytes via a tEXt chunk to inflate size."""

    def chunk(ctype: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + ctype
            + data
            + struct.pack(">I", zlib.crc32(ctype + data) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\x00" + b"\xff\x00\x00" * width for _ in range(height))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw))
    if padding:
        png += chunk(b"tEXt", b"pad\x00" + b"A" * padding)
    png += chunk(b"IEND", b"")
    return png


@pytest.fixture(scope="session")
def photo_bytes():
    return make_png()


@pytest.fixture
def photo_file(photo_bytes):
    return ("photo", ("TEST_photo.png", io.BytesIO(photo_bytes), "image/png"))


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    return session


@pytest.fixture(scope="session")
def test_credentials():
    credentials_path = Path("/app/memory/test_credentials.md")
    if not credentials_path.exists():
        pytest.skip("Missing /app/memory/test_credentials.md; report under test_credentials")
    content = credentials_path.read_text(encoding="utf-8")
    email_match = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    password_match = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    if not email_match or not password_match:
        pytest.skip("No email/password found in test_credentials.md; report under test_credentials")
    return {"email": email_match.group(1), "password": password_match.group(1)}


@pytest.fixture(scope="session")
def auth_token(api_client, test_credentials):
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": test_credentials["email"], "password": test_credentials["password"]},
    )
    if response.status_code != 200:
        pytest.fail(f"Authentication failed with status {response.status_code}: {response.text[:500]}")
    token = response.json().get("access_token")
    if not token:
        pytest.fail("Authentication response did not include access_token")
    return token


@pytest.fixture(scope="session")
def admin_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="session")
def created_ids():
    return []


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data(api_client, created_ids, admin_headers):
    yield
    for aid in created_ids:
        api_client.delete(f"{BASE_URL}/api/attendance/{aid}", headers=admin_headers)
