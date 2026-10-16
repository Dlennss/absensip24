import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw, X } from "lucide-react";
import api, { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPT = ALLOWED_TYPES.join(",");

export default function KtpPhotoInput({ photo, file, onChange, editing, disabled }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    setPreview("");
    setError("");
    setLoading(Boolean(photo && !file));
    if (file) {
      objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
    } else if (photo) {
      api.get(`${API_BASE}${photo.url}`, { responseType: "blob", signal: controller.signal })
        .then(({ data }) => {
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(data);
          setPreview(objectUrl);
          setLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setError("Foto KTP belum bisa dimuat. Silakan coba lagi.");
          setLoading(false);
        });
    }
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, photo, reload]);

  const select = (event) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError("Gunakan gambar JPG, PNG, atau WebP.");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("Ukuran foto KTP maksimal 5MB.");
      return;
    }
    setError("");
    onChange(selected);
  };

  return (
    <section className="space-y-3 border-t border-slate-200 pt-4" data-testid="ktp-photo-section">
      <h3 className="text-sm font-bold">Foto KTP</h3>
      <div className="flex min-h-36 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3">
        {preview ? <img src={preview} alt="Foto KTP marketing" className="max-h-72 w-full object-contain" data-testid="ktp-photo-preview" /> : (
          <p className="text-sm text-slate-500">{loading ? "Memuat foto KTP..." : photo ? "Foto KTP belum dapat ditampilkan" : "Belum ada foto KTP"}</p>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {photo && !preview && !loading && (
        <Button type="button" variant="outline" size="sm" onClick={() => setReload((current) => current + 1)}>
          <RefreshCw className="h-4 w-4" />Coba Lagi
        </Button>
      )}
      {editing && <>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={disabled} onClick={() => cameraRef.current?.click()} data-testid="ktp-camera-button">
            <Camera className="h-4 w-4" />Foto KTP
          </Button>
          <Button type="button" variant="outline" disabled={disabled} onClick={() => galleryRef.current?.click()} data-testid="ktp-gallery-button">
            <ImagePlus className="h-4 w-4" />Pilih Gambar
          </Button>
          {file && <Button type="button" variant="outline" disabled={disabled} onClick={() => onChange(null)}>
            <X className="h-4 w-4" />Batal Pilih
          </Button>}
        </div>
        <input ref={cameraRef} type="file" accept={ACCEPT} capture="environment" onChange={select} disabled={disabled} className="hidden" data-testid="ktp-camera-input" aria-label="Ambil foto KTP" />
        <input ref={galleryRef} type="file" accept={ACCEPT} onChange={select} disabled={disabled} className="hidden" data-testid="ktp-gallery-input" aria-label="Pilih gambar KTP" />
        <p className="text-xs text-slate-500">JPG, PNG, atau WebP. Maksimal 5MB.</p>
        {file && <p className="break-words text-xs text-slate-600">{file.name} - Foto akan disimpan saat Simpan Profil ditekan.</p>}
      </>}
    </section>
  );
}
