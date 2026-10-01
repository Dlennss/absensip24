import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Download, Eye, ImageOff, Minus, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import api, { API_BASE, formatApiError, formatRupiah, formatTanggal } from "@/lib/api";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BASE_SALARY = 4000000;
const WORKING_DAYS = 26;
const DAILY_RATE = BASE_SALARY / WORKING_DAYS;
const BACKEND_URL = API_BASE;

function monthLabel(month) {
  const [year, monthNumber] = month.split("-");
  return new Date(Number(year), Number(monthNumber) - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayNameId(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long" });
}

function getReportDays(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1);
  const lastDayOfMonth = new Date(year, monthNumber, 0);
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const lastDay = month === currentMonth ? today : lastDayOfMonth;
  const days = [];

  for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
    days.push(dateKey(date));
  }

  return days;
}

function photoUrl(path) {
  return path ? `${BACKEND_URL}${path}` : "";
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printMonthlyReport(title, dailyRecords, adjustments = []) {
  const presentDays = dailyRecords.filter((item) => item.attended).length;
  const adjustmentTotal = adjustments.reduce((sum, item) => sum + item.amount, 0);
  const finalTotal = presentDays * DAILY_RATE + adjustmentTotal;
  const rows = dailyRecords
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${formatTanggal(item.date)}</td>
          <td>${item.day_name}</td>
          <td>${item.attended ? "Hadir" : "Tidak absen"}</td>
          <td>${item.photo_url ? `<img src="${photoUrl(item.photo_url)}" alt="" />` : "Kosong"}</td>
          <td>${item.attended ? formatRupiah(DAILY_RATE) : formatRupiah(0)}</td>
        </tr>
      `
    )
    .join("");
  const adjustmentRows = adjustments
    .map(
      (item) => `
        <tr>
          <td>${item.note || (item.amount > 0 ? "Tambahan gaji" : "Pengurangan gaji")}</td>
          <td>${formatRupiah(item.amount)}</td>
        </tr>
      `
    )
    .join("");
  const printWindow = window.open("", "_blank", "width=1000,height=700");
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
          h1 { font-size: 22px; margin: 0 0 8px; }
          p { margin: 0 0 20px; color: #475569; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; }
          img { max-width: 180px; max-height: 180px; object-fit: contain; }
          .muted { color: #64748b; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Total hadir: ${presentDays} hari - gaji hadir ${formatRupiah(presentDays * DAILY_RATE)} - penyesuaian ${formatRupiah(adjustmentTotal)} - total akhir ${formatRupiah(finalTotal)}</p>
        <table>
          <thead>
            <tr><th>No</th><th>Tanggal</th><th>Hari</th><th>Status</th><th>Foto</th><th>Gaji</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${
          adjustments.length
            ? `<h1 style="margin-top:24px">Penyesuaian Gaji</h1><table><thead><tr><th>Catatan</th><th>Nominal</th></tr></thead><tbody>${adjustmentRows}</tbody></table>`
            : ""
        }
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function RecapTable({
  month,
  onMonthChange,
  showMonthPicker = true,
  includeAllMarketing = false,
  emptyMessage = "Tidak ada rekap yang cocok.",
}) {
  const [recap, setRecap] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [marketing, setMarketing] = useState([]);
  const [salaryAdjustments, setSalaryAdjustments] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedRecap, setSelectedRecap] = useState(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [editingAdjustment, setEditingAdjustment] = useState(null);

  const fetchRecap = useCallback(async () => {
    try {
      const requests = [
        api.get("/recap", { params: { month } }),
        api.get("/attendance", { params: { month } }),
        api.get("/salary-adjustments", { params: { month } }),
      ];
      if (includeAllMarketing) requests.push(api.get("/marketing"));
      const [recapResponse, attendanceResponse, adjustmentResponse, marketingResponse] = await Promise.all(requests);
      setRecap(recapResponse.data);
      setAttendance(attendanceResponse.data);
      setSalaryAdjustments(adjustmentResponse.data);
      if (marketingResponse) setMarketing(marketingResponse.data);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  }, [includeAllMarketing, month]);

  useEffect(() => {
    fetchRecap();
  }, [fetchRecap]);

  const attendanceByName = useMemo(
    () => {
      const map = attendance.reduce((acc, item) => {
        const key = item.name.toLowerCase();
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {});
      Object.values(map).forEach((records) => records.sort((a, b) => a.date.localeCompare(b.date)));
      return map;
    },
    [attendance]
  );

  const adjustmentByName = useMemo(
    () =>
      salaryAdjustments.reduce((map, item) => {
        const key = item.name.toLowerCase();
        if (!map[key]) map[key] = { total: 0, items: [] };
        map[key].total += item.amount;
        map[key].items.push(item);
        return map;
      }, {}),
    [salaryAdjustments]
  );

  const filteredRecap = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const source = includeAllMarketing
      ? marketing.map((item) => {
          const existing = recap.find((r) => r.name.toLowerCase() === item.name.toLowerCase());
          return existing || {
            name: item.name,
            total_days: 0,
            daily_rate: DAILY_RATE,
            total_salary: 0,
          };
        })
      : recap;
    if (!keyword) return source;
    return source.filter((item) => item.name.toLowerCase().includes(keyword));
  }, [includeAllMarketing, marketing, recap, search]);

  const selectedRecords = useMemo(
    () => (selectedRecap ? attendanceByName[selectedRecap.name.toLowerCase()] || [] : []),
    [attendanceByName, selectedRecap]
  );
  const selectedAdjustments = useMemo(
    () => (selectedRecap ? adjustmentByName[selectedRecap.name.toLowerCase()]?.items || [] : []),
    [adjustmentByName, selectedRecap]
  );
  const selectedAdjustmentTotal = selectedAdjustments.reduce((sum, item) => sum + item.amount, 0);
  const selectedDailyRecords = useMemo(() => {
    if (!selectedRecap) return [];
    const recordByDate = selectedRecords.reduce((map, item) => {
      map[item.date] = item;
      return map;
    }, {});

    return getReportDays(month).map((date) => {
      const record = recordByDate[date];
      return {
        id: record?.id || `${selectedRecap.name}-${date}`,
        name: selectedRecap.name,
        date,
        day_name: record?.day_name || dayNameId(date),
        photo_url: record?.photo_url || null,
        attended: Boolean(record),
      };
    });
  }, [month, selectedRecap, selectedRecords]);
  const selectedPresentDays = selectedDailyRecords.filter((item) => item.attended).length;
  const selectedBaseSalary = selectedPresentDays * DAILY_RATE;
  const selectedFinalSalary = selectedBaseSalary + selectedAdjustmentTotal;
  const selectedTitle = selectedRecap
    ? `Rekap ${selectedRecap.name} - ${monthLabel(month)}`
    : `Rekap ${monthLabel(month)}`;

  const resetAdjustmentForm = () => {
    setAdjustmentAmount("");
    setAdjustmentNote("");
    setEditingAdjustment(null);
  };

  const saveAdjustment = async (sign = 1) => {
    if (!selectedRecap) return;
    const rawAmount = Number(adjustmentAmount);
    if (!rawAmount || Number.isNaN(rawAmount)) {
      toast.error("Nominal gaji wajib diisi");
      return;
    }
    const amount = editingAdjustment ? rawAmount : Math.abs(rawAmount) * sign;
    try {
      if (editingAdjustment) {
        await api.put(`/salary-adjustments/${editingAdjustment.id}`, {
          name: selectedRecap.name,
          month,
          amount,
          note: adjustmentNote,
        });
        toast.success("Penyesuaian gaji diperbarui");
      } else {
        await api.post("/salary-adjustments", {
          name: selectedRecap.name,
          month,
          amount,
          note: adjustmentNote,
        });
        toast.success(amount > 0 ? "Tambahan gaji disimpan" : "Pengurangan gaji disimpan");
      }
      resetAdjustmentForm();
      fetchRecap();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const startEditAdjustment = (item) => {
    setEditingAdjustment(item);
    setAdjustmentAmount(String(item.amount));
    setAdjustmentNote(item.note || "");
  };

  const deleteAdjustment = async (item) => {
    if (!window.confirm("Hapus penyesuaian gaji ini?")) return;
    try {
      await api.delete(`/salary-adjustments/${item.id}`);
      toast.success("Penyesuaian gaji dihapus");
      if (editingAdjustment?.id === item.id) resetAdjustmentForm();
      fetchRecap();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const buildDailyRecords = useCallback(
    (name) => {
      const records = attendanceByName[name.toLowerCase()] || [];
      const recordByDate = records.reduce((map, item) => {
        map[item.date] = item;
        return map;
      }, {});

      return getReportDays(month).map((date) => {
        const record = recordByDate[date];
        return {
          id: record?.id || `${name}-${date}`,
          name,
          date,
          day_name: record?.day_name || dayNameId(date),
          photo_url: record?.photo_url || null,
          attended: Boolean(record),
        };
      });
    },
    [attendanceByName, month]
  );

  const exportRecords = (records, filenameName = "semua-marketing") => {
    const rows = [
      ["Nama Marketing", "Tanggal", "Hari", "Status", "Foto", "Gaji"],
      ...records.map((item) => [
        item.name,
        formatTanggal(item.date),
        item.day_name,
        item.attended === false ? "Tidak absen" : "Hadir",
        photoUrl(item.photo_url),
        item.attended === false ? 0 : Math.round(DAILY_RATE),
      ]),
    ];
    downloadCsv(`rekap-${filenameName}-${month}.csv`, rows);
  };

  const exportSelectedRecords = () => {
    const filenameName = selectedRecap?.name?.toLowerCase().replaceAll(" ", "-") || "marketing";
    const rows = [
      ["Nama Marketing", "Tanggal", "Hari", "Status", "Foto", "Gaji"],
      ...selectedDailyRecords.map((item) => [
        item.name,
        formatTanggal(item.date),
        item.day_name,
        item.attended ? "Hadir" : "Tidak absen",
        photoUrl(item.photo_url),
        item.attended ? Math.round(DAILY_RATE) : 0,
      ]),
      [],
      ["Penyesuaian Gaji"],
      ["Catatan", "Nominal"],
      ...selectedAdjustments.map((item) => [
        item.note || (item.amount > 0 ? "Tambahan gaji" : "Pengurangan gaji"),
        item.amount,
      ]),
      [],
      ["Total Hari Hadir", selectedPresentDays],
      ["Gaji Hadir", Math.round(selectedBaseSalary)],
      ["Total Penyesuaian", selectedAdjustmentTotal],
      ["Total Akhir", Math.round(selectedFinalSalary)],
    ];
    downloadCsv(`rekap-${filenameName}-${month}.csv`, rows);
  };

  return (
    <div data-testid="recap-table-section">
      <div className="mb-6 grid gap-4 lg:grid-cols-[220px_minmax(240px,1fr)_auto] lg:items-end">
        {showMonthPicker ? (
          <div className="space-y-2">
            <Label htmlFor="recap-month" className="text-sm font-bold text-slate-900">
              Bulan
            </Label>
            <Input
              id="recap-month"
              type="month"
              data-testid="recap-month-input"
              value={month}
              onChange={(e) => onMonthChange(e.target.value)}
              className="h-10 rounded-lg border-slate-200 bg-white shadow-none"
            />
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="block text-xs font-medium text-slate-500">Bulan Berjalan</span>
            <span className="mt-1 block font-extrabold text-slate-950">{monthLabel(month)}</span>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="recap-search" className="text-sm font-bold text-slate-900">
            Cari Marketing
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.7} />
            <Input
              id="recap-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama marketing"
              className="h-10 rounded-lg border-slate-200 bg-white pl-9 shadow-none"
              data-testid="recap-search-input"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              exportRecords(
                includeAllMarketing ? filteredRecap.flatMap((item) => buildDailyRecords(item.name)) : attendance,
                "semua-marketing"
              )
            }
            className="h-10 rounded-lg border-slate-200 bg-white font-bold"
            data-testid="recap-export-all-button"
          >
            <Download className="h-4 w-4" strokeWidth={1.7} />
            Excel
          </Button>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm" data-testid="recap-formula">
        <span className="block text-xs font-medium text-slate-500">Rumus</span>
        <span className="mt-1 block font-bold leading-6 text-slate-900">
          {formatRupiah(BASE_SALARY)} / {WORKING_DAYS} hari = {formatRupiah(DAILY_RATE)}/hari
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table className="min-w-[780px]" data-testid="recap-table">
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Nama Marketing</TableHead>
              <TableHead>Total Hari Masuk</TableHead>
              <TableHead>Gaji per Hari</TableHead>
              <TableHead>Total Gaji</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecap.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-slate-500"
                  data-testid="recap-empty-state"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              filteredRecap.map((r) => {
                const records = attendanceByName[r.name.toLowerCase()] || [];
                const adjustmentTotal = adjustmentByName[r.name.toLowerCase()]?.total || 0;
                const totalSalary = r.total_days * DAILY_RATE + adjustmentTotal;
                return (
                  <TableRow className="hover:bg-emerald-50/40" key={r.name} data-testid={`recap-row-${r.name}`}>
                    <TableCell className="font-bold text-slate-900">{r.name}</TableCell>
                    <TableCell className="text-slate-600" data-testid={`recap-days-${r.name}`}>
                      {r.total_days} hari
                    </TableCell>
                    <TableCell className="text-slate-600" data-testid={`recap-rate-${r.name}`}>
                      {formatRupiah(DAILY_RATE)}
                    </TableCell>
                    <TableCell className="font-extrabold text-emerald-700" data-testid={`recap-salary-${r.name}`}>
                      {formatRupiah(totalSalary)}
                    </TableCell>
                    <TableCell className="text-right">
                      {records.length > 0 || includeAllMarketing ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setSelectedRecap(r)}
                          className="rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                          title="Lihat dan kelola gaji"
                          aria-label={`Lihat dan kelola gaji ${r.name}`}
                          data-testid={`recap-view-monthly-button-${r.name}`}
                        >
                          <Eye className="h-4 w-4" strokeWidth={1.7} />
                        </Button>
                      ) : (
                        <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-400">
                          <ImageOff className="h-4 w-4" strokeWidth={1.7} />
                          Tidak ada foto
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!selectedRecap}
        onOpenChange={() => {
          setSelectedRecap(null);
          resetAdjustmentForm();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto rounded-lg border-slate-200" data-testid="monthly-recap-dialog">
          <DialogHeader>
            <DialogTitle>{selectedTitle}</DialogTitle>
            <DialogDescription>
              {selectedPresentDays} hari hadir, gaji hadir {formatRupiah(selectedBaseSalary)}, penyesuaian{" "}
              {formatRupiah(selectedAdjustmentTotal)}, total akhir {formatRupiah(selectedFinalSalary)}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={exportSelectedRecords}
              className="rounded-lg border-slate-200 bg-white font-bold"
              data-testid="monthly-export-button"
            >
              <Download className="h-4 w-4" strokeWidth={1.7} />
              Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => printMonthlyReport(selectedTitle, selectedDailyRecords, selectedAdjustments)}
              className="rounded-lg border-slate-200 bg-white font-bold"
              data-testid="monthly-print-button"
            >
              <Printer className="h-4 w-4" strokeWidth={1.7} />
              Print / PDF
            </Button>
          </div>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex flex-col gap-1">
              <h3 className="text-sm font-extrabold text-slate-950">Penyesuaian Gaji</h3>
              <p className="text-xs font-medium text-slate-500">
                Tambahkan bonus atau potongan tanpa mengubah data absensi.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[180px_minmax(220px,1fr)_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="salary-adjustment-amount" className="text-xs font-bold text-slate-700">
                  Nominal
                </Label>
                <Input
                  id="salary-adjustment-amount"
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  placeholder="Contoh: 50000"
                  className="h-10 rounded-lg border-slate-200 bg-white"
                  data-testid="salary-adjustment-amount-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary-adjustment-note" className="text-xs font-bold text-slate-700">
                  Catatan
                </Label>
                <Input
                  id="salary-adjustment-note"
                  value={adjustmentNote}
                  onChange={(e) => setAdjustmentNote(e.target.value)}
                  placeholder="Contoh: bonus target / kasbon"
                  className="h-10 rounded-lg border-slate-200 bg-white"
                  data-testid="salary-adjustment-note-input"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {editingAdjustment ? (
                  <>
                    <Button
                      type="button"
                      onClick={() => saveAdjustment()}
                      className="h-10 rounded-lg bg-emerald-600 font-bold hover:bg-emerald-700"
                      data-testid="salary-adjustment-save-edit-button"
                    >
                      Simpan
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetAdjustmentForm}
                      className="h-10 rounded-lg border-slate-200 bg-white font-bold"
                    >
                      Batal
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      onClick={() => saveAdjustment(1)}
                      className="h-10 rounded-lg bg-emerald-600 font-bold hover:bg-emerald-700"
                      data-testid="salary-adjustment-add-button"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.7} />
                      Tambah
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => saveAdjustment(-1)}
                      className="h-10 rounded-lg border-red-200 bg-white font-bold text-red-700 hover:bg-red-50"
                      data-testid="salary-adjustment-subtract-button"
                    >
                      <Minus className="h-4 w-4" strokeWidth={1.7} />
                      Kurangi
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <Table className="min-w-[620px]" data-testid="salary-adjustments-table">
                <TableHeader>
                  <TableRow className="bg-white hover:bg-white">
                    <TableHead>Catatan</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedAdjustments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-slate-500">
                        Belum ada tambahan atau pengurangan gaji.
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedAdjustments.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold text-slate-700">
                          {item.note || (item.amount > 0 ? "Tambahan gaji" : "Pengurangan gaji")}
                        </TableCell>
                        <TableCell className={item.amount >= 0 ? "font-bold text-emerald-700" : "font-bold text-red-700"}>
                          {formatRupiah(item.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={() => startEditAdjustment(item)}
                              className="rounded-lg border-slate-200 bg-white"
                              title="Edit penyesuaian"
                              aria-label="Edit penyesuaian"
                            >
                              <Pencil className="h-4 w-4" strokeWidth={1.7} />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={() => deleteAdjustment(item)}
                              className="rounded-lg border-slate-200 bg-white"
                              title="Hapus penyesuaian"
                              aria-label="Hapus penyesuaian"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" strokeWidth={1.7} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedDailyRecords.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{formatTanggal(item.date)}</p>
                      <p className="text-sm text-slate-500">{item.day_name}</p>
                    </div>
                    <span
                      className={
                        item.attended
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
                          : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500"
                      }
                    >
                      {item.attended ? "Hadir" : "Kosong"}
                    </span>
                  </div>
                </div>
                {item.photo_url ? (
                  <img
                    src={photoUrl(item.photo_url)}
                    alt={`Foto absensi ${item.name} ${formatTanggal(item.date)}`}
                    className="h-64 w-full bg-slate-50 object-contain"
                    data-testid={`monthly-photo-${item.id}`}
                  />
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center gap-3 bg-slate-50 text-sm font-semibold text-slate-400">
                    <ImageOff className="h-7 w-7" strokeWidth={1.7} />
                    Tidak absen, foto kosong
                  </div>
                )}
                <div className="border-t border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">
                  Gaji hari ini: {item.attended ? formatRupiah(DAILY_RATE) : formatRupiah(0)}
                </div>
              </article>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
