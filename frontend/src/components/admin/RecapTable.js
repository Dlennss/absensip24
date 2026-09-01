import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Eye, ImageOff } from "lucide-react";
import api, { API_BASE, formatApiError, formatRupiah } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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

export default function RecapTable({ month, onMonthChange }) {
  const [recap, setRecap] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [photoPreview, setPhotoPreview] = useState(null);

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

  const totalDays = recap.reduce((s, r) => s + r.total_days, 0);
  const totalSalary = recap.reduce((s, r) => s + r.total_days * DAILY_RATE, 0);
  const latestPhotoByName = attendance.reduce((map, item) => {
    if (!item.photo_url) return map;
    const key = item.name.toLowerCase();
    if (!map[key] || item.date > map[key].date) {
      map[key] = item;
    }
    return map;
  }, {});

  return (
    <div data-testid="recap-table-section">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Label htmlFor="recap-month" className="whitespace-nowrap text-sm font-bold text-slate-900">
            Bulan
          </Label>
          <Input
            id="recap-month"
            type="month"
            data-testid="recap-month-input"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="h-10 rounded-lg border-slate-200 bg-white shadow-none sm:w-44"
          />
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[720px]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" data-testid="recap-formula">
            <span className="block text-xs font-medium text-slate-500">Rumus</span>
            <span className="mt-1 block font-bold leading-6 text-slate-900">
              {formatRupiah(BASE_SALARY)} ÷ {WORKING_DAYS} hari = {formatRupiah(DAILY_RATE)}/hari
            </span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" data-testid="recap-total-days">
            <span className="block text-xs font-medium text-slate-500">Total Hari Hadir</span>
            <span className="mt-1 block text-xl font-extrabold text-slate-950">{totalDays} hari</span>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4" data-testid="recap-total-salary">
            <span className="block text-xs font-medium text-emerald-700">Total Gaji</span>
            <span className="mt-1 block text-xl font-extrabold text-emerald-800">{formatRupiah(totalSalary)}</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table className="min-w-[780px]" data-testid="recap-table">
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Nama Karyawan</TableHead>
              <TableHead>Total Hari Masuk</TableHead>
              <TableHead>Gaji per Hari</TableHead>
              <TableHead>Total Gaji</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recap.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-slate-500"
                  data-testid="recap-empty-state"
                >
                  Belum ada data absensi pada bulan ini.
                </TableCell>
              </TableRow>
            ) : (
              recap.map((r) => (
                <TableRow className="hover:bg-emerald-50/40" key={r.name} data-testid={`recap-row-${r.name}`}>
                  <TableCell className="font-bold text-slate-900">{r.name}</TableCell>
                  <TableCell className="text-slate-600" data-testid={`recap-days-${r.name}`}>{r.total_days} hari</TableCell>
                  <TableCell className="text-slate-600" data-testid={`recap-rate-${r.name}`}>
                    {formatRupiah(DAILY_RATE)}
                  </TableCell>
                  <TableCell className="font-extrabold text-emerald-700" data-testid={`recap-salary-${r.name}`}>
                    {formatRupiah(r.total_days * DAILY_RATE)}
                  </TableCell>
                  <TableCell className="text-right">
                    {latestPhotoByName[r.name.toLowerCase()] ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPhotoPreview(latestPhotoByName[r.name.toLowerCase()])}
                        className="rounded-lg border-slate-200 bg-white font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                        data-testid={`recap-view-photo-button-${r.name}`}
                      >
                        <Eye className="h-4 w-4" strokeWidth={1.7} />
                        Lihat Foto
                      </Button>
                    ) : (
                      <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-400">
                        <ImageOff className="h-4 w-4" strokeWidth={1.7} />
                        Tidak ada foto
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!photoPreview} onOpenChange={() => setPhotoPreview(null)}>
        <DialogContent className="max-w-3xl rounded-lg border-slate-200 p-3 sm:p-4" data-testid="recap-photo-preview-dialog">
          {photoPreview?.photo_url && (
            <img
              src={`${BACKEND_URL}${photoPreview.photo_url}`}
              alt=""
              className="max-h-[82vh] w-full rounded-md object-contain"
              data-testid="recap-photo-preview-image"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
