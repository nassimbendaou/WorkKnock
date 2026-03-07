import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Trash2, FileCheck } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Table, Pagination } from '@/components/ui/Table';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Contract, Client } from '@/types';
import toast from 'react-hot-toast';
import { formatShortDate, CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS, CONTRACT_TYPE_LABELS, formatMoney } from '@/lib/utils';

function ContractForm({ contract, onSuccess, onClose }: { contract?: Contract; onSuccess: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: clientsData } = useQuery({ queryKey: ['clients-all'], queryFn: () => api.get('/clients?limit=100').then(r => r.data) });
  const clients: Client[] = clientsData?.clients || [];

  const [form, setForm] = useState({
    clientId: contract?.clientId || '',
    title: contract?.title || '',
    description: contract?.description || '',
    type: contract?.type || 'REGIE',
    status: contract?.status || 'DRAFT',
    startDate: contract?.startDate?.split('T')[0] || '',
    endDate: contract?.endDate?.split('T')[0] || '',
    dailyRate: String(contract?.dailyRate || ''),
    monthlyRate: String(contract?.monthlyRate || ''),
    fixedAmount: String(contract?.fixedAmount || ''),
    workingDays: String(contract?.workingDays || ''),
    signedAt: contract?.signedAt?.split('T')[0] || '',
    notes: contract?.notes || '',
  });
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (data: any) => contract ? api.put(`/contracts/${contract.id}`, data) : api.post('/contracts', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast.success(contract ? 'Contrat modifié !' : 'Contrat créé !');
      onSuccess();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate({ ...form, dailyRate: form.dailyRate ? Number(form.dailyRate) : null, monthlyRate: form.monthlyRate ? Number(form.monthlyRate) : null, fixedAmount: form.fixedAmount ? Number(form.fixedAmount) : null, workingDays: form.workingDays ? Number(form.workingDays) : null }); }} className="space-y-4 max-h-[75vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <Select label="Client *" value={form.clientId} onChange={set('clientId')} placeholder="Sélectionner" options={clients.map(c => ({ value: c.id, label: c.name }))} required className="col-span-2" />
        <Input label="Titre du contrat *" value={form.title} onChange={set('title')} placeholder="Mission développement..." className="col-span-2" required />
        <Select label="Type" value={form.type} onChange={set('type')} options={[
          { value: 'REGIE', label: 'Régie' }, { value: 'FORFAIT', label: 'Forfait' }, { value: 'PORTAGE', label: 'Portage' },
        ]} />
        <Select label="Statut" value={form.status} onChange={set('status')} options={[
          { value: 'DRAFT', label: 'Brouillon' }, { value: 'ACTIVE', label: 'Actif' },
          { value: 'COMPLETED', label: 'Terminé' }, { value: 'TERMINATED', label: 'Résilié' },
        ]} />
        <Input label="Date de début *" type="date" value={form.startDate} onChange={set('startDate')} required />
        <Input label="Date de fin" type="date" value={form.endDate} onChange={set('endDate')} />
        {form.type === 'REGIE' && <Input label="TJM (€/jour)" type="number" value={form.dailyRate} onChange={set('dailyRate')} step="0.01" placeholder="500" />}
        {form.type === 'REGIE' && <Input label="Taux mensuel (€/mois)" type="number" value={form.monthlyRate} onChange={set('monthlyRate')} step="0.01" />}
        {form.type === 'FORFAIT' && <Input label="Montant forfait (€)" type="number" value={form.fixedAmount} onChange={set('fixedAmount')} step="0.01" />}
        {form.type === 'FORFAIT' && <Input label="Jours prévus" type="number" value={form.workingDays} onChange={set('workingDays')} />}
        <Input label="Signé le" type="date" value={form.signedAt} onChange={set('signedAt')} />
        <div />
      </div>
      <Textarea label="Description" value={form.description} onChange={set('description')} rows={2} />
      <Textarea label="Notes" value={form.notes} onChange={set('notes')} rows={2} />
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={mutation.isPending}>{contract ? 'Modifier' : 'Créer'}</Button>
      </div>
    </form>
  );
}

export function Contracts() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [deleteContract, setDeleteContract] = useState<Contract | null>(null);
  const [tab, setTab] = useState<'contracts' | 'intercontract'>('contracts');

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', page, search, status],
    queryFn: () => api.get('/contracts', { params: { page, limit: 20, search, status } }).then(r => r.data),
    enabled: tab === 'contracts',
  });

  const { data: interData } = useQuery({
    queryKey: ['intercontract'],
    queryFn: () => api.get('/contracts/intercontract').then(r => r.data),
    enabled: tab === 'intercontract',
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contracts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); toast.success('Contrat supprimé'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const columns = [
    {
      key: 'title', header: 'Contrat',
      render: (c: Contract) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
            <FileCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{c.title}</p>
            <p className="text-xs text-slate-500">{c.client?.name}</p>
          </div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (c: Contract) => <span className="badge bg-blue-50 text-blue-700">{CONTRACT_TYPE_LABELS[c.type]}</span> },
    { key: 'dates', header: 'Période', render: (c: Contract) => <span className="text-sm text-slate-500">{formatShortDate(c.startDate)}{c.endDate ? ` → ${formatShortDate(c.endDate)}` : ' →'}</span> },
    {
      key: 'rate', header: 'Tarif',
      render: (c: Contract) => {
        if (c.dailyRate) return <span className="font-medium">{formatMoney(c.dailyRate)}/j</span>;
        if (c.monthlyRate) return <span className="font-medium">{formatMoney(c.monthlyRate)}/mois</span>;
        if (c.fixedAmount) return <span className="font-medium">{formatMoney(c.fixedAmount)}</span>;
        return <span className="text-slate-400">-</span>;
      },
    },
    { key: 'status', header: 'Statut', render: (c: Contract) => <span className={`badge ${CONTRACT_STATUS_COLORS[c.status]}`}>{CONTRACT_STATUS_LABELS[c.status]}</span> },
    {
      key: 'actions', header: '',
      render: (c: Contract) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => setEditContract(c)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 transition-colors"><Edit className="w-4 h-4" /></button>
          <button onClick={() => setDeleteContract(c)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contrats</h1>
          <p className="text-slate-500 text-sm mt-1">{data?.total || 0} contrat(s)</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>Nouveau contrat</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
        {[{ id: 'contracts', label: 'Contrats' }, { id: 'intercontract', label: 'Intercontrats' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${tab === t.id ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'contracts' ? (
        <>
          <div className="card p-4 flex gap-3">
            <div className="flex-1"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input className="input pl-9" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>
            <Select className="w-44" placeholder="Tous les statuts" value={status} onChange={e => setStatus(e.target.value)} options={[
              { value: 'DRAFT', label: 'Brouillon' }, { value: 'ACTIVE', label: 'Actif' },
              { value: 'COMPLETED', label: 'Terminé' }, { value: 'TERMINATED', label: 'Résilié' },
            ]} />
          </div>
          <div className="card" padding={false}>
            <Table columns={columns} data={data?.contracts || []} keyExtractor={c => c.id} loading={isLoading} emptyMessage="Aucun contrat." />
            <Pagination page={page} total={data?.total || 0} limit={20} onPageChange={setPage} />
          </div>
        </>
      ) : (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Périodes d'intercontrat</h3>
          {!interData || interData.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">Aucune période d'intercontrat détectée</p>
          ) : (
            <div className="space-y-4">
              {interData.map((ic: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {formatShortDate(ic.startDate)} → {formatShortDate(ic.endDate)}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Après: <span className="font-medium">{ic.previousContract?.title}</span> → Avant: <span className="font-medium">{ic.nextContract?.title}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-orange-600">{ic.days}</p>
                    <p className="text-xs text-slate-500">jours</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau contrat" size="2xl">
        <ContractForm onSuccess={() => setShowCreate(false)} onClose={() => setShowCreate(false)} />
      </Modal>
      <Modal open={!!editContract} onClose={() => setEditContract(null)} title="Modifier le contrat" size="2xl">
        {editContract && <ContractForm contract={editContract} onSuccess={() => setEditContract(null)} onClose={() => setEditContract(null)} />}
      </Modal>
      <ConfirmModal open={!!deleteContract} onClose={() => setDeleteContract(null)}
        onConfirm={() => deleteContract && deleteMutation.mutate(deleteContract.id)}
        title="Supprimer le contrat" message={`Supprimer "${deleteContract?.title}" ?`} confirmLabel="Supprimer" />
    </div>
  );
}
