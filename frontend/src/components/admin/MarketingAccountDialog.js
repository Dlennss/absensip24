import { useCallback, useEffect, useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function MarketingAccountDialog({ item, onClose }) {
  const [account, setAccount] = useState(undefined);
  const [username, setUsername] = useState(`mkt-${item.id.slice(-8)}`.toLowerCase());
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await api.get(`/marketing/${item.id}/account`);
      setAccount(data);
    } catch (error) {
      setLoadError(true);
      toast.error(formatApiError(error));
    } finally { setLoading(false); }
  }, [item.id]);

  useEffect(() => { loadAccount(); }, [loadAccount]);

  const createAccount = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/marketing/${item.id}/account`, { username, password });
      setAccount(data);
      setPassword("");
      toast.success("Akun berhasil dibuat. Berikan username dan password awal secara pribadi kepada marketing.");
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setSaving(false); }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await api.put(`/marketing/${item.id}/account/password`, { password });
      setPassword("");
      toast.success("Password direset. Sampaikan password baru secara pribadi.");
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setSaving(false); }
  };

  const toggleStatus = async () => {
    if (!account || saving) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/marketing/${item.id}/account`, { is_active: !account.is_active });
      setAccount(data);
      toast.success(data.is_active ? "Akun diaktifkan" : "Akun dinonaktifkan");
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle className="break-words">Akun {item.name}</DialogTitle>
          <DialogDescription>Akun ini hanya membuka riwayat absensi milik marketing. Absensi harian tetap bisa dilakukan tanpa login.</DialogDescription>
        </DialogHeader>
        {loading ? <p className="py-4 text-sm text-slate-500">Memuat status akun...</p> : loadError ? (
          <div className="space-y-3 py-2"><p role="alert" className="text-sm text-red-700">Status akun belum dapat dipastikan.</p><Button type="button" variant="outline" onClick={loadAccount}>Coba lagi</Button></div>
        ) : account ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 border-y border-slate-200 py-4">
              <div className="min-w-0"><p className="text-xs text-slate-500">Username</p><p className="break-all font-semibold text-slate-900">{account.username}</p><p className={`mt-1 text-sm font-semibold ${account.is_active ? "text-emerald-700" : "text-slate-500"}`}>{account.is_active ? "Aktif" : "Nonaktif"}</p></div>
              <Button type="button" variant="outline" disabled={saving} onClick={toggleStatus}>{account.is_active ? "Nonaktifkan" : "Aktifkan"}</Button>
            </div>
            <form onSubmit={resetPassword} className="space-y-3">
              <div className="space-y-2"><Label htmlFor="marketing-account-reset">Password baru</Label><Input id="marketing-account-reset" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={72} required placeholder="Minimal 10 karakter" /></div>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700"><KeyRound className="h-4 w-4" />{saving ? "Memproses..." : "Reset Password"}</Button>
            </form>
          </div>
        ) : (
          <form onSubmit={createAccount} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="marketing-account-username">Username</Label><Input id="marketing-account-username" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={40} pattern="[a-zA-Z0-9._-]+" required autoComplete="off" /></div>
            <div className="space-y-2"><Label htmlFor="marketing-account-password">Password awal</Label><Input id="marketing-account-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={72} required placeholder="Minimal 10 karakter" /></div>
            <p className="text-xs leading-5 text-slate-500">Password disimpan dalam bentuk hash dan tidak dapat dilihat kembali. Bagikan password awal kepada marketing secara pribadi.</p>
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700"><Save className="h-4 w-4" />{saving ? "Membuat..." : "Buat Akun"}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
