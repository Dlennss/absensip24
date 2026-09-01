import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Download, Eye, ImageOff, Printer, Search } from "lucide-react";
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

function printMonthlyReport(title, dailyRecords) {
  const presentDays = dailyRecords.filter((item) => item.attended).length;
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
        <p>Total hadir: ${presentDays} hari - Total gaji: ${formatRupiah(presentDays * DAILY_RATE)}</p>
        <table>
          <thead>
            <tr><th>No</th><th>Tanggal</th><th>Hari</th><th>Status</th><th>Foto</th><th>Gaji</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function RecapTable({ month, onMonthChange }) {
  const [recap, setRecap] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedRecap, setSelectedRecap] = useState(null);

  const fetchRecap = useCallback(async () => {
    try {
      const [recapResponse, attendanceResponse] = await Promise.all([
        api.get("/recap", { params: { month } }),
        api.get("/attendance", { params: { month } }),
      ]);
      setRecap(recapResponse.data);
      setAttendance(attendanceResponse.data);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  }, [month]);

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

  const filteredRecap = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return recap;
    return recap.filter((item) => item.name.toLowerCase().includes(keyword));
  }, [recap, search]);

  const selectedRecords = useMemo(
    () => (selectedRecap ? attendanceByName[selectedRecap.name.toLowerCase()] || [] : []),
    [attendanceByName, selectedRecap]
  );
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
  const selectedTitle = selectedRecap
    ? `Rekap ${selectedRecap.name} - ${monthLabel(month)}`
    : `Rekap ${monthLabel(month)}`;

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

  return (
    <div data-testid="recap-table-section">
      <div className="mb-6 grid gap-4 lg:grid-cols-[220px_minmax(240px,1fr)_auto] lg:items-end">
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
            onClick={() => exportRecords(attendance, "semua-marketing")}
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
                  Tidak ada rekap yang cocok.
                </TableCell>
              </TableRow>
            ) : (
              filteredRecap.map((r) => {
                const records = attendanceByName[r.name.toLowerCase()] || [];
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
                      {formatRupiah(r.total_days * DAILY_RATE)}
                    </TableCell>
                    <TableCell className="text-right">
                      {records.length > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedRecap(r)}
                          className="rounded-lg border-slate-200 bg-white font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                          data-testid={`recap-view-monthly-button-${r.name}`}
                        >
                          <Eye className="h-4 w-4" strokeWidth={1.7} />
                          Rekap Bulanan
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

      <Dialog open={!!selectedRecap} onOpenChange={() => setSelectedRecap(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto rounded-lg border-slate-200" data-testid="monthly-recap-dialog">
          <DialogHeader>
            <DialogTitle>{selectedTitle}</DialogTitle>
            <DialogDescription>
              {selectedPresentDays} hari hadir, total gaji {formatRupiah(selectedPresentDays * DAILY_RATE)}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => exportRecords(selectedDailyRecords, selectedRecap?.name?.toLowerCase().replaceAll(" ", "-"))}
              className="rounded-lg border-slate-200 bg-white font-bold"
              data-testid="monthly-export-button"
            >
              <Download className="h-4 w-4" strokeWidth={1.7} />
              Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => printMonthlyReport(selectedTitle, selectedDailyRecords)}
              className="rounded-lg border-slate-200 bg-white font-bold"
              data-testid="monthly-print-button"
            >
              <Printer className="h-4 w-4" strokeWidth={1.7} />
              Print / PDF
            </Button>
          </div>

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
