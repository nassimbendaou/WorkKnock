import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Edit, Eye, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Table, Pagination } from '@/components/ui/Table';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Client } from '@/types';
import toast from 'react-hot-toast';
import { formatMoney } from '@/lib/utils';

function ClientForm({ client, onSuccess, onClose }: { client?: Client; onSuccess: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    address: client?.address || '',
    city: client?.city || '',
    postalCode: client?.postalCode || '',
    country: client?.country || 'France',
    siret: client?.siret || '',
    tva: client?.tva || '',
    contactName: client?.contactName || '',
    contactEmail: client?.contactEmail || '',
    contactPhone: client?.contactPhone || '',
    notes: client?.notes || '',
    status: client?.status || 'ACTIVE',
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (data: any) => client ? api.put(`/clients/${client.id}`, data) : api.post('/clients', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(client ? 'Client modifié !' : 'Client créé !');
      onSuccess();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Le nom est requis'); return; }
    mutation.mutate(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Nom de l'entreprise *" value={form.name} onChange={set('name')} placeholder="ACME Corp" required className="col-span-2" />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="contact@acme.fr" />
        <Input label="Téléphone" value={form.phone} onChange={set('phone')} placeholder="+33 1 23 45 67 89" />
        <Input label="Adresse" value={form.address} onChange={set('address')} placeholder="12 rue de la Paix" />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Code postal" value={form.postalCode} onChange={set('postalCode')} placeholder="75001" />
          <Input label="Ville" value={form.city} onChange={set('city')} placeholder="Paris" />
        </div>
        <Input label="SIRET" value={form.siret} onChange={set('siret')} placeholder="12345678900012" />
        <Input label="N° TVA" value={form.tva} onChange={set('tva')} placeholder="FR12345678901" />
      </div>

      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Contact principal</h4>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Nom" value={form.contactName} onChange={set('contactName')} placeholder="Jean Dupont" />
          <Input label="Email" type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="jean@acme.fr" />
          <Input label="Téléphone" value={form.contactPhone} onChange={set('contactPhone')} />
        </div>
      </div>

      <Textarea label="Notes" value={form.notes} onChange={set('notes')} placeholder="Notes internes..." rows={2} />

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={mutation.isPending}>{client ? 'Modifier' : 'Créer'}</Button>
      </div>
    </form>
  );
}

export function Clients() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search, status],
    queryFn: () => api.get('/clients', { params: { page, limit: 20, search, status } }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client supprimé'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const columns = [
    {
      key: 'name', header: 'Client',
      render: (c: Client) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-50)] dark:bg-[var(--color-primary-900)]/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-[var(--color-primary-600)]" />
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{c.name}</p>
            {c.contactName && <p className="text-xs text-slate-500">{c.contactName}</p>}
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (c: Client) => <span className="text-slate-500">{c.email || '-'}</span> },
    { key: 'phone', header: 'Téléphone', render: (c: Client) => <span className="text-slate-500">{c.phone || '-'}</span> },
    {
      key: 'invoices', header: 'Factures',
      render: (c: Client) => <span className="badge bg-blue-50 text-blue-700">{c._count?.invoices || 0}</span>,
    },
    {
      key: 'status', header: 'Statut',
      render: (c: Client) => <span className={`badge ${c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{c.status === 'ACTIVE' ? 'Actif' : 'Inactif'}</span>,
    },
    {
      key: 'actions', header: '',
      render: (c: Client) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => navigate(`/clients/${c.id}`)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition-colors">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={() => setEditClient(c)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 transition-colors">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => setDeleteClient(c)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clients</h1>
          <p className="text-slate-500 text-sm mt-1">{data?.total || 0} client(s)</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>Nouveau client</Button>
      </div>

      <div className="card p-4 flex gap-3">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher un client..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <Select className="w-40" placeholder="Tous" value={status} onChange={e => setStatus(e.target.value)}
          options={[{ value: 'ACTIVE', label: 'Actifs' }, { value: 'INACTIVE', label: 'Inactifs' }]} />
      </div>

      <div className="card">
        <Table columns={columns} data={data?.clients || []} keyExtractor={c => c.id}
          onRowClick={c => navigate(`/clients/${c.id}`)} loading={isLoading}
          emptyMessage="Aucun client. Commencez par ajouter vos clients !" />
        <Pagination page={page} total={data?.total || 0} limit={20} onPageChange={setPage} />
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau client" size="2xl">
        <ClientForm onSuccess={() => setShowCreate(false)} onClose={() => setShowCreate(false)} />
      </Modal>
      <Modal open={!!editClient} onClose={() => setEditClient(null)} title="Modifier le client" size="2xl">
        {editClient && <ClientForm client={editClient} onSuccess={() => setEditClient(null)} onClose={() => setEditClient(null)} />}
      </Modal>
      <ConfirmModal open={!!deleteClient} onClose={() => setDeleteClient(null)}
        onConfirm={() => deleteClient && deleteMutation.mutate(deleteClient.id)}
        title="Supprimer le client" message={`Supprimer ${deleteClient?.name} ? Cette action est irréversible.`}
        confirmLabel="Supprimer" />
    </div>
  );
}
