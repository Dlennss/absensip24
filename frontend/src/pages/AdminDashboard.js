import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, LayoutDashboard, LogOut, UsersRound } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AttendanceTable from "@/components/admin/AttendanceTable";
import RecapTable from "@/components/admin/RecapTable";
import MarketingTable from "@/components/admin/MarketingTable";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [adminName, setAdminName] = useState("Admin");
  const [attendance, setAttendance] = useState([]);
  const [month, setMonth] = useState(() =>
    new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }).slice(0, 7)
  );

  const fetchAttendance = useCallback(async () => {
    try {
      const { data } = await api.get("/attendance", { params: { month } });
      setAttendance(data);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  }, [month]);

  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await api.get("/auth/me");
        setAdminName(data.name || "Admin");
        setChecking(false);
      } catch {
        localStorage.removeItem("admin_token");
        navigate("/admin/login");
      }
    };
    check();
  }, [navigate]);

  useEffect(() => {
    if (!checking) fetchAttendance();
  }, [checking, fetchAttendance]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    toast.success("Berhasil keluar");
    navigate("/admin/login");
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" data-testid="admin-loading">
        <p className="text-sm font-medium text-slate-500">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="admin-dashboard">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <LayoutDashboard className="h-5 w-5" strokeWidth={1.7} />
            </span>
            <div>
              <h1 className="truncate text-lg font-extrabold tracking-normal text-slate-950 sm:text-xl" data-testid="admin-dashboard-title">
                Dashboard Absensi
              </h1>
              <p className="text-xs font-medium text-slate-500">Masuk sebagai {adminName}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            data-testid="admin-logout-button"
            onClick={handleLogout}
            className="shrink-0 rounded-lg border-slate-200 bg-white font-semibold transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4 sm:mr-1" strokeWidth={1.7} />
            <span className="hidden sm:inline">Keluar</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Data bulan ini</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-950">{attendance.length}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <UsersRound className="h-5 w-5" strokeWidth={1.7} />
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <CalendarDays className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-500">Periode aktif</p>
                <p className="mt-1 text-lg font-extrabold text-slate-950">{month}</p>
              </div>
            </div>
          </div>
        </section>

        <Tabs defaultValue="data" className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-lg bg-slate-100 p-1 sm:w-fit" data-testid="admin-tabs">
            <TabsTrigger className="rounded-md px-4 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-700" value="data" data-testid="tab-data-absensi">
              Data Absensi
            </TabsTrigger>
            <TabsTrigger className="rounded-md px-4 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-700" value="recap" data-testid="tab-rekap-gaji">
              Rekap & Gaji
            </TabsTrigger>
            <TabsTrigger className="rounded-md px-4 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-700" value="marketing" data-testid="tab-marketing">
              Marketing
            </TabsTrigger>
          </TabsList>
          <TabsContent value="data" className="mt-6">
            <AttendanceTable
              attendance={attendance}
              month={month}
              onMonthChange={setMonth}
              onRefresh={fetchAttendance}
            />
          </TabsContent>
          <TabsContent value="recap" className="mt-6">
            <RecapTable month={month} onMonthChange={setMonth} />
          </TabsContent>
          <TabsContent value="marketing" className="mt-6">
            <MarketingTable />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
