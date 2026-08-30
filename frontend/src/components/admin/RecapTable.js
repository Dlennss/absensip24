import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import api, { formatApiError, formatRupiah } from "@/lib/api";
import { Button } from "@/components/ui/button";
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

export default function RecapTable({ month, onMonthChange }) {
  const [recap, setRecap] = useState([]);
  const [rates, setRates] = useState({});

  const fetchRecap = useCallback(async () => {
    try {
      const { data } = await api.get("/recap", { params: { month } });
      setRecap(data);
      const map = {};
      data.forEach((r) => {
        map[r.name] = r.daily_rate || "";
      });
      setRates(map);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  }, [month]);

  useEffect(() => {
    fetchRecap();
  }, [fetchRecap]);

  const saveRate = async (name) => {
    try {
      await api.put("/rates", { name, daily_rate: Number(rates[name]) || 0 });
      toast.success(`Tarif gaji ${name} disimpan`);
      fetchRecap();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const totalDays = recap.reduce((s, r) => s + r.total_days, 0);
  const totalSalary = recap.reduce((s, r) => s + r.total_salary, 0);

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
        <div className="flex gap-6 text-sm">
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
              <TableHead>Total Hari Hadir</TableHead>
              <TableHead>Gaji per Hari (Rp)</TableHead>
              <TableHead>Total Gaji</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recap.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
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
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      data-testid={`recap-rate-input-${r.name}`}
                      value={rates[r.name] ?? ""}
                      onChange={(e) => setRates({ ...rates, [r.name]: e.target.value })}
                      className="w-36"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell className="font-semibold" data-testid={`recap-salary-${r.name}`}>
                    {formatRupiah((Number(rates[r.name]) || 0) * r.total_days)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`recap-save-rate-${r.name}`}
                      onClick={() => saveRate(r.name)}
                    >
                      <Save className="w-4 h-4 mr-2" strokeWidth={1.5} /> Simpan
                    </Button>
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
