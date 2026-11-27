import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, FileText, KeyRound, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { marketingApi, API_BASE, formatApiError, formatRupiah } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const currentJakartaMonth = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }).slice(0, 7);
const todayJakarta = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
const dateLabel = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
const monthLabel = (value) => value ? new Date(`${value}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "";
const statusLabels = { pending: "Menunggu admin", reviewing: "Sedang ditinjau", approved: "Disetujui", rejected: "Ditolak" };

function buildCalendar(month) {
  if (!month) return [];
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const mondayOffset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const cells = Array(mondayOffset).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export default function MarketingDashboard() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentJakartaMonth);
  const [profile, setProfile] = useState(null);
  const [report, setReport] = useState(null);
  const [salarySlip, setSalarySlip] = useState(null);
  const [correctionRequests, setCorrectionRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [salaryError, setSalaryError] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [correctionTarget, setCorrectionTarget] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSalaryError("");
    try {
      const [me, performance] = await Promise.all([
        marketingApi.get("/marketing/auth/me"),
        marketingApi.get("/marketing/me/performance", { params: { month } }),
      ]);
      setProfile(me.data);
      setReport(performance.data);
      const [slipResult, correctionResult] = await Promise.allSettled([
        marketingApi.get("/marketing/me/salary-slip", { params: { month } }),
        marketingApi.get("/marketing/me/correction-requests", { params: { month } }),
      ]);
      if (slipResult.status === "fulfilled") setSalarySlip(slipResult.value.data);
      else setSalaryError(formatApiError(slipResult.reason));
      if (correctionResult.status === "fulfilled") setCorrectionRequests(correctionResult.value.data);
      else toast.error(formatApiError(correctionResult.reason));
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        localStorage.removeItem("marketing_token");
        navigate("/login?role=marketing", { replace: true });
        return;
      }
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [month, navigate]);

  useEffect(() => { load(); }, [load]);

  const attendanceByDate = useMemo(() => new Map((report?.attendance || []).map((item) => [item.date, item])), [report]);
  const requestsByAttendance = useMemo(() => {
    const latest = new Map();
    (correctionRequests || []).forEach((item) => {
      if (!latest.has(item.attendance_id)) latest.set(item.attendance_id, item);
    });
    return latest;
  }, [correctionRequests]);
  const calendar = useMemo(() => buildCalendar(month), [month]);

  const logout = () => {
    localStorage.removeItem("marketing_token");
    navigate("/login?role=marketing", { replace: true });
  };

  const submitCorrection = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const { data } = await marketingApi.post("/marketing/me/correction-requests", {
        attendance_id: correctionTarget.id,
        corrected_date: form.get("corrected_date") || null,
        reason: form.get("reason"),
      });
      setCorrectionRequests((items) => [data, ...items]);
      setCorrectionTarget(null);
      toast.success("Pengajuan koreksi dikirim kepada admin");
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = form.get("new_password");
    if (newPassword !== form.get("confirm_password")) {
      toast.error("Konfirmasi password baru tidak sama");
      return;
    }
    setPasswordBusy(true);
    try {
      await marketingApi.put("/marketing/me/password", {
        current_password: form.get("current_password"),
        new_password: newPassword,
      });
      localStorage.removeItem("marketing_token");
      toast.success("Password diubah. Silakan login kembali.");
      navigate("/login?role=marketing", { replace: true });
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setPasswordBusy(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><UserRound className="h-5 w-5" /></span>
            <div className="min-w-0"><h1 className="truncate font-bold text-slate-950">Panel Marketing</h1><p className="truncate text-sm text-slate-500">{profile?.name || "Marketing"}</p></div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)} aria-label="Ganti password"><KeyRound className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Ganti Password</span></Button>
            <Button variant="outline" size="sm" onClick={logout} aria-label="Keluar"><LogOut className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Keluar</span></Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-xl font-bold text-slate-950">Performa Pribadi</h2><p className="mt-1 text-sm text-slate-500">Ringkasan kehadiran dan penghasilan untuk {monthLabel(month)}.</p></div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarDays className="h-4 w-4 text-emerald-700" /><span className="sr-only">Pilih bulan</span><Input aria-label="Pilih bulan" type="month" value={month} max={currentJakartaMonth()} onChange={(event) => setMonth(event.target.value)} className="w-44 bg-white" /></label>
        </div>

        {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<Button type="button" variant="outline" size="sm" onClick={load}>Coba lagi</Button></div>}

        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Hari hadir tercatat</p><p className="mt-1 text-2xl font-extrabold text-slate-950">{loading ? "..." : report?.attendance_days ?? 0} <span className="text-base font-semibold">hari</span></p></div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm text-emerald-800">Penghasilan bersih</p><p className="mt-1 text-2xl font-extrabold text-emerald-900">{salarySlip?.net_pay == null ? "Belum tersedia" : formatRupiah(salarySlip.net_pay)}</p></div>
        </div>

        <Tabs defaultValue="attendance" className="rounded-lg border border-slate-200 bg-white p-3 sm:p-5">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-lg bg-slate-100 p-1 sm:w-fit">
            <TabsTrigger value="attendance" className="rounded-md px-4 py-2.5 font-semibold data-[state=active]:bg-white data-[state=active]:text-emerald-700">Absensi</TabsTrigger>
            <TabsTrigger value="salary" className="rounded-md px-4 py-2.5 font-semibold data-[state=active]:bg-white data-[state=active]:text-emerald-700">Slip Gaji</TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="mt-5 space-y-5">
            <section aria-label="Kalender absensi">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-slate-950">Kalender {monthLabel(month)}</h3><p className="text-xs text-slate-500">Hari tanpa tanda hadir berarti belum ada catatan.</p></div>
              <div className="grid grid-cols-7 border-l border-t border-slate-200">
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => <div key={day} className="border-b border-r border-slate-200 bg-slate-50 py-2 text-center text-xs font-semibold text-slate-600">{day}</div>)}
                {calendar.map((date, index) => {
                  const entry = date ? attendanceByDate.get(date) : null;
                  const future = date && date > todayJakarta();
                  return <div key={date || `blank-${index}`} className={`min-h-16 border-b border-r border-slate-200 p-1.5 sm:min-h-20 sm:p-2 ${!date ? "bg-slate-50/70" : entry ? "bg-emerald-50" : "bg-white"}`}>
                    {date && <><span className={`text-xs font-semibold ${entry ? "text-emerald-800" : "text-slate-700"}`}>{Number(date.slice(-2))}</span>{entry ? <p className="mt-1 text-[10px] font-semibold text-emerald-700 sm:text-xs">Hadir</p> : !future && <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">Belum tercatat</p>}</>}
                  </div>;
                })}
              </div>
            </section>

            {loading ? <p className="py-4 text-sm text-slate-500">Memuat riwayat...</p> : report?.attendance?.length ? <section>
              <h3 className="mb-2 font-bold text-slate-950">Riwayat dan foto</h3>
              <ul className="divide-y divide-slate-100 border-y border-slate-200">
                {report.attendance.map((entry) => {
                  const request = requestsByAttendance.get(entry.id);
                  return <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0"><p className="font-semibold text-slate-900">{entry.day_name}, {dateLabel(entry.date)}</p><p className="text-sm text-emerald-700">Hadir</p>{request && <p className="mt-1 text-xs text-slate-500">Koreksi: {statusLabels[request.status] || request.status}</p>}</div>
                    <div className="flex shrink-0 gap-2">
                      {entry.photo_url && <Button type="button" variant="outline" size="sm" onClick={() => setPhotoPreview(entry)}>Lihat foto</Button>}
                      {(!request || !["pending", "reviewing"].includes(request.status)) && <Button type="button" variant="outline" size="sm" onClick={() => setCorrectionTarget(entry)}>Ajukan koreksi</Button>}
                    </div>
                  </li>;
                })}
              </ul>
            </section> : <p className="py-5 text-sm text-slate-500">Belum ada absensi tercatat untuk bulan ini.</p>}
          </TabsContent>

          <TabsContent value="salary" className="mt-5">
            {salaryError ? <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{salaryError}<Button type="button" variant="outline" size="sm" onClick={load}>Coba lagi</Button></div> : salarySlip ? <SalarySlip slip={salarySlip} /> : <p className="py-5 text-sm text-slate-500">Memuat slip gaji...</p>}
          </TabsContent>
        </Tabs>
      </section>

      <Dialog open={!!photoPreview} onOpenChange={(open) => { if (!open) setPhotoPreview(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-lg" data-testid="marketing-photo-preview-dialog">
          <DialogHeader><DialogTitle>Foto Absensi{photoPreview ? ` - ${photoPreview.day_name}, ${dateLabel(photoPreview.date)}` : ""}</DialogTitle></DialogHeader>
          {photoPreview?.photo_url && <img src={`${API_BASE}${photoPreview.photo_url}`} alt={`Foto absensi ${photoPreview.date}`} className="max-h-[70dvh] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain" data-testid="marketing-photo-preview-image" />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!correctionTarget} onOpenChange={(open) => { if (!open) setCorrectionTarget(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-lg">
          <DialogHeader><DialogTitle>Ajukan Koreksi Absensi</DialogTitle><DialogDescription>Pengajuan untuk absensi {correctionTarget ? dateLabel(correctionTarget.date) : ""} akan ditinjau admin. Data tidak berubah sebelum disetujui.</DialogDescription></DialogHeader>
          <form onSubmit={submitCorrection} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="correction-date">Tanggal yang diminta (opsional)</Label><Input id="correction-date" name="corrected_date" type="date" max={todayJakarta()} /></div>
            <div className="space-y-2"><Label htmlFor="correction-reason">Alasan koreksi</Label><textarea id="correction-reason" name="reason" required minLength={10} maxLength={1000} rows={4} className="w-full rounded-md border border-slate-200 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" placeholder="Jelaskan kesalahan tanggal atau kendala foto..." /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCorrectionTarget(null)}>Batal</Button><Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Kirim Pengajuan</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={(open) => { if (!passwordBusy) setPasswordOpen(open); }}>
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto rounded-lg">
          <DialogHeader><DialogTitle>Ganti Password</DialogTitle><DialogDescription>Password harus minimal 10 karakter. Setelah diganti, Anda akan diminta login kembali.</DialogDescription></DialogHeader>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="current-password">Password saat ini</Label><Input id="current-password" name="current_password" type="password" autoComplete="current-password" required /></div>
            <div className="space-y-2"><Label htmlFor="new-password">Password baru</Label><Input id="new-password" name="new_password" type="password" autoComplete="new-password" minLength={10} maxLength={72} required /></div>
            <div className="space-y-2"><Label htmlFor="confirm-password">Ulangi password baru</Label><Input id="confirm-password" name="confirm_password" type="password" autoComplete="new-password" minLength={10} maxLength={72} required /></div>
            <div className="flex justify-end"><Button type="submit" disabled={passwordBusy} className="bg-emerald-600 hover:bg-emerald-700"><KeyRound className="h-4 w-4" />{passwordBusy ? "Memproses..." : "Perbarui Password"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SalarySlip({ slip }) {
  return <article className="mx-auto max-w-2xl space-y-4" data-testid="marketing-salary-slip">
    <header className="flex items-start gap-3 border-b border-emerald-700 pb-3"><FileText className="mt-1 h-5 w-5 shrink-0 text-emerald-700" /><div><h3 className="font-bold text-slate-950">Rincian Penghasilan Karyawan</h3><p className="text-sm text-slate-500">{monthLabel(slip.month)}</p></div></header>
    <section className="space-y-2 text-sm">
      <SlipLine label="Hari hadir" value={`${slip.attendance_days} hari`} />
      <SlipLine label="Penghasilan hadir" value={formatRupiah(slip.attendance_pay)} />
      {slip.earnings.map((item, index) => <SlipLine key={`earning-${index}`} label={item.label} value={formatRupiah(item.amount)} />)}
      <SlipLine label="Potongan tidak masuk kerja" value={formatRupiah(slip.absence_deduction)} negative />
      {slip.cash_advance_deduction > 0 && <SlipLine label="Potongan kasbon" value={formatRupiah(slip.cash_advance_deduction)} negative />}
      {slip.deductions.map((item, index) => <SlipLine key={`deduction-${index}`} label={item.label} value={formatRupiah(item.amount)} negative />)}
      <SlipLine label="PPh 21" value={slip.pph21_amount == null ? "Belum dihitung" : formatRupiah(slip.pph21_amount)} negative />
    </section>
    <section className="space-y-2 border-t border-slate-200 pt-3 text-sm">
      <SlipLine label="Penghasilan bruto" value={formatRupiah(slip.gross_pay)} strong />
      <SlipLine label="Total potongan" value={formatRupiah(slip.total_deductions)} negative strong />
      <div className="border-t border-emerald-200 pt-3"><SlipLine label="Penghasilan bersih" value={slip.net_pay == null ? "Belum tersedia" : formatRupiah(slip.net_pay)} strong /></div>
    </section>
    {slip.annual_reconciliation_required && <p className="rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-900">PPh 21 bulan Desember menunggu rekonsiliasi tahunan.</p>}
    {!slip.ptkp_status && <p className="rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-900">Status PTKP belum tersedia untuk tahun ini. Hubungi admin untuk memastikan perhitungan pajak.</p>}
    {slip.absence_notes?.length > 0 && <div className="border-t border-slate-200 pt-3"><p className="text-sm font-bold text-slate-800">Catatan ketidakhadiran</p>{slip.absence_notes.map((note, index) => <p key={index} className="mt-1 text-sm text-slate-600">{note}</p>)}</div>}
  </article>;
}

function SlipLine({ label, value, negative = false, strong = false }) {
  return <div className={`flex items-start justify-between gap-4 ${strong ? "font-bold text-slate-950" : "text-slate-700"}`}><span>{label}</span><span className={`shrink-0 text-right ${negative ? "text-red-700" : ""}`}>{value}</span></div>;
}
