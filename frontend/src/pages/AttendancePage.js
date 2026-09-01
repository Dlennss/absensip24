import { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Camera, CalendarDays, ClipboardCheck, User } from "lucide-react";
import { API, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_SIZE = 5 * 1024 * 1024;

export default function AttendancePage() {
  const [name, setName] = useState("");
  const [marketing, setMarketing] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const today = new Date();
  const tanggalLabel = today.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const normalizedName = name.trim().toLowerCase();
  const matchedMarketing = useMemo(
    () => marketing.find((item) => item.name.toLowerCase() === normalizedName),
    [marketing, normalizedName]
  );
  const filteredMarketing = useMemo(() => {
    if (!normalizedName) return marketing.slice(0, 8);
    return marketing
      .filter((item) => item.name.toLowerCase().includes(normalizedName))
      .slice(0, 8);
  }, [marketing, normalizedName]);

  const fetchMarketing = async () => {
    try {
      const { data } = await axios.get(`${API}/marketing/available`);
      setMarketing(data);
    } catch {
      toast.error("Daftar marketing belum bisa dimuat");
    }
  };

  useEffect(() => {
    fetchMarketing();
  }, []);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (JPG/PNG)");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Ukuran foto maksimal 5MB");
      e.target.value = "";
      return;
    }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama lengkap wajib diisi");
      return;
    }
    if (!matchedMarketing) {
      toast.error("Nama marketing tidak terdaftar");
      return;
    }
    if (!photo) {
      toast.error("Foto absensi wajib diunggah");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", matchedMarketing.name);
      formData.append("photo", photo);
      await axios.post(`${API}/attendance`, formData);
      toast.success("Absensi berhasil dikirim. Terima kasih!");
      setName("");
      setPhoto(null);
      setPreview(null);
      fetchMarketing();
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8fafc_0%,#eef6f4_55%,#fff7ed_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <main className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-xl items-center justify-center" data-testid="attendance-page">
        <section className="w-full">
          <form
            onSubmit={handleSubmit}
            className="mx-auto w-full max-w-xl rounded-lg border border-white/80 bg-white/90 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-7 lg:p-8"
            data-testid="attendance-form"
          >
          <div className="mb-6 border-b border-slate-200 pb-5">
            <p className="text-sm font-semibold text-emerald-700">Form Absensi Hari Ini</p>
            <p className="mt-1 text-sm text-slate-500">{tanggalLabel}</p>
          </div>

          <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <User className="h-4 w-4 text-emerald-700" strokeWidth={1.7} /> Nama Lengkap
            </Label>
            <div className="relative">
              <Input
                id="name"
                data-testid="attendance-name-input"
                placeholder="Cari nama marketing"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                className="h-12 rounded-lg border-slate-200 bg-white px-4 shadow-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
              {name && !matchedMarketing && filteredMarketing.length > 0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
                  {filteredMarketing.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setName(item.name)}
                      className="block w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {name && (
              <p className={matchedMarketing ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-red-600"}>
                {matchedMarketing ? "Nama marketing ditemukan" : "Nama marketing tidak terdaftar"}
              </p>
            )}
            {!name && marketing.length === 0 && (
              <p className="text-xs font-semibold text-amber-700">
                Admin perlu menambahkan nama marketing terlebih dahulu.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CalendarDays className="h-4 w-4 text-emerald-700" strokeWidth={1.7} /> Hari / Tanggal
            </Label>
            <div
              className="flex h-12 items-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800"
              data-testid="attendance-date-display"
            >
              {tanggalLabel}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Camera className="h-4 w-4 text-emerald-700" strokeWidth={1.7} /> Foto Absensi
            </Label>
            <button
              type="button"
              data-testid="attendance-photo-upload-area"
              onClick={() => fileRef.current?.click()}
              className="group flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition duration-200 hover:border-emerald-500 hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:min-h-52"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Pratinjau foto"
                  className="max-h-64 w-full rounded-md border border-slate-200 object-contain"
                  data-testid="attendance-photo-preview"
                />
              ) : (
                <>
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition group-hover:text-emerald-700">
                    <Camera className="h-7 w-7" strokeWidth={1.7} />
                  </span>
                  <span className="text-center text-sm font-medium text-slate-600">
                    Klik untuk unggah foto (maks. 5MB)
                  </span>
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              data-testid="attendance-photo-input"
              onChange={handlePhoto}
            />
            {photo && (
              <p className="text-xs text-slate-500" data-testid="attendance-photo-name">
                {photo.name} - {(photo.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          <Button
            type="submit"
            data-testid="attendance-submit-button"
            disabled={submitting || !matchedMarketing}
            className="h-12 w-full rounded-lg bg-emerald-600 text-base font-bold shadow-lg shadow-emerald-900/15 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-700"
          >
            <ClipboardCheck className="mr-1 h-5 w-5" strokeWidth={1.7} />
            {submitting ? "Mengirim..." : "Kirim Absensi"}
          </Button>
          </div>
          </form>

        <p className="mt-5 text-center">
          <a
            href="/admin/login"
            className="text-sm font-semibold text-slate-500 transition-colors duration-200 hover:text-emerald-700"
            data-testid="admin-login-link"
          >
            Masuk sebagai Admin
          </a>
        </p>
        </section>
      </main>
    </div>
  );
}
