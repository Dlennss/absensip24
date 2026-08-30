# PRD — Website Absensi Karyawan

## Problem Statement (Asli)
Buatkan sebuah website absensi simple untuk karyawan yang berisi Nama Lengkap, Hari/Tanggal, dan sebuah upload foto (maksimal 5MB), hanya untuk upload dan tidak bisa melihat hasil respon untuk karyawan. Akses admin untuk melihat serta edit data absensi karyawan, rekap seluruh data dari total hari, serta perhitungan gaji karyawan dari total absensi.

## Keputusan Pengguna
- Login admin: username & password (JWT Bearer)
- Gaji: per hari hadir, tarif per karyawan di-set admin
- Tanggal absensi: otomatis hari ini (Asia/Jakarta)
- Admin: bisa tambah, edit, hapus data
- Bahasa Indonesia, desain simpel

## Arsitektur
- Backend: FastAPI (`/app/backend/server.py`) + MongoDB (koleksi: users, attendance, rates, login_attempts). Upload foto disimpan di `/app/backend/uploads`, disajikan via `/api/uploads`.
- Frontend: React + Tailwind + shadcn/ui (`/app/frontend/src/pages`, `/app/frontend/src/components/admin`).
- Auth: JWT Bearer (bcrypt), admin seeded dari env, lockout 5x percobaan = 15 menit.

## User Personas
- Karyawan: mengisi absensi (nama + foto) tanpa login, tanpa melihat data.
- Admin (fathurrizqi254@gmail.com): kelola data absensi, rekap & gaji.

## Yang Sudah Diimplementasikan (2026-08-30)
- Halaman karyawan: form nama, tanggal otomatis, upload foto maks 5MB (validasi client + server), anti-duplikat per nama/hari (409).
- Admin login JWT + dashboard: tabel absensi (thumbnail + preview foto), filter bulan, tambah/edit/hapus (dengan konfirmasi hapus).
- Rekap & gaji: total hari per karyawan, total gaji otomatis = Rp4.000.000 ÷ 26 hari × total hari masuk (Rp153.846/hari), ringkasan total keseluruhan dalam Rupiah.
- Perubahan (2026-08-30): perhitungan gaji diubah dari tarif per karyawan menjadi rumus tetap gaji pokok Rp4.000.000 / 26 × hari masuk; endpoint /api/rates dan input tarif per karyawan dihapus.
- Hardening: lockout brute-force 429, validasi format bulan, tolak tanggal masa depan, tarif >= 0.
- Pengujian: backend 51/51 pytest, semua alur UI lulus (iteration_2).

## Backlog / Next Tasks
- P2: Export rekap gaji ke Excel/PDF.
- P2: Notifikasi email ke admin saat ada absensi baru.
- P2: Migrasi on_event ke lifespan FastAPI; CORS origins eksplisit.
- P3: Ganti input date/month native dengan shadcn Calendar; loading skeleton tabel.
