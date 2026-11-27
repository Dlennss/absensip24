import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError, formatTanggal } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusLabels = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" };

export default function CorrectionRequestsTable() {
  const [status, setStatus] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await api.get("/attendance-correction-requests", { params: { status } });
      setRequests(data);
    } catch (err) {
      setError(true);
      toast.error(formatApiError(err));
    } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const review = async (request, decision) => {
    setBusyId(request.id);
    try {
      await api.patch(`/attendance-correction-requests/${request.id}`, {
        decision,
        review_note: notes[request.id] || "",
      });
      toast.success(decision === "approve" ? "Pengajuan disetujui" : "Pengajuan ditolak");
      setRequests((current) => current.filter((item) => item.id !== request.id));
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setBusyId(null); }
  };

  return (
    <section data-testid="correction-requests-section">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-xl font-extrabold text-slate-950">Pengajuan Koreksi</h2><p className="mt-1 text-sm text-slate-500">Periksa alasan dan tanggal sebelum memberi keputusan.</p></div>
        <div className="flex items-center gap-2"><Label htmlFor="correction-status" className="text-sm font-semibold">Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger id="correction-status" className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Menunggu</SelectItem><SelectItem value="approved">Disetujui</SelectItem><SelectItem value="rejected">Ditolak</SelectItem><SelectItem value="all">Semua</SelectItem></SelectContent></Select><Button type="button" size="icon" variant="outline" onClick={load} aria-label="Muat ulang"><RefreshCw className="h-4 w-4" /></Button></div>
      </div>
      {error && <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Pengajuan belum bisa dimuat.<Button type="button" variant="outline" size="sm" onClick={load}>Coba lagi</Button></div>}
      {loading ? <p className="py-10 text-center text-sm text-slate-500">Memuat pengajuan...</p> : requests.length === 0 ? <p className="border-y border-slate-200 py-10 text-center text-sm text-slate-500">Tidak ada pengajuan dengan status ini.</p> : (
        <ul className="divide-y divide-slate-200 border-y border-slate-200">
          {requests.map((request) => <li key={request.id} className="space-y-3 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h3 className="font-bold text-slate-950">{request.marketing_name}</h3><p className="text-sm text-slate-600">Absensi: {formatTanggal(request.original_date)}{request.corrected_date ? ` → ${formatTanggal(request.corrected_date)}` : " · Permintaan peninjauan"}</p></div>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${request.status === "pending" ? "bg-amber-100 text-amber-900" : request.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{statusLabels[request.status] || request.status}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{request.reason}</p>
            {request.review_note && <p className="text-sm text-slate-500">Catatan admin: {request.review_note}</p>}
            {request.status === "pending" && <>
              <div className="space-y-2"><Label htmlFor={`correction-review-note-${request.id}`}>Catatan keputusan (opsional)</Label><textarea id={`correction-review-note-${request.id}`} value={notes[request.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} maxLength={1000} rows={2} className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm" /></div>
              {!request.corrected_date && <p className="text-xs leading-5 text-amber-800">Persetujuan permintaan foto tidak mengganti file foto. Tinjau atau ubah foto melalui menu Data Absensi.</p>}
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busyId === request.id} onClick={() => review(request, "reject")}><X className="h-4 w-4" />Tolak</Button><Button type="button" disabled={busyId === request.id} onClick={() => review(request, "approve")} className="bg-emerald-600 hover:bg-emerald-700"><Check className="h-4 w-4" />{busyId === request.id ? "Memproses..." : "Setujui"}</Button></div>
            </>}
          </li>)}
        </ul>
      )}
    </section>
  );
}
