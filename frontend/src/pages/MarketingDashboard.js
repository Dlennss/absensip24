import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, LogOut, UserRound } from "lucide-react";
import { marketingApi, API_BASE, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const currentJakartaMonth = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }).slice(0, 7);

export default function MarketingDashboard() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentJakartaMonth);
  const [profile, setProfile] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [me, performance] = await Promise.all([
        marketingApi.get("/marketing/auth/me"),
        marketingApi.get("/marketing/me/performance", { params: { month } }),
      ]);
      setProfile(me.data);
      setReport(performance.data);
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        localStorage.removeItem("marketing_token");
        navigate("/marketing/login", { replace: true });
        return;
      }
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [month, navigate]);

  useEffect(() => { load(); }, [load]);

  const logout = () => {
    localStorage.removeItem("marketing_token");
    navigate("/marketing/login", { replace: true });
  };
  const monthLabel = month ? new Date(`${month}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><UserRound className="h-5 w-5" /></span>
            <div className="min-w-0"><h1 className="truncate font-bold text-slate-950">Performa Absensi</h1><p className="truncate text-sm text-slate-500">{profile?.name || "Marketing"}</p></div>
          </div>
          <Button variant="outline" size="sm" onClick={logout} aria-label="Keluar"><LogOut className="mr-2 h-4 w-4" />Keluar</Button>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-xl font-bold text-slate-950">Riwayat Absensi</h2><p className="mt-1 text-sm text-slate-500">Data absensi pribadi untuk {monthLabel}.</p></div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarDays className="h-4 w-4 text-emerald-700" /><span className="sr-only">Pilih bulan</span><Input aria-label="Pilih bulan" type="month" value={month} max={currentJakartaMonth()} onChange={(event) => setMonth(event.target.value)} className="w-44 bg-white" /></label>
        </div>
        {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<Button type="button" variant="outline" size="sm" onClick={load}>Coba lagi</Button></div>}
        <div className="mb-5 border-y border-slate-200 bg-white px-4 py-4">
          <p className="text-sm text-slate-500">Hari hadir</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-950">{loading ? "..." : report?.attendance_days ?? 0} <span className="text-base font-semibold">hari</span></p>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 font-bold text-slate-900">{monthLabel}</div>
          {loading ? <p className="p-6 text-sm text-slate-500">Memuat riwayat...</p> : report?.attendance?.length ? (
            <ul className="divide-y divide-slate-100">
              {report.attendance.map((entry) => <li key={entry.date} className="flex items-center justify-between gap-3 px-4 py-3">
                <div><p className="font-semibold text-slate-900">{entry.day_name}, {new Date(`${entry.date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p><p className="text-sm text-emerald-700">Hadir</p></div>
                {entry.photo_url && <Button type="button" variant="outline" size="sm" onClick={() => setPhotoPreview(entry)} aria-label={`Lihat foto absensi ${entry.date}`}>Lihat foto</Button>}
              </li>)}
            </ul>
          ) : <p className="p-6 text-sm text-slate-500">Belum ada absensi pada bulan ini.</p>}
        </div>
      </section>
      <Dialog open={!!photoPreview} onOpenChange={(open) => { if (!open) setPhotoPreview(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-lg" data-testid="marketing-photo-preview-dialog">
          <DialogHeader>
            <DialogTitle>Foto Absensi{photoPreview ? ` - ${photoPreview.day_name}, ${new Date(`${photoPreview.date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}` : ""}</DialogTitle>
          </DialogHeader>
          {photoPreview?.photo_url && <img src={`${API_BASE}${photoPreview.photo_url}`} alt={`Foto absensi ${photoPreview.date}`} className="max-h-[70dvh] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain" data-testid="marketing-photo-preview-image" />}
        </DialogContent>
      </Dialog>
    </main>
  );
}
