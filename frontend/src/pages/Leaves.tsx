import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Calendar, Trash2, Sun, Umbrella, Activity } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Table, Pagination } from '@/components/ui/Table';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Leave } from '@/types';
import toast from 'react-hot-toast';
import { formatShortDate, LEAVE_TYPE_LABELS, LEAVE_STATUS_COLORS } from '@/lib/utils';

const LEAVE_TYPES = [
  { value: 'CP', label: 'Congés Payés' },
  { value: 'RTT', label: 'RTT' },
  { value: 'MALADIE', label: 'Maladie' },
  { value: 'SANS_SOLDE', label: 'Sans solde' },
  { value: 'AUTRE', label: 'Autre' },
];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  CP: <Sun className="w-4 h-4 text-yellow-500" />,
  RTT: <Calendar className="w-4 h-4 text-blue-500" />,
  MALADIE: <Activity className="w-4 h-4 text-red-500" />,
  SANS_SOLDE: <Umbrella className="w-4 h-4 text-slate-500" />,
  AUTRE: <Calendar className="w-4 h-4 text-purple-500" />,
};

function LeaveForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ type: 'CP', startDate: '', endDate: '', reason: '' });
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/leaves', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      toast.success('Congé ajouté !');
      onSuccess();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
      <Select label="Type de congé" value={form.type} onChange={set('type')} options={LEAVE_TYPES} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Date de début" type="date" value={form.startDate} onChange={set('startDate')} required />
        <Input label="Date de fin" type="date" value={form.endDate} onChange={set('endDate')} required />
      </div>
      <Textarea label="Motif (optionnel)" value={form.reason} onChange={set('reason')} rows={2} />
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={mutation.isPending}>Ajouter</Button>
      </div>
    </form>
  );
}

export function Leaves() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [type, setType] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteLeave, setDeleteLeave] = useState<Leave | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leaves', page, year, type],
    queryFn: () => api.get('/leaves', { params: { page, limit: 50, year, type } }).then(r => r.data),
  });

  const { data: balance } = useQuery({
    queryKey: ['leave-balance', year],
    queryFn: () => api.get('/leaves/balance', { params: { year } }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leaves/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); qc.invalidateQueries({ queryKey: ['leave-balance'] }); toast.success('Congé supprimé'); },
  });

  const leaves: Leave[] = data?.leaves || [];

  const columns = [
    {
      key: 'type', header: 'Type',
      render: (l: Leave) => (
        <div className="flex items-center gap-2">
          {TYPE_ICONS[l.type]}
          <span className="font-medium text-slate-900 dark:text-white">{LEAVE_TYPE_LABELS[l.type]}</span>
        </div>
      ),
    },
    { key: 'startDate', header: 'Début', render: (l: Leave) => formatShortDate(l.startDate) },
    { key: 'endDate', header: 'Fin', render: (l: Leave) => formatShortDate(l.endDate) },
    { key: 'days', header: 'Jours', render: (l: Leave) => <span className="font-semibold">{l.days}j</span> },
    { key: 'reason', header: 'Motif', render: (l: Leave) => <span className="text-slate-500">{l.reason || '-'}</span> },
    { key: 'status', header: 'Statut', render: (l: Leave) => <span className={`badge ${LEAVE_STATUS_COLORS[l.status]}`}>{l.status === 'APPROVED' ? 'Approuvé' : l.status === 'REJECTED' ? 'Refusé' : 'En attente'}</span> },
    {
      key: 'actions', header: '',
      render: (l: Leave) => (
        <button onClick={e => { e.stopPropagation(); setDeleteLeave(l); }} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-600 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = new Date().getFullYear() - 2 + i;
    return { value: String(y), label: String(y) };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Congés</h1>
          <p className="text-slate-500 text-sm mt-1">Gestion selon les règles françaises</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>Nouveau congé</Button>
      </div>

      {/* Balance cards */}
      {balance && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'CP restants', used: balance.used.CP, total: balance.allocated.CP, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' },
            { label: 'RTT restants', used: balance.used.RTT, total: balance.allocated.RTT, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Jours maladie', used: balance.used.MALADIE, total: null, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
            { label: 'Sans solde', used: balance.used.SANS_SOLDE, total: null, color: 'text-slate-600 bg-slate-50 dark:bg-slate-800' },
          ].map(b => (
            <div key={b.label} className={`card p-4 ${b.color.split(' ').slice(1).join(' ')}`}>
              <p className={`text-2xl font-bold ${b.color.split(' ')[0]}`}>
                {b.total !== null ? `${b.total - b.used}/${b.total}` : b.used}
              </p>
              <p className="text-xs text-slate-500 mt-1">{b.label}</p>
              {b.total !== null && (
                <div className="mt-2 h-1.5 bg-white/50 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${b.color.split(' ')[0].replace('text-', 'bg-')}`}
                    style={{ width: `${b.total > 0 ? (b.used / b.total) * 100 : 0}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Public holidays */}
      {balance?.holidays && (
        <div className="card p-4">
          <h3 className="font-medium text-slate-900 dark:text-white mb-3">Jours fériés {year} (France)</h3>
          <div className="flex flex-wrap gap-2">
            {balance.holidays.sort().map((h: string) => (
              <span key={h} className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {new Date(h).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex gap-3">
        <Select className="w-32" value={year} onChange={e => setYear(e.target.value)} options={yearOptions} />
        <Select className="w-44" placeholder="Tous les types" value={type} onChange={e => setType(e.target.value)} options={LEAVE_TYPES} />
      </div>

      {/* Table */}
      <div className="card">
        <Table columns={columns} data={leaves} keyExtractor={l => l.id} loading={isLoading} emptyMessage="Aucun congé pour cette période." />
        <Pagination page={page} total={data?.total || 0} limit={50} onPageChange={setPage} />
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau congé" size="md">
        <LeaveForm onSuccess={() => setShowCreate(false)} onClose={() => setShowCreate(false)} />
      </Modal>
      <ConfirmModal open={!!deleteLeave} onClose={() => setDeleteLeave(null)}
        onConfirm={() => deleteLeave && deleteMutation.mutate(deleteLeave.id)}
        title="Supprimer ce congé" message="Êtes-vous sûr de vouloir supprimer ce congé ?" confirmLabel="Supprimer" />
    </div>
  );
}
