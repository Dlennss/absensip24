import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Camera, CalendarDays, ClipboardCheck, RefreshCw, ShieldCheck, User, X } from "lucide-react";
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
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [validatingPhoto, setValidatingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

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

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraReady(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!cameraActive || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.muted = true;
    video.playsInline = true;
    const playVideo = async () => {
      try {
        await video.play();
      } catch {
        setCameraError("Ketuk area kamera lalu coba lagi jika preview belum muncul.");
      }
    };
    playVideo();
  }, [cameraActive]);

  const getFrontCameraStream = async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { exact: "user" },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });
    } catch {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser ini belum mendukung kamera langsung.");
      return;
    }
    try {
      setCameraError("");
      setPhoto(null);
      setPreview(null);
      stopCamera();
      const stream = await getFrontCameraStream();
      const [track] = stream.getVideoTracks();
      const facingMode = track?.getSettings?.().facingMode;
      if (facingMode && facingMode !== "user") {
        track.stop();
        setCameraError("Wajib memakai kamera depan untuk selfie.");
        return;
      }
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setCameraError("Kamera depan wajib diizinkan untuk absensi.");
    }
  };

  const validateCapturedCanvas = async (canvas) => {
    const ctx = canvas.getContext("2d");
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let brightness = 0;
    let saturatedPixels = 0;

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      brightness += (r + g + b) / 3;
      if (max - min > 35) saturatedPixels += 1;
    }

    const sampleCount = data.length / 16;
    const averageBrightness = brightness / sampleCount;
    const saturationRatio = saturatedPixels / sampleCount;

    if (averageBrightness < 72) {
      return "Foto terlalu gelap. Ambil selfie di luar ruangan atau area terbuka yang terang.";
    }
    if (saturationRatio < 0.18) {
      return "Foto terlihat seperti ruangan tertutup/kurang natural. Ambil selfie di luar ruangan yang terang.";
    }

    if ("FaceDetector" in window) {
      try {
        const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
        const faces = await detector.detect(canvas);
        if (faces.length !== 1) return "Wajib selfie satu wajah. Foto ID card atau objek lain tidak diterima.";
        const face = faces[0].boundingBox;
        const faceArea = (face.width * face.height) / (width * height);
        const faceCenterX = face.x + face.width / 2;
        if (faceArea < 0.08 || faceCenterX < width * 0.22 || faceCenterX > width * 0.78) {
          return "Wajah harus jelas dan berada di tengah kamera depan.";
        }
      } catch {
        return "";
      }
    }

    return "";
  };

  const captureSelfie = async () => {
    if (!videoRef.current || !cameraReady) {
      toast.error("Kamera belum siap");
      return;
    }
    setValidatingPhoto(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const size = 900;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const sourceSize = Math.min(video.videoWidth, video.videoHeight);
      const sx = (video.videoWidth - sourceSize) / 2;
      const sy = (video.videoHeight - sourceSize) / 2;
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const validationError = await validateCapturedCanvas(canvas);
      if (validationError) {
        toast.error(validationError);
        return;
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            toast.error("Foto gagal diambil");
            return;
          }
          if (blob.size > MAX_SIZE) {
            toast.error("Ukuran foto maksimal 5MB");
            return;
          }
          const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
          setPhoto(file);
          setPreview(URL.createObjectURL(blob));
          stopCamera();
          toast.success("Selfie diterima. Pastikan wajah tersenyum dan jelas.");
        },
        "image/jpeg",
        0.86
      );
    } finally {
      setValidatingPhoto(false);
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    setPreview(null);
    startCamera();
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
            <div
              className="overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50"
              data-testid="attendance-camera-section"
            >
              {preview ? (
                <div className="p-4">
                  <img
                    src={preview}
                    alt="Pratinjau selfie"
                    className="max-h-72 w-full rounded-md border border-slate-200 bg-white object-contain"
                    data-testid="attendance-photo-preview"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={retakePhoto}
                    className="mt-3 h-10 w-full rounded-lg border-slate-200 bg-white font-bold"
                    data-testid="attendance-retake-photo-button"
                  >
                    <RefreshCw className="h-4 w-4" strokeWidth={1.7} />
                    Ambil Ulang Selfie
                  </Button>
                </div>
              ) : cameraActive ? (
                <div className="space-y-3 p-4">
                  <div className="relative overflow-hidden rounded-lg bg-black">
                    <video
                      ref={videoRef}
                      muted
                      autoPlay
                      playsInline
                      onLoadedMetadata={() => setCameraReady(true)}
                      onCanPlay={() => setCameraReady(true)}
                      className="aspect-square w-full scale-x-[-1] object-cover"
                      data-testid="attendance-camera-video"
                    />
                    <div className="pointer-events-none absolute inset-6 rounded-full border-2 border-white/80" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      onClick={captureSelfie}
                      disabled={!cameraReady || validatingPhoto}
                      className="h-11 rounded-lg bg-emerald-600 font-bold hover:bg-emerald-700"
                      data-testid="attendance-capture-selfie-button"
                    >
                      <Camera className="h-4 w-4" strokeWidth={1.7} />
                      {validatingPhoto ? "Memeriksa..." : "Ambil Selfie"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={stopCamera}
                      className="h-11 rounded-lg border-slate-200 bg-white font-bold"
                    >
                      <X className="h-4 w-4" strokeWidth={1.7} />
                      Tutup Kamera
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-56 flex-col items-center justify-center gap-4 p-5 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                    <ShieldCheck className="h-7 w-7" strokeWidth={1.7} />
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">Wajib selfie kamera depan</p>
                  </div>
                  <Button
                    type="button"
                    onClick={startCamera}
                    className="h-11 rounded-lg bg-emerald-600 font-bold hover:bg-emerald-700"
                    data-testid="attendance-start-camera-button"
                  >
                    <Camera className="h-4 w-4" strokeWidth={1.7} />
                    Buka Kamera Depan
                  </Button>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            {cameraError && (
              <p className="text-xs font-semibold text-red-600" data-testid="attendance-camera-error">
                {cameraError}
              </p>
            )}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              Foto ID card, foto dari galeri, kamera belakang, ruangan gelap/tertutup, dan wajah tidak jelas akan ditolak.
            </div>
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
