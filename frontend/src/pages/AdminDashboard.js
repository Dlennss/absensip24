import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LayoutDashboard, LogOut } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AttendanceTable from "@/components/admin/AttendanceTable";
import RecapTable from "@/components/admin/RecapTable";

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
      <div className="min-h-screen flex items-center justify-center" data-testid="admin-loading">
        <p className="text-muted-foreground text-sm">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="admin-dashboard">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-5 h-5 text-primary" strokeWidth={1.5} />
            <div>
              <h1 className="text-xl font-bold tracking-tight" data-testid="admin-dashboard-title">
                Dashboard Absensi
              </h1>
              <p className="text-xs text-muted-foreground">Masuk sebagai {adminName}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            data-testid="admin-logout-button"
            onClick={handleLogout}
            className="hover:-translate-y-[2px] transition-transform duration-200 ease-out"
          >
            <LogOut className="w-4 h-4 mr-2" strokeWidth={1.5} /> Keluar
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="data">
          <TabsList data-testid="admin-tabs">
            <TabsTrigger value="data" data-testid="tab-data-absensi">
              Data Absensi
            </TabsTrigger>
            <TabsTrigger value="recap" data-testid="tab-rekap-gaji">
              Rekap & Gaji
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
        </Tabs>
      </main>
    </div>
  );
}
