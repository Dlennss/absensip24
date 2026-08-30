from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional
from pathlib import Path
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import os
import uuid
import re
import jwt
import bcrypt
import logging

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_PHOTO_SIZE = 5 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg", "image/webp"}
JAKARTA_TZ = ZoneInfo("Asia/Jakarta")
DAY_NAMES_ID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url, tz_aware=True)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_admin(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token tidak valid")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user or user.get("role") != "admin":
            raise HTTPException(status_code=401, detail="Bukan admin")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token kedaluwarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


class LoginInput(BaseModel):
    email: str
    password: str


class RateInput(BaseModel):
    name: str
    daily_rate: float = Field(ge=0)


MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


def serialize_attendance(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "date": doc["date"],
        "day_name": doc["day_name"],
        "photo_url": doc.get("photo_url"),
        "created_at": doc.get("created_at"),
    }


def today_jakarta():
    return datetime.now(JAKARTA_TZ).date()


async def save_photo(photo: UploadFile) -> str:
    if photo.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="File harus berupa gambar (JPG/PNG/WebP)")
    content = await photo.read()
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=400, detail="Ukuran foto maksimal 5MB")
    ext = os.path.splitext(photo.filename or "photo.jpg")[1].lower() or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    (UPLOAD_DIR / filename).write_bytes(content)
    return f"/api/uploads/{filename}"


@api_router.get("/")
async def root():
    return {"message": "API Absensi Karyawan"}


@api_router.post("/auth/login")
async def login(input: LoginInput, request: Request):
    email = input.email.lower().strip()
    identifier = email
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.now(timezone.utc) < locked_until:
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi dalam 15 menit.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(input.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {
                "$inc": {"count": 1},
                "$set": {"locked_until": datetime.now(timezone.utc) + timedelta(minutes=15)},
            },
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email atau password salah")

    await db.login_attempts.delete_one({"identifier": identifier})
    token = create_access_token(str(user["_id"]), email)
    return {"access_token": token, "email": email, "name": user.get("name", "Admin")}


@api_router.get("/auth/me")
async def me(admin=Depends(get_current_admin)):
    return admin


@api_router.post("/attendance", status_code=201)
async def submit_attendance(name: str = Form(...), photo: UploadFile = File(...)):
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama lengkap wajib diisi")
    today = today_jakarta()
    date_str = today.isoformat()
    existing = await db.attendance.find_one({"name_lower": name.lower(), "date": date_str})
    if existing:
        raise HTTPException(status_code=409, detail="Anda sudah melakukan absensi hari ini")
    photo_url = await save_photo(photo)
    doc = {
        "name": name,
        "name_lower": name.lower(),
        "date": date_str,
        "day_name": DAY_NAMES_ID[today.weekday()],
        "photo_url": photo_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.attendance.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_attendance(doc)


@api_router.get("/attendance")
async def list_attendance(month: Optional[str] = None, admin=Depends(get_current_admin)):
    query = {}
    if month:
        if not MONTH_RE.match(month):
            raise HTTPException(status_code=400, detail="Format bulan harus YYYY-MM")
        query["date"] = {"$regex": f"^{month}"}
    docs = await db.attendance.find(query).sort([("date", -1), ("created_at", -1)]).to_list(2000)
    return [serialize_attendance(d) for d in docs]


@api_router.post("/attendance/manual", status_code=201)
async def add_attendance_manual(
    name: str = Form(...),
    date: str = Form(...),
    photo: Optional[UploadFile] = File(None),
    admin=Depends(get_current_admin),
):
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama lengkap wajib diisi")
    try:
        d = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format tanggal tidak valid")
    if d > today_jakarta():
        raise HTTPException(status_code=400, detail="Tanggal absensi tidak boleh di masa depan")
    existing = await db.attendance.find_one({"name_lower": name.lower(), "date": date})
    if existing:
        raise HTTPException(status_code=409, detail="Data absensi untuk nama dan tanggal ini sudah ada")
    photo_url = await save_photo(photo) if photo and photo.filename else None
    doc = {
        "name": name,
        "name_lower": name.lower(),
        "date": date,
        "day_name": DAY_NAMES_ID[d.weekday()],
        "photo_url": photo_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.attendance.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_attendance(doc)


@api_router.put("/attendance/{attendance_id}")
async def update_attendance(
    attendance_id: str,
    name: Optional[str] = Form(None),
    date: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    admin=Depends(get_current_admin),
):
    try:
        oid = ObjectId(attendance_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID tidak valid")
    doc = await db.attendance.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    update = {}
    new_name = (name or doc["name"]).strip()
    new_date = date or doc["date"]
    try:
        d = datetime.strptime(new_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format tanggal tidak valid")
    if d > today_jakarta():
        raise HTTPException(status_code=400, detail="Tanggal absensi tidak boleh di masa depan")
    dup = await db.attendance.find_one({"name_lower": new_name.lower(), "date": new_date, "_id": {"$ne": oid}})
    if dup:
        raise HTTPException(status_code=409, detail="Data absensi untuk nama dan tanggal ini sudah ada")
    update["name"] = new_name
    update["name_lower"] = new_name.lower()
    update["date"] = new_date
    update["day_name"] = DAY_NAMES_ID[d.weekday()]
    if photo and photo.filename:
        update["photo_url"] = await save_photo(photo)
    await db.attendance.update_one({"_id": oid}, {"$set": update})
    doc.update(update)
    return serialize_attendance(doc)


@api_router.delete("/attendance/{attendance_id}")
async def delete_attendance(attendance_id: str, admin=Depends(get_current_admin)):
    try:
        oid = ObjectId(attendance_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID tidak valid")
    result = await db.attendance.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    return {"message": "Data absensi berhasil dihapus"}


@api_router.get("/recap")
async def recap(month: Optional[str] = None, admin=Depends(get_current_admin)):
    query = {}
    if month:
        if not MONTH_RE.match(month):
            raise HTTPException(status_code=400, detail="Format bulan harus YYYY-MM")
        query["date"] = {"$regex": f"^{month}"}
    docs = await db.attendance.find(query).to_list(5000)
    rates = {r["name_lower"]: r["daily_rate"] async for r in db.rates.find()}
    grouped = {}
    for d in docs:
        key = d["name_lower"]
        if key not in grouped:
            grouped[key] = {"name": d["name"], "total_days": 0}
        grouped[key]["total_days"] += 1
    result = []
    for key, g in grouped.items():
        rate = rates.get(key, 0)
        result.append(
            {
                "name": g["name"],
                "total_days": g["total_days"],
                "daily_rate": rate,
                "total_salary": g["total_days"] * rate,
            }
        )
    result.sort(key=lambda x: x["name"].lower())
    return result


@api_router.put("/rates")
async def set_rate(input: RateInput, admin=Depends(get_current_admin)):
    name = input.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama wajib diisi")
    await db.rates.update_one(
        {"name_lower": name.lower()},
        {"$set": {"name": name, "name_lower": name.lower(), "daily_rate": input.daily_rate}},
        upsert=True,
    )
    return {"message": "Tarif gaji per hari berhasil disimpan"}


async def seed_admin():
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one(
            {
                "email": admin_email,
                "password_hash": hash_password(admin_password),
                "name": "Admin",
                "role": "admin",
                "created_at": datetime.now(timezone.utc),
            }
        )
        logger.info("Admin user seeded")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.attendance.create_index([("name_lower", 1), ("date", 1)], unique=True)
    await db.login_attempts.create_index("identifier")
    await seed_admin()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)
app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
