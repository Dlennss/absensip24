import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Lock, LogIn, Mail } from "lucide-react";
import { API, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password });
      localStorage.setItem("admin_token", data.access_token);
      toast.success("Login berhasil");
      navigate("/admin");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_28rem),linear-gradient(135deg,#f8fafc_0%,#eef6f4_52%,#fff7ed_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-lg border border-white/80 bg-white/90 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8" data-testid="admin-login-page">
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                Area Admin
              </p>
              <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-normal text-slate-950 sm:text-4xl" data-testid="admin-login-title">
                Masuk Admin
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Gunakan akun admin untuk membuka dashboard rekap absensi.
              </p>
            </div>
            <form
              onSubmit={handleLogin}
              className="space-y-5"
              data-testid="admin-login-form"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Mail className="h-4 w-4 text-emerald-700" strokeWidth={1.7} /> Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="admin-email-input"
                  placeholder="admin@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-lg border-slate-200 bg-white px-4 shadow-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Lock className="h-4 w-4 text-emerald-700" strokeWidth={1.7} /> Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  data-testid="admin-password-input"
                  placeholder="Password admin"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-lg border-slate-200 bg-white px-4 shadow-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>
              <Button
                type="submit"
                data-testid="admin-login-button"
                disabled={loading}
                className="h-12 w-full rounded-lg bg-emerald-600 text-base font-bold shadow-lg shadow-emerald-900/15 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-700"
              >
                <LogIn className="mr-1 h-5 w-5" strokeWidth={1.7} />
                {loading ? "Memproses..." : "Masuk"}
              </Button>
            </form>
            <p className="mt-6 text-center">
              <a
                href="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors duration-200 hover:text-emerald-700"
                data-testid="back-to-attendance-link"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
                Kembali ke halaman absensi
              </a>
            </p>
        </div>
      </div>
    </div>
  );
}
