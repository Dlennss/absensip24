# Auth Testing Playbook

## Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
```
Verify: bcrypt hash starts with `$2b$`, unique index on users.email.

## Step 2: API Testing
```
TOKEN=$(curl -s -X POST $API_URL/api/auth/login -H "Content-Type: application/json" -d '{"email":"fathurrizqi254@gmail.com","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s $API_URL/api/auth/me -H "Authorization: Bearer $TOKEN"
```
Login returns {access_token}; /me returns admin user object.

## Step 3: Attendance flow
- POST /api/attendance (multipart: name, photo) — public, no auth. Photo > 5MB → 400. Duplicate same name+date → 409.
- GET /api/attendance?month=YYYY-MM — requires admin token.
- PUT /api/attendance/{id} (multipart) — admin only.
- DELETE /api/attendance/{id} — admin only.
- POST /api/attendance/manual (multipart: name, date, photo optional) — admin only.
- GET /api/recap?month=YYYY-MM — admin only.
- PUT /api/rates {name, daily_rate} — admin only.
