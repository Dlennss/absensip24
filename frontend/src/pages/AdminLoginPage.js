import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Lock, LogIn, Mail, UserRound } from "lucide-react";
import { API, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const role = searchParams.get("role") === "marketing" ? "marketing" : "admin";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const isMarketing = role === "marketing";
      const endpoint = isMarketing ? "/marketing/auth/login" : "/auth/login";
      const body = isMarketing
        ? { username: identifier.trim(), password }
        : { email: identifier.trim(), password };
      const { data } = await axios.post(`${API}${endpoint}`, body);
      if (isMarketing) {
        localStorage.removeItem("admin_token");
        localStorage.setItem("marketing_token", data.access_token);
        navigate("/marketing");
      } else {
        localStorage.removeItem("marketing_token");
        localStorage.setItem("admin_token", data.access_token);
        navigate("/admin");
      }
      toast.success("Login berhasil");
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const selectRole = (nextRole) => {
    setIdentifier("");
    setPassword("");
    setSearchParams(nextRole === "admin" ? {} : { role: nextRole });
  };
  const isMarketing = role === "marketing";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_28rem),linear-gradient(135deg,#f8fafc_0%,#eef6f4_52%,#fff7ed_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-lg border border-white/80 bg-white/90 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8" data-testid="admin-login-page">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Login</p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight text-slate-950 sm:text-4xl">Masuk</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Pilih jenis akun untuk melanjutkan.</p>
          </div>

          <div role="group" aria-label="Jenis akun" className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            {["admin", "marketing"].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={role === value}
                onClick={() => selectRole(value)}
                className={`h-10 rounded-md px-3 text-sm font-semibold transition-colors ${role === value ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-950"}`}
              >
                {value === "admin" ? "Admin" : "Marketing"}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-5" data-testid="admin-login-form">
            <div className="space-y-2">
              <Label htmlFor="login-identifier" className="flex items-center gap-2 text-sm font-bold text-slate-900">
                {isMarketing ? <UserRound className="h-4 w-4 text-emerald-700" /> : <Mail className="h-4 w-4 text-emerald-700" />}
                {isMarketing ? "Username" : "Email"}
              </Label>
              <Input
                id="login-identifier"
                type={isMarketing ? "text" : "email"}
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
                maxLength={isMarketing ? 40 : undefined}
                placeholder={isMarketing ? "Username marketing" : "admin@email.com"}
                className="h-12 rounded-lg border-slate-200 bg-white px-4 shadow-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password" className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Lock className="h-4 w-4 text-emerald-700" />Password
              </Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="h-12 rounded-lg border-slate-200 bg-white px-4 shadow-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
            <Button type="submit" disabled={loading} className="h-12 w-full rounded-lg bg-emerald-600 text-base font-bold shadow-lg shadow-emerald-900/15 hover:bg-emerald-700">
              <LogIn className="mr-1 h-5 w-5" />{loading ? "Memproses..." : "Masuk"}
            </Button>
          </form>

          <Link to="/" className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-700">
            <ArrowLeft className="h-4 w-4" />Kembali ke halaman absensi
          </Link>
        </section>
      </div>
    </div>
  );
}
