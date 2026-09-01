import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import api, { API_BASE, formatApiError, formatTanggal } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BACKEND_URL = API_BASE;

export default function AttendanceTable({ attendance, month, onMonthChange, onRefresh }) {
  const [photoPreview, setPhotoPreview] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

  const confirmDelete = async () => {
    try {
      await api.delete(`/attendance/${deleteItem.id}`);
      toast.success("Data absensi dihapus");
      setDeleteItem(null);
      onRefresh();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div data-testid="attendance-table-section">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Label htmlFor="filter-month" className="whitespace-nowrap text-sm font-bold text-slate-900">
            Bulan
          </Label>
          <Input
            id="filter-month"
            type="month"
            data-testid="filter-month-input"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="h-10 rounded-lg border-slate-200 bg-white shadow-none sm:w-44"
          />
        </div>
        <Button
          size="sm"
          data-testid="add-attendance-button"
          onClick={() => setAddOpen(true)}
          className="h-10 rounded-lg bg-emerald-600 font-bold shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" strokeWidth={1.7} /> Tambah Data
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table className="min-w-[720px]" data-testid="attendance-table">
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="w-24 px-4 font-bold text-slate-600">Foto</TableHead>
              <TableHead>Nama Lengkap</TableHead>
              <TableHead>Hari</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead className="px-4 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendance.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-slate-500"
                  data-testid="attendance-empty-state"
                >
                  Belum ada data absensi pada bulan ini.
                </TableCell>
              </TableRow>
            ) : (
              attendance.map((item) => (
                <TableRow className="hover:bg-emerald-50/40" key={item.id} data-testid={`attendance-row-${item.id}`}>
                  <TableCell className="px-4">
                    {item.photo_url ? (
                      <button
                        type="button"
                        data-testid={`view-photo-button-${item.id}`}
                        onClick={() => setPhotoPreview(item)}
                        className="block overflow-hidden rounded-lg border border-slate-200 transition-colors duration-200 hover:border-emerald-500"
                      >
                        <img
                          src={`${BACKEND_URL}${item.photo_url}`}
                          alt={`Foto ${item.name}`}
                          className="h-12 w-12 object-cover"
                        />
                      </button>
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
                        <ImageIcon className="h-4 w-4" strokeWidth={1.7} />
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900" data-testid={`attendance-name-${item.id}`}>
                    {item.name}
                  </TableCell>
                  <TableCell className="text-slate-600">{item.day_name}</TableCell>
                  <TableCell className="text-slate-600">{formatTanggal(item.date)}</TableCell>
                  <TableCell className="px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        data-testid={`edit-attendance-button-${item.id}`}
                        onClick={() => setEditItem(item)}
                        className="rounded-lg border-slate-200 bg-white"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.7} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        data-testid={`delete-attendance-button-${item.id}`}
                        onClick={() => setDeleteItem(item)}
                        className="rounded-lg border-slate-200 bg-white"
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

      <Dialog open={!!photoPreview} onOpenChange={() => setPhotoPreview(null)}>
        <DialogContent className="max-w-lg rounded-lg border-slate-200" data-testid="photo-preview-dialog">
          <DialogHeader>
            <DialogTitle>
              Foto Absensi — {photoPreview?.name} ({photoPreview && formatTanggal(photoPreview.date)})
            </DialogTitle>
          </DialogHeader>
          {photoPreview?.photo_url && (
            <img
              src={`${BACKEND_URL}${photoPreview.photo_url}`}
              alt={`Foto ${photoPreview.name}`}
              className="max-h-[60vh] w-full rounded-lg border border-slate-200 object-contain"
              data-testid="photo-preview-image"
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent className="rounded-lg border-slate-200" data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Absensi?</AlertDialogTitle>
            <AlertDialogDescription>
              Data absensi {deleteItem?.name} tanggal{" "}
              {deleteItem && formatTanggal(deleteItem.date)} akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel-button">Batal</AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-confirm-button"
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AttendanceFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          onRefresh();
        }}
      />

      <AttendanceFormDialog
        open={!!editItem}
        item={editItem}
        onClose={() => setEditItem(null)}
        onSaved={() => {
          setEditItem(null);
          onRefresh();
        }}
      />
    </div>
  );
}

function AttendanceFormDialog({ open, item, onClose, onSaved }) {
  const isEdit = !!item;
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open && item) {
      setName(item.name);
      setDate(item.date);
    }
  }, [open, item]);

  const reset = () => {
    setName("");
    setDate("");
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("date", date);
      if (photo) formData.append("photo", photo);
      if (isEdit) {
        await api.put(`/attendance/${item.id}`, formData);
        toast.success("Data absensi diperbarui");
      } else {
        await api.post("/attendance/manual", formData);
        toast.success("Data absensi ditambahkan");
      }
      reset();
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-lg border-slate-200" data-testid={isEdit ? "edit-attendance-dialog" : "add-attendance-dialog"}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Data Absensi" : "Tambah Data Absensi"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ubah nama, tanggal, atau foto absensi karyawan."
              : "Tambahkan data absensi karyawan secara manual."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-bold text-slate-900" htmlFor={isEdit ? "edit-name" : "add-name"}>Nama Lengkap</Label>
            <Input
              id={isEdit ? "edit-name" : "add-name"}
              data-testid={isEdit ? "edit-name-input" : "add-name-input"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-11 rounded-lg border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-slate-900" htmlFor={isEdit ? "edit-date" : "add-date"}>Tanggal</Label>
            <Input
              id={isEdit ? "edit-date" : "add-date"}
              type="date"
              data-testid={isEdit ? "edit-date-input" : "add-date-input"}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-11 rounded-lg border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-slate-900">Foto {isEdit && "(opsional, kosongkan jika tidak diganti)"}</Label>
            <Input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              data-testid={isEdit ? "edit-photo-input" : "add-photo-input"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size > 5 * 1024 * 1024) {
                  toast.error("Ukuran foto maksimal 5MB");
                  e.target.value = "";
                  return;
                }
                setPhoto(f || null);
              }}
              className="h-11 rounded-lg border-slate-200"
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={saving}
              data-testid={isEdit ? "edit-save-button" : "add-save-button"}
              className="rounded-lg bg-emerald-600 font-bold hover:bg-emerald-700"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
