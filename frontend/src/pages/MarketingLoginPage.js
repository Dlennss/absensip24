import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Lock, LogIn, UserRound } from "lucide-react";
import { API, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MarketingLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API}/marketing/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw { response: { status: response.status, data } };
      localStorage.setItem("marketing_token", data.access_token);
      toast.success("Login berhasil");
      navigate("/marketing");
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Area Marketing</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-950">Masuk Marketing</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Gunakan username dan password yang diberikan admin untuk melihat riwayat absensi pribadi.</p>
        <form onSubmit={handleLogin} className="mt-7 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="marketing-username"><UserRound className="mr-2 inline h-4 w-4 text-emerald-700" />Username</Label>
            <Input id="marketing-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required maxLength={40} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketing-password"><Lock className="mr-2 inline h-4 w-4 text-emerald-700" />Password</Label>
            <Input id="marketing-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          <Button type="submit" disabled={loading} className="h-11 w-full bg-emerald-600 font-bold hover:bg-emerald-700">
            <LogIn className="mr-2 h-4 w-4" />{loading ? "Memproses..." : "Masuk"}
          </Button>
        </form>
        <Link to="/" className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-700">
          <ArrowLeft className="h-4 w-4" />Kembali ke absensi
        </Link>
      </section>
    </main>
  );
}
