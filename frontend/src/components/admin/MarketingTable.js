import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, Pencil, Plus, UsersRound } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MarketingProfileDialog from "./MarketingProfileDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function MarketingTable() {
  const [marketing, setMarketing] = useState([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileEditing, setProfileEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchMarketing = useCallback(async () => {
    try {
      const { data } = await api.get("/marketing/profiles");
      setMarketing(data);
      setLoadError(false);
    } catch (err) {
      setLoadError(true);
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketing();
  }, [fetchMarketing]);

  const openAdd = () => {
    setName("");
    setDialogOpen(true);
  };

  const openProfile = (item, editing) => {
    setSelectedProfile(item);
    setProfileEditing(editing);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/marketing", { name });
      toast.success("Nama marketing ditambahkan");
      setDialogOpen(false);
      setName("");
      fetchMarketing();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const keyword = search.trim().toLowerCase();
  const filtered = marketing.filter((item) => [item.name, item.code, item.profile?.phone].some((value) => value?.toLowerCase().includes(keyword)));

  return (
    <div data-testid="marketing-table-section">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-normal text-slate-950">Marketing</h2>
        </div>
        <Button
          type="button"
          onClick={openAdd}
          className="h-10 rounded-lg bg-emerald-600 font-bold shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-700"
          data-testid="add-marketing-button"
        >
          <Plus className="h-4 w-4" strokeWidth={1.7} />
          Tambah Marketing
        </Button>
      </div>

      <div className="mb-4 max-w-md space-y-2">
        <Label htmlFor="marketing-search" className="font-bold text-slate-900">
          Cari Nama
        </Label>
        <Input
          id="marketing-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama, kode, atau nomor HP"
          className="h-11 rounded-lg border-slate-200 bg-white"
          data-testid="marketing-search-input"
        />
      </div>

      <TooltipProvider>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table className="min-w-[800px]" data-testid="marketing-table">
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Nama Marketing</TableHead>
              <TableHead>Nomor HP</TableHead>
              <TableHead>Bank / Rekening</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-36 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || loadError || filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-slate-500">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    <UsersRound className="h-5 w-5" strokeWidth={1.7} />
                  </div>
                  {loading ? "Memuat profil..." : loadError ? "Profil belum bisa dimuat." : "Tidak ada marketing yang cocok."}
                  {loadError && <Button type="button" variant="outline" className="ml-3" onClick={fetchMarketing}>Coba lagi</Button>}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow className="hover:bg-emerald-50/40" key={item.id}>
                  <TableCell className="max-w-[260px] whitespace-normal break-words font-bold text-slate-900">{item.name}</TableCell>
                  <TableCell>{item.profile?.phone || "Belum diisi"}</TableCell>
                  <TableCell><p>{item.profile?.bank || "Belum diisi"}</p><p className="text-xs text-slate-500">{item.profile?.account_number ? `****${item.profile.account_number.replace(/ /g, "").slice(-4)}` : ""}</p></TableCell>
                  <TableCell className={item.profile?.is_active === false ? "text-slate-500" : "font-semibold text-emerald-700"}>{item.profile?.is_active === false ? "Nonaktif" : "Aktif"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Tooltip><TooltipTrigger asChild><Button type="button" variant="outline" size="icon" onClick={() => openProfile(item, false)} aria-label={`Lihat profil ${item.name}`} data-testid={`view-marketing-button-${item.id}`}><Eye className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Lihat profil</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => openProfile(item, true)}
                        aria-label={`Edit profil ${item.name}`}
                        className="rounded-lg border-slate-200 bg-white"
                        data-testid={`edit-marketing-button-${item.id}`}
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.7} />
                      </Button>
                      </TooltipTrigger><TooltipContent>Edit profil</TooltipContent></Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </TooltipProvider>

      {selectedProfile && <MarketingProfileDialog key={selectedProfile.id} item={selectedProfile} initialEditing={profileEditing} onClose={() => setSelectedProfile(null)} onSaved={(updated) => setMarketing((items) => items.map((item) => item.id === updated.id ? updated : item))} />}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-lg border-slate-200" data-testid="marketing-dialog">
          <DialogHeader>
            <DialogTitle>Tambah Marketing</DialogTitle>
            <DialogDescription>
              Nama ini akan muncul sebagai pilihan di form absensi karyawan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="marketing-name" className="font-bold text-slate-900">
                Nama Marketing
              </Label>
              <Input
                id="marketing-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: asep"
                required
                className="h-11 rounded-lg border-slate-200"
                data-testid="marketing-name-input"
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 font-bold hover:bg-emerald-700"
                data-testid="marketing-save-button"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
