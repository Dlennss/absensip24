import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Lock, LogIn } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-sm" data-testid="admin-login-page">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">
            Area Admin
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight" data-testid="admin-login-title">
            Masuk Admin
          </h1>
        </div>
        <form
          onSubmit={handleLogin}
          className="bg-card border border-border p-8 space-y-6"
          data-testid="admin-login-form"
        >
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              data-testid="admin-email-input"
              placeholder="admin@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="focus:ring-2 focus:ring-primary focus:ring-offset-2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold flex items-center gap-2">
              <Lock className="w-4 h-4" strokeWidth={1.5} /> Password
            </Label>
            <Input
              id="password"
              type="password"
              data-testid="admin-password-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="focus:ring-2 focus:ring-primary focus:ring-offset-2"
            />
          </div>
          <Button
            type="submit"
            data-testid="admin-login-button"
            disabled={loading}
            className="w-full hover:-translate-y-[2px] transition-transform duration-200 ease-out"
          >
            <LogIn className="w-4 h-4 mr-2" strokeWidth={1.5} />
            {loading ? "Memproses..." : "Masuk"}
          </Button>
        </form>
        <p className="text-center mt-6">
          <a
            href="/"
            className="text-xs text-muted-foreground hover:text-primary transition-colors duration-200"
            data-testid="back-to-attendance-link"
          >
            Kembali ke halaman absensi
          </a>
        </p>
      </div>
    </div>
  );
}
