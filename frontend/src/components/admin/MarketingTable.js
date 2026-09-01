import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [editItem, setEditItem] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchMarketing = useCallback(async () => {
    try {
      const { data } = await api.get("/marketing", { params: { q: search } });
      setMarketing(data);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  }, [search]);

  useEffect(() => {
    fetchMarketing();
  }, [fetchMarketing]);

  const openAdd = () => {
    setEditItem(null);
    setName("");
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setName(item.name);
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/marketing/${editItem.id}`, { name });
        toast.success("Nama marketing diperbarui");
      } else {
        await api.post("/marketing", { name });
        toast.success("Nama marketing ditambahkan");
      }
      setDialogOpen(false);
      setName("");
      setEditItem(null);
      fetchMarketing();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Hapus marketing "${item.name}"?`)) return;
    try {
      await api.delete(`/marketing/${item.id}`);
      toast.success("Nama marketing dihapus");
      fetchMarketing();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div data-testid="marketing-table-section">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-normal text-slate-950">Nama Marketing</h2>
          <p className="mt-1 text-sm text-slate-500">
            Daftar ini menjadi sumber pencarian di form absensi.
          </p>
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
          placeholder="Cari nama marketing"
          className="h-11 rounded-lg border-slate-200 bg-white"
          data-testid="marketing-search-input"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table className="min-w-[560px]" data-testid="marketing-table">
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Nama Marketing</TableHead>
              <TableHead className="w-36 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {marketing.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-12 text-center text-slate-500">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    <UsersRound className="h-5 w-5" strokeWidth={1.7} />
                  </div>
                  Belum ada nama marketing.
                </TableCell>
              </TableRow>
            ) : (
              marketing.map((item) => (
                <TableRow className="hover:bg-emerald-50/40" key={item.id}>
                  <TableCell className="font-bold text-slate-900">{item.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => openEdit(item)}
                        className="rounded-lg border-slate-200 bg-white"
                        data-testid={`edit-marketing-button-${item.id}`}
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.7} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(item)}
                        className="rounded-lg border-slate-200 bg-white"
                        data-testid={`delete-marketing-button-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" strokeWidth={1.7} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-lg border-slate-200" data-testid="marketing-dialog">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Marketing" : "Tambah Marketing"}</DialogTitle>
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
