import { useEffect, useState } from "react";
import { Printer, ReceiptText, Save } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError, formatRupiah } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function monthLabel(month) {
  const [year, monthNumber] = month.split("-");
  return new Date(Number(year), Number(monthNumber) - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function printPayslip(slip) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    toast.error("Izinkan pop-up untuk mencetak slip gaji.");
    return;
  }

  const earningRows = [
    { label: `Gaji kehadiran (${slip.attendance_days} hari)`, amount: slip.attendance_pay },
    ...slip.earnings,
  ];
  const deductionRows = [
    ...slip.deductions,
    { label: "PPh Pasal 21", amount: slip.pph21_amount },
  ];
  const rows = (items) => items.map((item) => `
    <tr><td>${escapeHtml(item.label)}</td><td class="amount">${formatRupiah(item.amount)}</td></tr>
  `).join("");
  const printedAt = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

  printWindow.document.write(`<!doctype html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>Slip Gaji ${escapeHtml(slip.name)} - ${escapeHtml(monthLabel(slip.month))}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #14211e; font: 14px Arial, sans-serif; }
          header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 2px solid #087f5b; }
          h1 { margin: 0; font-size: 24px; }
          .subtitle, .muted { margin: 6px 0 0; color: #64748b; }
          .period { text-align: right; font-weight: 700; }
          .identity { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; padding: 20px 0; }
          .identity span { display: block; margin-bottom: 4px; color: #64748b; font-size: 12px; }
          .section-title { margin: 18px 0 8px; font-size: 13px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 9px 8px; border-bottom: 1px solid #e2e8f0; }
          .amount { width: 34%; text-align: right; white-space: nowrap; }
          .summary { margin-top: 18px; margin-left: auto; width: min(100%, 360px); }
          .summary td { border: 0; }
          .net td { border-top: 2px solid #087f5b; color: #087f5b; font-size: 17px; font-weight: 700; }
          .note { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 11px; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <header>
          <div><h1>SLIP GAJI</h1><p class="subtitle">Rincian penghasilan dan potongan marketing</p></div>
          <div class="period">Periode<br />${escapeHtml(monthLabel(slip.month))}</div>
        </header>
        <section class="identity">
          <div><span>Nama marketing</span><strong>${escapeHtml(slip.name)}</strong></div>
          <div><span>Hari hadir</span><strong>${slip.attendance_days} hari</strong></div>
        </section>
        <h2 class="section-title">Pendapatan</h2>
        <table><tbody>${rows(earningRows)}
          <tr><td><strong>Total pendapatan</strong></td><td class="amount"><strong>${formatRupiah(slip.gross_pay)}</strong></td></tr>
        </tbody></table>
        <h2 class="section-title">Potongan</h2>
        <table><tbody>${rows(deductionRows)}
          <tr><td><strong>Total potongan</strong></td><td class="amount"><strong>${formatRupiah(slip.total_deductions)}</strong></td></tr>
        </tbody></table>
        <table class="summary"><tbody>
          <tr class="net"><td>Gaji bersih diterima</td><td class="amount">${formatRupiah(slip.net_pay)}</td></tr>
        </tbody></table>
        ${slip.pph21_note ? `<p class="muted">Catatan PPh 21: ${escapeHtml(slip.pph21_note)}</p>` : ""}
        <p class="note">Dicetak ${escapeHtml(printedAt)}. Nominal PPh 21 pada slip ini dicatat oleh admin dan bukan hasil penghitungan pajak otomatis.</p>
        <script>window.addEventListener("load", () => window.print());</script>
      </body>
    </html>`);
  printWindow.document.close();
}

export default function PayrollSlipDialog({ marketing, month, onClose }) {
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pph21Amount, setPph21Amount] = useState("");
  const [pph21Note, setPph21Note] = useState("");

  useEffect(() => {
    let active = true;
    if (!marketing || !month) return () => { active = false; };

    setLoading(true);
    setSlip(null);
    api.get(`/salary-slips/${marketing.id}`, { params: { month } })
      .then(({ data }) => {
        if (!active) return;
        setSlip(data);
        setPph21Amount(data.pph21_recorded ? String(data.pph21_amount) : "");
        setPph21Note(data.pph21_note || "");
      })
      .catch((error) => {
        if (active) toast.error(formatApiError(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [marketing, month]);

  const saveTax = async (event) => {
    event.preventDefault();
    const amount = Number(pph21Amount);
    if (pph21Amount.trim() === "" || !Number.isSafeInteger(amount) || amount < 0) {
      toast.error("Isi nominal PPh 21 dengan angka bulat nol atau lebih.");
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put(`/salary-slips/${marketing.id}`, {
        month,
        pph21_amount: amount,
        note: pph21Note.trim(),
      });
      setSlip(data);
      setPph21Amount(String(data.pph21_amount));
      setPph21Note(data.pph21_note || "");
      toast.success("Nominal PPh 21 disimpan untuk periode ini.");
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const taxIsSaved = Boolean(
    slip?.pph21_recorded
    && pph21Amount === String(slip.pph21_amount)
    && pph21Note.trim() === (slip.pph21_note || "")
  );

  return (
    <Dialog open={Boolean(marketing)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-lg" data-testid="salary-slip-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-emerald-700" /> Slip Gaji</DialogTitle>
          <DialogDescription>
            {marketing?.name} · {month ? monthLabel(month) : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Memuat rincian gaji...</p>
        ) : slip ? (
          <div className="space-y-5" data-testid="salary-slip-content">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-sm font-bold text-slate-900">{slip.name}</p>
                <p className="mt-1 text-sm text-slate-500">{slip.attendance_days} hari hadir · {formatRupiah(slip.daily_rate)} per hari</p>
              </div>
              <span className={slip.pph21_recorded ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"}>
                {slip.pph21_recorded ? "PPh 21 tercatat" : "PPh 21 belum diisi"}
              </span>
            </div>

            <section aria-labelledby="salary-slip-earnings-title">
              <h3 id="salary-slip-earnings-title" className="mb-2 text-sm font-extrabold text-slate-900">Pendapatan</h3>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <div className="flex justify-between gap-4 border-b border-slate-100 px-3 py-2.5 text-sm">
                  <span>Gaji kehadiran ({slip.attendance_days} hari)</span><span className="font-semibold tabular-nums">{formatRupiah(slip.attendance_pay)}</span>
                </div>
                {slip.earnings.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex justify-between gap-4 border-b border-slate-100 px-3 py-2.5 text-sm last:border-b-0">
                    <span className="break-words">{item.label}</span><span className="shrink-0 font-semibold tabular-nums">{formatRupiah(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-4 bg-slate-50 px-3 py-3 text-sm font-extrabold">
                  <span>Total pendapatan</span><span className="tabular-nums">{formatRupiah(slip.gross_pay)}</span>
                </div>
              </div>
            </section>

            <section aria-labelledby="salary-slip-deductions-title">
              <h3 id="salary-slip-deductions-title" className="mb-2 text-sm font-extrabold text-slate-900">Potongan</h3>
              <div className="overflow-hidden rounded-md border border-slate-200">
                {slip.deductions.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex justify-between gap-4 border-b border-slate-100 px-3 py-2.5 text-sm">
                    <span className="break-words">{item.label}</span><span className="shrink-0 font-semibold tabular-nums">{formatRupiah(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-b border-slate-100 px-3 py-2.5 text-sm">
                  <span>PPh Pasal 21</span>
                  <span className="shrink-0 font-semibold tabular-nums">{slip.pph21_recorded ? formatRupiah(slip.pph21_amount) : "Belum diisi"}</span>
                </div>
                <div className="flex justify-between gap-4 bg-slate-50 px-3 py-3 text-sm font-extrabold">
                  <span>Total potongan</span><span className="tabular-nums">{formatRupiah(slip.total_deductions)}</span>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <div>
                <p className="text-xs font-semibold text-emerald-800">Gaji bersih diterima</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-emerald-800">{formatRupiah(slip.net_pay)}</p>
              </div>
              <p className="max-w-sm text-xs leading-5 text-emerald-900">Total pendapatan dikurangi seluruh potongan, termasuk PPh 21 yang dicatat admin.</p>
            </div>

            <form onSubmit={saveTax} className="space-y-3 border-t border-slate-200 pt-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">PPh 21</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Masukkan nominal dari perhitungan bagian keuangan. Aplikasi tidak menghitung tarif pajak otomatis. Jangan catat PPh 21 dua kali di penyesuaian gaji.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(160px,220px)_minmax(0,1fr)] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="salary-slip-pph21">Nominal (Rp)</Label>
                  <Input id="salary-slip-pph21" type="number" min="0" step="1" inputMode="numeric" value={pph21Amount} onChange={(event) => setPph21Amount(event.target.value)} placeholder="Masukkan nominal" disabled={saving} data-testid="salary-slip-pph21-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary-slip-tax-note">Catatan (opsional)</Label>
                  <Input id="salary-slip-tax-note" maxLength={500} value={pph21Note} onChange={(event) => setPph21Note(event.target.value)} placeholder="Catatan dari bagian keuangan" disabled={saving} data-testid="salary-slip-tax-note-input" />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="submit" disabled={saving} className="bg-emerald-700 font-bold hover:bg-emerald-800" data-testid="salary-slip-save-tax-button">
                  <Save className="h-4 w-4" />{saving ? "Menyimpan..." : "Simpan PPh 21"}
                </Button>
                <Button type="button" variant="outline" disabled={!taxIsSaved} onClick={() => printPayslip(slip)} className="font-bold" data-testid="salary-slip-print-button">
                  <Printer className="h-4 w-4" />Cetak / Simpan PDF
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">Rincian slip gaji belum dapat dimuat.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
