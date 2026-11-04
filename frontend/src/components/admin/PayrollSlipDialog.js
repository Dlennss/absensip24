import { useEffect, useState } from "react";
import { Printer, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError, formatRupiah } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
    { label: "Gaji pokok", amount: slip.attendance_pay },
    ...slip.earnings,
  ];
  const deductionRows = [
    ...slip.deductions,
    { label: "Potongan Kasbon", amount: slip.cash_advance_deduction },
    { label: "Potongan Tidak Masuk Kerja", amount: slip.absence_deduction },
  ];
  const taxRow = { label: `PPh Pasal 21 · TER ${slip.pph21_category} (${slip.pph21_rate_percent}%)`, amount: slip.pph21_amount };
  const rows = (items) => items.map((item) => `
    <tr><td>${escapeHtml(item.label)}</td><td class="amount">${formatRupiah(item.amount)}</td></tr>
  `).join("");
  const absenceNotes = slip.absence_notes.length ? slip.absence_notes.join("; ") : "Tidak ada keterangan";

  printWindow.document.write(`<!doctype html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>Rincian Penghasilan Karyawan - ${escapeHtml(monthLabel(slip.month))}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #14211e; font: 14px Arial, sans-serif; }
          header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 2px solid #087f5b; }
          .company { margin-bottom: 8px; color: #087f5b; font-size: 13px; font-weight: 700; }
          h1 { max-width: 520px; margin: 0; font-size: 21px; line-height: 1.3; }
          .period { text-align: right; font-weight: 700; }
          .section-title { margin: 22px 0 8px; font-size: 13px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 9px 8px; border-bottom: 1px solid #e2e8f0; }
          .amount { width: 34%; text-align: right; white-space: nowrap; }
          .description td { color: #475569; line-height: 1.5; }
          .summary { margin-top: 18px; margin-left: auto; width: min(100%, 360px); }
          .summary td { border: 0; }
          .net td { border-top: 2px solid #087f5b; color: #087f5b; font-size: 17px; font-weight: 700; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <header>
          <div><div class="company">PT MITRA PULSA NASIONAL</div><h1>RINCIAN PENGHASILAN KARYAWAN</h1></div>
          <div class="period">Periode<br />${escapeHtml(monthLabel(slip.month))}</div>
        </header>
        <h2 class="section-title">Pendapatan</h2>
        <table><tbody>${rows(earningRows)}
          <tr><td><strong>Total pendapatan</strong></td><td class="amount"><strong>${formatRupiah(slip.gross_pay)}</strong></td></tr>
        </tbody></table>
        <h2 class="section-title">Potongan</h2>
        <table><tbody>${rows(deductionRows)}
          <tr class="description"><td colspan="2"><strong>Keterangan:</strong> ${escapeHtml(absenceNotes)}</td></tr>
          ${rows([taxRow])}
          <tr><td><strong>Total potongan</strong></td><td class="amount"><strong>${formatRupiah(slip.total_deductions)}</strong></td></tr>
        </tbody></table>
        <table class="summary"><tbody>
          <tr class="net"><td>Gaji bersih diterima</td><td class="amount">${formatRupiah(slip.net_pay)}</td></tr>
        </tbody></table>
        <script>window.addEventListener("load", () => window.print());</script>
      </body>
    </html>`);
  printWindow.document.close();
}

export default function PayrollSlipDialog({ marketing, month, onClose }) {
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!marketing || !month) return () => { active = false; };

    setLoading(true);
    setSlip(null);
    api.get(`/salary-slips/${marketing.id}`, { params: { month } })
      .then(({ data }) => {
        if (!active) return;
        setSlip(data);
      })
      .catch((error) => {
        if (active) toast.error(formatApiError(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [marketing, month]);

  return (
    <Dialog open={Boolean(marketing)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-lg" data-testid="salary-slip-dialog">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <span className="text-xs font-bold text-emerald-700">PT MITRA PULSA NASIONAL</span>
            <span className="flex items-center gap-2 text-base"><ReceiptText className="h-5 w-5 text-emerald-700" /> RINCIAN PENGHASILAN KARYAWAN</span>
          </DialogTitle>
          <DialogDescription>
            Periode {month ? monthLabel(month) : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Memuat rincian gaji...</p>
        ) : slip ? (
          <div className="space-y-5" data-testid="salary-slip-content">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <p className="text-sm font-semibold text-slate-700">Periode {monthLabel(slip.month)}</p>
              <span className={slip.pph21_recorded ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"}>
                {slip.pph21_recorded ? `TER ${slip.pph21_category} · PTKP ${slip.ptkp_status}` : slip.annual_reconciliation_required ? "Rekonsiliasi tahunan diperlukan" : `PTKP ${month.slice(0, 4)} belum diatur`}
              </span>
            </div>

            <section aria-labelledby="salary-slip-earnings-title">
              <h3 id="salary-slip-earnings-title" className="mb-2 text-sm font-extrabold text-slate-900">Pendapatan</h3>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <div className="flex justify-between gap-4 border-b border-slate-100 px-3 py-2.5 text-sm">
                  <span>Gaji pokok</span><span className="font-semibold tabular-nums">{formatRupiah(slip.attendance_pay)}</span>
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
                <div className="border-b border-slate-100 px-3 py-2.5 text-sm">
                  <span className="font-semibold">Potongan Kasbon</span>
                  <span className="float-right font-semibold tabular-nums">{formatRupiah(slip.cash_advance_deduction)}</span>
                </div>
                <div className="border-b border-slate-100 px-3 py-2.5 text-sm">
                  <span className="font-semibold">Potongan Tidak Masuk Kerja</span>
                  <span className="float-right font-semibold tabular-nums">{formatRupiah(slip.absence_deduction)}</span>
                </div>
                <div className="border-b border-slate-100 px-3 py-2.5 text-sm leading-6">
                  <strong>Keterangan:</strong> {slip.absence_notes.length ? slip.absence_notes.join("; ") : "Tidak ada keterangan"}
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-100 px-3 py-2.5 text-sm">
                  <span>{slip.pph21_recorded ? `PPh Pasal 21 · TER ${slip.pph21_category} (${slip.pph21_rate_percent}%)` : "PPh Pasal 21"}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{slip.pph21_recorded ? formatRupiah(slip.pph21_amount) : slip.annual_reconciliation_required ? "Hitung pajak tahunan" : "Atur status PTKP"}</span>
                </div>
                <div className="flex justify-between gap-4 bg-slate-50 px-3 py-3 text-sm font-extrabold">
                  <span>Total potongan</span><span className="tabular-nums">{formatRupiah(slip.total_deductions)}</span>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <div>
                <p className="text-xs font-semibold text-emerald-800">Gaji bersih diterima</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-emerald-800">{slip.net_pay === null ? "Belum final" : formatRupiah(slip.net_pay)}</p>
              </div>
              <p className="max-w-sm text-xs leading-5 text-emerald-900">{slip.pph21_recorded ? `PPh 21 otomatis: ${formatRupiah(slip.gross_pay)} × TER ${slip.pph21_category} ${slip.pph21_rate_percent}%.` : slip.annual_reconciliation_required ? "Untuk masa pajak Desember, hitung PPh 21 tahunan terlebih dahulu; slip belum difinalkan." : `Lengkapi status PTKP ${month.slice(0, 4)} di profil admin untuk menghitung pajak.`}</p>
            </div>

            {slip.annual_reconciliation_required && <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Periode Desember memerlukan rekonsiliasi PPh 21 setahun. Tarif TER bulanan tidak digunakan untuk menghitung potongan bulan ini.</p>}
            <div className="flex justify-end border-t border-slate-200 pt-4">
              <Button type="button" variant="outline" disabled={!slip.pph21_recorded} onClick={() => printPayslip(slip)} className="font-bold" data-testid="salary-slip-print-button">
                <Printer className="h-4 w-4" />Cetak / Simpan PDF
              </Button>
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">Rincian slip gaji belum dapat dimuat.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
