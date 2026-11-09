import { useState } from "react";
import { Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import KtpPhotoInput from "./KtpPhotoInput";

const inventoryLabels = {
  uniforms: "Jumlah seragam", vest: "Rompi", id_card: "ID card", ktp_verified: "KTP diverifikasi",
  received_on: "Tanggal penyerahan", returned_on: "Tanggal pengembalian", note: "Catatan",
};
const emptyInventory = { uniforms: 0, vest: false, id_card: false, ktp_verified: false, received_on: "", returned_on: "", note: "" };
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("id-ID") : "Belum diisi";

export default function MarketingProfileDialog({ item, initialEditing, onClose, onSaved }) {
  const creating = !item?.id;
  const original = {
    address: "", phone: "", joined_on: "", is_active: true, bank: "", account_number: "", account_holder: "", ptkp_by_year: {},
    ...item?.profile, ptkp_by_year: { ...item?.profile?.ptkp_by_year }, inventory: { ...emptyInventory, ...item?.profile?.inventory },
  };
  const [name, setName] = useState(item?.name || "");
  const [profile, setProfile] = useState(original);
  const [editing, setEditing] = useState(creating || initialEditing);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(item?.inventory_history || []);
  const [baseline, setBaseline] = useState(original);
  const [ktpPhoto, setKtpPhoto] = useState(item?.ktp_photo || null);
  const [ktpFile, setKtpFile] = useState(null);
  const [ktpError, setKtpError] = useState("");
  const [ptkpYear, setPtkpYear] = useState(String(new Date().getFullYear()));
  const change = (key, value) => setProfile((current) => ({ ...current, [key]: value }));
  const changeInventory = (key, value) => setProfile((current) => ({ ...current, inventory: { ...current.inventory, [key]: value } }));
  const changePtkpStatus = (status) => setProfile((current) => ({
    ...current,
    ptkp_by_year: { ...current.ptkp_by_year, [ptkpYear]: status },
  }));

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (creating && !ktpFile) {
      setKtpError("Foto KTP wajib diisi sebelum menyimpan marketing baru.");
      return;
    }
    if (creating && !name.trim()) {
      toast.error("Nama marketing wajib diisi");
      return;
    }
    if (creating && !profile.ptkp_by_year[String(new Date().getFullYear())]) {
      toast.error("Status PTKP wajib dipilih untuk menghitung PPh 21 otomatis.");
      return;
    }
    const changes = {};
    Object.keys(baseline).filter((key) => key !== "inventory").forEach((key) => {
      if (profile[key] !== baseline[key]) changes[key] = profile[key];
    });
    const inventory = {};
    Object.keys(emptyInventory).forEach((key) => {
      if (profile.inventory[key] !== baseline.inventory[key]) inventory[key] = profile.inventory[key];
    });
    if (Object.keys(inventory).length) changes.inventory = inventory;
    if (!creating && !Object.keys(changes).length && !ktpFile) { setEditing(false); return; }
    setSaving(true);
    try {
      let response;
      if (creating) {
        const formData = new FormData();
        formData.append("name", name.trim());
        formData.append("profile", JSON.stringify(profile));
        formData.append("photo", ktpFile);
        response = await api.post("/marketing", formData);
      } else if (ktpFile) {
        const formData = new FormData();
        formData.append("photo", ktpFile);
        formData.append("changes", JSON.stringify(changes));
        response = await api.put(`/marketing/${item.id}/ktp`, formData);
      } else {
        response = await api.patch(`/marketing/${item.id}/profile`, changes);
      }
      const { data } = response;
      if (creating) {
        onSaved(data);
        toast.success("Marketing dan profil berhasil ditambahkan");
        return;
      }
      setProfile(data.profile);
      setBaseline(data.profile);
      setHistory(data.inventory_history || []);
      setKtpPhoto(data.ktp_photo || null);
      setKtpFile(null);
      setEditing(false);
      onSaved(data);
      toast.success("Profil marketing disimpan");
    } catch (error) {
      toast.error(formatApiError(error));
    } finally { setSaving(false); }
  };

  const field = (key, label, options = {}) => (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={`profile-${key}`} className="text-sm font-semibold">{label}</Label>
      {editing ? (
        <Input id={`profile-${key}`} value={profile[key]} onChange={(event) => change(key, event.target.value)} required={creating} {...options} />
      ) : <p className="break-words text-sm text-slate-700">{options.type === "date" ? dateLabel(profile[key]) : profile[key] || "Belum diisi"}</p>}
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-lg" data-testid={creating ? "marketing-dialog" : "marketing-profile-dialog"}>
        <DialogHeader>
          <DialogTitle className="break-words pr-6">{creating ? "Tambah Marketing" : item.name}</DialogTitle>
          <DialogDescription className="break-all">{creating ? "Data diri, alamat, status PTKP tahun ini, rekening, dan foto KTP wajib diisi." : item.code}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="min-w-0 space-y-5">
          {creating && <div className="space-y-2">
            <Label htmlFor="marketing-name" className="text-sm font-semibold">Nama Marketing</Label>
            <Input id="marketing-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={150} required autoFocus data-testid="marketing-name-input" />
          </div>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={`text-sm font-bold ${profile.is_active ? "text-emerald-700" : "text-slate-500"}`}>
              {profile.is_active ? "Aktif" : "Nonaktif"}
            </span>
            {!editing && <Button type="button" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />Edit Profil</Button>}
          </div>
          <section className="space-y-4 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-bold">Data Diri</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("phone", "Nomor HP", { type: "tel", maxLength: 30, pattern: creating ? "\\+?[0-9 ]{8,30}" : undefined })}
              {field("joined_on", "Tanggal bergabung", { type: "date" })}
              <div className="min-w-0 space-y-2 sm:col-span-2">
                <Label htmlFor="profile-address" className="text-sm font-semibold">Alamat lengkap</Label>
                {editing ? <textarea id="profile-address" value={profile.address} onChange={(event) => change("address", event.target.value)} maxLength={500} minLength={5} required={creating} rows={3} placeholder="Jalan, nomor rumah, RT/RW, kelurahan, kecamatan, kota, dan kode pos" className="w-full rounded-md border border-slate-200 bg-white p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" /> : <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{profile.address || "Belum diisi"}</p>}
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="profile-ptkp-year" className="text-sm font-semibold">Status PTKP per tahun</Label>
                {editing ? <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                  <Input id="profile-ptkp-year" aria-label="Tahun pajak PTKP" type="number" min="2000" max="2100" step="1" value={ptkpYear} onChange={(event) => setPtkpYear(event.target.value)} />
                  <Select value={profile.ptkp_by_year[ptkpYear] || undefined} onValueChange={changePtkpStatus}>
                    <SelectTrigger aria-label="Status PTKP" data-testid="marketing-ptkp-status">
                      <SelectValue placeholder="Pilih status PTKP" />
                    </SelectTrigger>
                    <SelectContent>
                      {["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div> : <div className="text-sm text-slate-700">
                  {Object.entries(profile.ptkp_by_year).sort(([a], [b]) => a.localeCompare(b)).map(([year, status]) => <p key={year}>{year}: {status}</p>)}
                  {!Object.keys(profile.ptkp_by_year).length && <p>Belum diisi</p>}
                </div>}
                <p className="text-xs leading-5 text-slate-500">TK = tidak kawin, K = kawin; angka menunjukkan jumlah tanggungan pada awal tahun pajak.</p>
              </div>
            </div>
            {editing && <div className="flex items-center gap-2"><Checkbox id="profile-active" checked={profile.is_active} onCheckedChange={(checked) => change("is_active", checked === true)} /><Label htmlFor="profile-active">Marketing aktif</Label></div>}
          </section>
          <section className="space-y-4 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-bold">Rekening</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("bank", "Nama bank", { maxLength: 100, list: "marketing-bank-options" })}
              {field("account_number", "Nomor rekening", { inputMode: "numeric", maxLength: 40, pattern: "[0-9 ]*" })}
              {field("account_holder", "Nama pemilik rekening", { maxLength: 150 })}
            </div>
            <datalist id="marketing-bank-options">{["BCA", "BRI", "BNI", "MANDIRI", "BSI", "SEABANK", "CIMB NIAGA", "BTN"].map((bank) => <option key={bank} value={bank} />)}</datalist>
          </section>
          <section className="space-y-4 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-bold">Inventori dan Kelengkapan</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="profile-uniforms">Jumlah seragam diterima</Label>
                {editing ? <Input id="profile-uniforms" type="number" min="0" max="100" step="1" required value={profile.inventory.uniforms} onChange={(event) => changeInventory("uniforms", event.target.value === "" ? "" : Number(event.target.value))} /> : <p className="text-sm">{profile.inventory.uniforms} buah</p>}
              </div>
              {["vest", "id_card"].map((key) => <div key={key} className="flex items-center gap-2">
                <Checkbox id={`inventory-${key}`} checked={profile.inventory[key]} disabled={!editing} onCheckedChange={(checked) => changeInventory(key, checked === true)} />
                <Label htmlFor={`inventory-${key}`}>{inventoryLabels[key]}</Label>
              </div>)}
              <div className="space-y-2">
                <Label htmlFor="inventory-received_on">Tanggal penyerahan</Label>
                {editing ? <Input id="inventory-received_on" type="date" value={profile.inventory.received_on} required={creating && Boolean(profile.inventory.uniforms || profile.inventory.vest || profile.inventory.id_card)} onChange={(event) => changeInventory("received_on", event.target.value)} /> : <p className="text-sm">{dateLabel(profile.inventory.received_on)}</p>}
              </div>
            </div>
            <div className="space-y-2"><Label htmlFor="inventory-note">Catatan serah-terima</Label>
              {editing ? <textarea id="inventory-note" maxLength={2000} rows={3} value={profile.inventory.note} onChange={(event) => changeInventory("note", event.target.value)} className="w-full rounded-md border border-slate-200 bg-white p-3 text-sm" /> : <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{profile.inventory.note || "Belum ada catatan"}</p>}
            </div>
          </section>
          <KtpPhotoInput photo={ktpPhoto} file={ktpFile} onChange={(file) => { setKtpFile(file); setKtpError(""); }} editing={editing} disabled={saving} required={creating} />
          {ktpError && <p role="alert" className="text-sm font-semibold text-red-600">{ktpError}</p>}
          {history.length > 0 && <section className="space-y-3 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-bold">Riwayat Inventori</h3>
            <ol className="space-y-3">{[...history].reverse().map((entry, index) => <li key={`${entry.at}-${index}`} className="border-l-2 border-emerald-200 pl-3 text-sm">
              <p className="text-xs text-slate-500">{new Date(entry.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p>
              {Object.entries(entry.changes).map(([key, value]) => <p className="break-words" key={key}>{inventoryLabels[key] || key}: {typeof value === "boolean" ? (value ? "Ya" : "Tidak") : value === "" ? "Dikosongkan" : String(value)}</p>)}
            </li>)}</ol>
          </section>}
          {editing && <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" disabled={saving} onClick={() => { if (creating) { onClose(); return; } setProfile(baseline); setKtpFile(null); setEditing(false); }}>Batal</Button>
            <Button type="submit" disabled={saving} data-testid={creating ? "marketing-save-button" : undefined} className="bg-emerald-600 hover:bg-emerald-700"><Save className="h-4 w-4" />{saving ? "Menyimpan..." : creating ? "Simpan Marketing" : "Simpan Profil"}</Button>
          </div>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
