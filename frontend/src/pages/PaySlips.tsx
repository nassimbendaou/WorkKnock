import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Table, Pagination } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { PaySlip } from '@/types';
import toast from 'react-hot-toast';
import { formatMoney, MONTHS_FR } from '@/lib/utils';

function PaySlipForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const now = new Date();
  const [form, setForm] = useState({ month: String(now.getMonth() + 1), year: String(now.getFullYear()), grossAmount: '', notes: '' });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [f]: e.target.value }));

  const gross = Number(form.grossAmount) || 0;
  const urssaf = gross * 0.22;
  const csg = gross * 0.097;
  const retirement = gross * 0.068;
  const net = gross - urssaf - csg - retirement;

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/payslips', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payslips'] }); toast.success('Fiche de paie créée !'); onSuccess(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const months = MONTHS_FR.map((m, i) => ({ value: String(i + 1), label: m }));
  const years = Array.from({ length: 5 }, (_, i) => { const y = now.getFullYear() - 2 + i; return { value: String(y), label: String(y) }; });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate({ ...form, month: Number(form.month), year: Number(form.year), grossAmount: gross }); }} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Select label="Mois" value={form.month} onChange={set('month')} options={months} />
        <Select label="Année" value={form.year} onChange={set('year')} options={years} />
        <Input label="Salaire brut (€)" type="number" value={form.grossAmount} onChange={set('grossAmount')} step="0.01" min="0" required />
      </div>

      {gross > 0 && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 text-sm">
          <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Aperçu des cotisations</h4>
          {[
            { label: 'Salaire brut', value: gross, bold: true },
            { label: 'URSSAF (22%)', value: -urssaf },
            { label: 'CSG/CRDS (9.7%)', value: -csg },
            { label: 'Retraite (6.8%)', value: -retirement },
          ].map(row => (
            <div key={row.label} className="flex justify-between">
              <span className={`${row.bold ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-500'}`}>{row.label}</span>
              <span className={`${row.value < 0 ? 'text-red-600' : 'font-medium text-slate-900 dark:text-white'}`}>{formatMoney(row.value)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 font-bold text-green-600">
            <span>Net à payer</span><span>{formatMoney(net)}</span>
          </div>
        </div>
      )}

      <Textarea label="Notes" value={form.notes} onChange={set('notes')} rows={2} />
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={mutation.isPending}>Générer</Button>
      </div>
    </form>
  );
}

export function PaySlips() {
  const [page, setPage] = useState(1);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['payslips', page, year],
    queryFn: () => api.get('/payslips', { params: { page, limit: 20, year } }).then(r => r.data),
  });

  const handleDownload = async (ps: PaySlip) => {
    const { data } = await api.get(`/payslips/${ps.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = `bulletin-${ps.month}-${ps.year}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    GENERATED: 'bg-blue-100 text-blue-700',
    SENT: 'bg-green-100 text-green-700',
  };

  const columns = [
    { key: 'period', header: 'Période', render: (ps: PaySlip) => <span className="font-medium">{MONTHS_FR[ps.month - 1]} {ps.year}</span> },
    { key: 'grossAmount', header: 'Brut', render: (ps: PaySlip) => <span>{formatMoney(ps.grossAmount)}</span> },
    { key: 'socialCharges', header: 'Cotisations', render: (ps: PaySlip) => <span className="text-red-600">-{formatMoney(ps.socialCharges)}</span> },
    { key: 'netAmount', header: 'Net', render: (ps: PaySlip) => <span className="font-bold text-green-600">{formatMoney(ps.netAmount)}</span> },
    { key: 'status', header: 'Statut', render: (ps: PaySlip) => <span className={`badge ${statusColors[ps.status]}`}>{ps.status === 'GENERATED' ? 'Généré' : ps.status === 'SENT' ? 'Envoyé' : 'Brouillon'}</span> },
    {
      key: 'actions', header: '',
      render: (ps: PaySlip) => (
        <button onClick={e => { e.stopPropagation(); handleDownload(ps); }} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 transition-colors">
          <Download className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const yearOptions = Array.from({ length: 5 }, (_, i) => { const y = new Date().getFullYear() - 2 + i; return { value: String(y), label: String(y) }; });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fiches de paie</h1><p className="text-slate-500 text-sm mt-1">Bulletins de salaire</p></div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>Générer une fiche</Button>
      </div>

      <div className="card p-4">
        <Select className="w-32" value={year} onChange={e => setYear(e.target.value)} options={yearOptions} />
      </div>

      <div className="card">
        <Table columns={columns} data={data?.paySlips || []} keyExtractor={ps => ps.id} loading={isLoading} emptyMessage="Aucune fiche de paie." />
        <Pagination page={page} total={data?.total || 0} limit={20} onPageChange={setPage} />
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Générer une fiche de paie" size="md">
        <PaySlipForm onSuccess={() => setShowCreate(false)} onClose={() => setShowCreate(false)} />
      </Modal>
    </div>
  );
}
