import { useState, useRef } from "react";
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
    if (!photo) {
      toast.error("Foto absensi wajib diunggah");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("photo", photo);
      await axios.post(`${API}/attendance`, formData);
      toast.success("Absensi berhasil dikirim. Terima kasih!");
      setName("");
      setPhoto(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md" data-testid="attendance-page">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">
            Sistem Absensi
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight" data-testid="attendance-title">
            Absensi Karyawan
          </h1>
          <p className="text-base text-muted-foreground mt-3">
            Isi nama lengkap dan unggah foto Anda untuk mencatat kehadiran hari ini.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border p-8 space-y-6"
          data-testid="attendance-form"
        >
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4" strokeWidth={1.5} /> Nama Lengkap
            </Label>
            <Input
              id="name"
              data-testid="attendance-name-input"
              placeholder="Masukkan nama lengkap"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="focus:ring-2 focus:ring-primary focus:ring-offset-2"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4" strokeWidth={1.5} /> Hari / Tanggal
            </Label>
            <div
              className="border border-input bg-muted px-3 py-2 text-sm text-foreground"
              data-testid="attendance-date-display"
            >
              {tanggalLabel}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Camera className="w-4 h-4" strokeWidth={1.5} /> Foto Absensi
            </Label>
            <button
              type="button"
              data-testid="attendance-photo-upload-area"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-input hover:border-primary transition-colors duration-200 ease-out p-6 flex flex-col items-center gap-2 bg-card"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Pratinjau foto"
                  className="max-h-48 object-contain border border-border"
                  data-testid="attendance-photo-preview"
                />
              ) : (
                <>
                  <Camera className="w-8 h-8 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-sm text-muted-foreground">
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
              <p className="text-xs text-muted-foreground" data-testid="attendance-photo-name">
                {photo.name} — {(photo.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          <Button
            type="submit"
            data-testid="attendance-submit-button"
            disabled={submitting}
            className="w-full hover:-translate-y-[2px] transition-transform duration-200 ease-out"
          >
            <ClipboardCheck className="w-4 h-4 mr-2" strokeWidth={1.5} />
            {submitting ? "Mengirim..." : "Kirim Absensi"}
          </Button>
        </form>

        <p className="text-center mt-6">
          <a
            href="/admin/login"
            className="text-xs text-muted-foreground hover:text-primary transition-colors duration-200"
            data-testid="admin-login-link"
          >
            Masuk sebagai Admin
          </a>
        </p>
      </div>
    </div>
  );
}
