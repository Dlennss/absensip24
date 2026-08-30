import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import api, { formatApiError, formatRupiah } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function RecapTable({ month, onMonthChange }) {
  const [recap, setRecap] = useState([]);

  const fetchRecap = useCallback(async () => {
    try {
      const { data } = await api.get("/recap", { params: { month } });
      setRecap(data);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  }, [month]);

  useEffect(() => {
    fetchRecap();
  }, [fetchRecap]);

  const totalDays = recap.reduce((s, r) => s + r.total_days, 0);
  const totalSalary = recap.reduce((s, r) => s + r.total_days * DAILY_RATE, 0);

  return (
    <div data-testid="recap-table-section">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Label htmlFor="recap-month" className="text-sm font-semibold whitespace-nowrap">
            Bulan
          </Label>
          <Input
            id="recap-month"
            type="month"
            data-testid="recap-month-input"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <div data-testid="recap-formula">
            <span className="text-muted-foreground">Rumus: </span>
            <span className="font-semibold">
              {formatRupiah(BASE_SALARY)} ÷ {WORKING_DAYS} hari = {formatRupiah(DAILY_RATE)}/hari
            </span>
          </div>
          <div data-testid="recap-total-days">
            <span className="text-muted-foreground">Total Hari Hadir: </span>
            <span className="font-semibold">{totalDays} hari</span>
          </div>
          <div data-testid="recap-total-salary">
            <span className="text-muted-foreground">Total Gaji: </span>
            <span className="font-semibold text-primary">{formatRupiah(totalSalary)}</span>
          </div>
        </div>
      </div>

      <div className="border border-border bg-card">
        <Table data-testid="recap-table">
          <TableHeader>
            <TableRow>
              <TableHead>Nama Karyawan</TableHead>
              <TableHead>Total Hari Masuk</TableHead>
              <TableHead>Gaji per Hari</TableHead>
              <TableHead>Total Gaji</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recap.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-10"
                  data-testid="recap-empty-state"
                >
                  Belum ada data absensi pada bulan ini.
                </TableCell>
              </TableRow>
            ) : (
              recap.map((r) => (
                <TableRow key={r.name} data-testid={`recap-row-${r.name}`}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell data-testid={`recap-days-${r.name}`}>{r.total_days} hari</TableCell>
                  <TableCell data-testid={`recap-rate-${r.name}`}>
                    {formatRupiah(DAILY_RATE)}
                  </TableCell>
                  <TableCell className="font-semibold" data-testid={`recap-salary-${r.name}`}>
                    {formatRupiah(r.total_days * DAILY_RATE)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
