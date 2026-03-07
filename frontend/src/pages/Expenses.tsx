import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Send, Trash2, Search } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Table, Pagination } from '@/components/ui/Table';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ExpenseReport, ExpenseItem } from '@/types';
import toast from 'react-hot-toast';
import { formatMoney, formatShortDate, EXPENSE_STATUS_LABELS, EXPENSE_CATEGORY_LABELS, MONTHS_FR } from '@/lib/utils';

const CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

function ExpenseItemRow({ item, onChange, onRemove }: { item: Partial<ExpenseItem>; onChange: (field: string, value: any) => void; onRemove: () => void }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <div className="col-span-2"><input type="date" className="input text-xs" value={item.date?.split('T')[0] || ''} onChange={e => onChange('date', e.target.value)} required /></div>
      <div className="col-span-2"><select className="input text-xs" value={item.category || ''} onChange={e => onChange('category', e.target.value)} required><option value="">Catégorie</option>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
      <div className="col-span-3"><input className="input text-xs" placeholder="Description" value={item.description || ''} onChange={e => onChange('description', e.target.value)} required /></div>
      <div className="col-span-2"><input className="input text-xs" placeholder="Commerçant" value={item.merchant || ''} onChange={e => onChange('merchant', e.target.value)} /></div>
      <div className="col-span-2"><input type="number" className="input text-xs text-right" placeholder="0.00" step="0.01" min="0" value={item.amount || ''} onChange={e => onChange('amount', e.target.value)} required /></div>
      <div className="col-span-1 flex justify-center pt-1.5">
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 text-xs">✕</button>
      </div>
    </div>
  );
}

function ExpenseForm({ report, onSuccess, onClose }: { report?: ExpenseReport; onSuccess: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const now = new Date();
  const [title, setTitle] = useState(report?.title || `Notes de frais ${MONTHS_FR[report?.month ? report.month - 1 : now.getMonth()]} ${report?.year || now.getFullYear()}`);
  const [month, setMonth] = useState(String(report?.month || now.getMonth() + 1));
  const [year, setYear] = useState(String(report?.year || now.getFullYear()));
  const [notes, setNotes] = useState(report?.notes || '');
  const [items, setItems] = useState<Partial<ExpenseItem>[]>(report?.items || [{ date: now.toISOString().split('T')[0], category: undefined, description: '', amount: 0 }]);

  const addItem = () => setItems(prev => [...prev, { date: new Date().toISOString().split('T')[0], description: '', amount: 0 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const mutation = useMutation({
    mutationFn: (data: any) => report ? api.put(`/expenses/${report.id}`, data) : api.post('/expenses', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success(report ? 'Note modifiée !' : 'Note créée !'); onSuccess(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ title, month: Number(month), year: Number(year), notes, items: items.map(i => ({ ...i, amount: Number(i.amount) })) });
  };

  const months = MONTHS_FR.map((m, i) => ({ value: String(i + 1), label: m }));
  const years = Array.from({ length: 5 }, (_, i) => { const y = now.getFullYear() - 2 + i; return { value: String(y), label: String(y) }; });

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="grid grid-cols-3 gap-4">
        <Input label="Titre" value={title} onChange={e => setTitle(e.target.value)} className="col-span-3" required />
        <Select label="Mois" value={month} onChange={e => setMonth(e.target.value)} options={months} />
        <Select label="Année" value={year} onChange={e => setYear(e.target.value)} options={years} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Lignes de frais</label>
          <button type="button" onClick={addItem} className="text-xs text-[var(--color-primary-600)] hover:underline">+ Ajouter</button>
        </div>
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-0 mb-1">
          <span className="col-span-2">Date</span><span className="col-span-2">Catégorie</span>
          <span className="col-span-3">Description</span><span className="col-span-2">Commerçant</span>
          <span className="col-span-2 text-right">Montant (€)</span><span className="col-span-1" />
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <ExpenseItemRow key={idx} item={item} onChange={(f, v) => updateItem(idx, f, v)} onRemove={() => removeItem(idx)} />
          ))}
        </div>
        <div className="flex justify-end mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
          <span className="text-sm font-bold text-slate-900 dark:text-white">Total: {formatMoney(total)}</span>
        </div>
      </div>

      <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={mutation.isPending}>{report ? 'Modifier' : 'Créer'}</Button>
      </div>
    </form>
  );
}

export function Expenses() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [year, setYear] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editReport, setEditReport] = useState<ExpenseReport | null>(null);
  const [deleteReport, setDeleteReport] = useState<ExpenseReport | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page, status, year],
    queryFn: () => api.get('/expenses', { params: { page, limit: 20, status, year } }).then(r => r.data),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.post(`/expenses/${id}/submit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Note de frais soumise !'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Note supprimée'); },
  });

  const handleDownload = async (report: ExpenseReport) => {
    const { data } = await api.get(`/expenses/${report.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = `frais-${report.month}-${report.year}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600', SUBMITTED: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700',
  };

  const columns = [
    { key: 'title', header: 'Note de frais', render: (r: ExpenseReport) => <span className="font-medium">{r.title}</span> },
    { key: 'period', header: 'Période', render: (r: ExpenseReport) => <span className="text-slate-500">{MONTHS_FR[r.month - 1]} {r.year}</span> },
    { key: 'total', header: 'Total', render: (r: ExpenseReport) => <span className="font-semibold">{formatMoney(r.total)}</span> },
    { key: 'status', header: 'Statut', render: (r: ExpenseReport) => <span className={`badge ${statusColors[r.status]}`}>{EXPENSE_STATUS_LABELS[r.status]}</span> },
    {
      key: 'actions', header: '',
      render: (r: ExpenseReport) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => handleDownload(r)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 transition-colors"><Download className="w-4 h-4" /></button>
          {r.status === 'DRAFT' && <>
            <button onClick={() => setEditReport(r)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition-colors">✏️</button>
            <button onClick={() => submitMutation.mutate(r.id)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-green-600 transition-colors"><Send className="w-4 h-4" /></button>
            <button onClick={() => setDeleteReport(r)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
          </>}
        </div>
      ),
    },
  ];

  const yearOptions = Array.from({ length: 5 }, (_, i) => { const y = new Date().getFullYear() - 2 + i; return { value: String(y), label: String(y) }; });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notes de frais</h1><p className="text-slate-500 text-sm mt-1">{data?.total || 0} note(s)</p></div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>Nouvelle note</Button>
      </div>

      <div className="card p-4 flex gap-3">
        <Select className="w-44" placeholder="Tous les statuts" value={status} onChange={e => setStatus(e.target.value)} options={Object.entries(EXPENSE_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        <Select className="w-32" placeholder="Toutes les années" value={year} onChange={e => setYear(e.target.value)} options={yearOptions} />
      </div>

      <div className="card" padding={false}>
        <Table columns={columns} data={data?.reports || []} keyExtractor={r => r.id} loading={isLoading} emptyMessage="Aucune note de frais." />
        <Pagination page={page} total={data?.total || 0} limit={20} onPageChange={setPage} />
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle note de frais" size="2xl">
        <ExpenseForm onSuccess={() => setShowCreate(false)} onClose={() => setShowCreate(false)} />
      </Modal>
      <Modal open={!!editReport} onClose={() => setEditReport(null)} title="Modifier la note de frais" size="2xl">
        {editReport && <ExpenseForm report={editReport} onSuccess={() => setEditReport(null)} onClose={() => setEditReport(null)} />}
      </Modal>
      <ConfirmModal open={!!deleteReport} onClose={() => setDeleteReport(null)} onConfirm={() => deleteReport && deleteMutation.mutate(deleteReport.id)} title="Supprimer la note" message={`Supprimer "${deleteReport?.title}" ?`} confirmLabel="Supprimer" />
    </div>
  );
}
