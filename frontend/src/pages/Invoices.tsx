import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Plus, Download, Send, CheckCircle, Bell, Trash2, Search, Filter, Eye } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Table, Pagination } from '@/components/ui/Table';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { formatMoney, formatShortDate, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/lib/utils';
import { Invoice, Client, InvoiceItem } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';

const PAYMENT_METHODS = [
  { value: 'VIREMENT', label: 'Virement bancaire' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'CARTE', label: 'Carte bancaire' },
];

function InvoiceForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { data: clientsData } = useQuery({ queryKey: ['clients-all'], queryFn: () => api.get('/clients?limit=100').then(r => r.data) });
  const clients: Client[] = clientsData?.clients || [];

  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [taxRate, setTaxRate] = useState(String(user?.settings?.taxRate || 20));
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Paiement à 30 jours');
  const [items, setItems] = useState<Partial<InvoiceItem>[]>([{ description: '', quantity: 1, unitPrice: 0 }]);

  const addItem = () => setItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const taxAmount = subtotal * (Number(taxRate) / 100);
  const total = subtotal + taxAmount;

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/invoices', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Facture créée !');
      onSuccess();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) { toast.error('Sélectionnez un client'); return; }
    mutation.mutate({
      clientId, issueDate, dueDate,
      taxRate: Number(taxRate), notes, paymentTerms,
      items: items.map(i => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <Select label="Client *" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Sélectionner un client"
          options={clients.map(c => ({ value: c.id, label: c.name }))} required />
        <Input label="TVA (%)" type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} min="0" max="100" step="0.1" />
        <Input label="Date d'émission" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} required />
        <Input label="Date d'échéance" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Lignes de facturation</label>
          <button type="button" onClick={addItem} className="text-xs text-[var(--color-primary-600)] hover:underline">+ Ajouter</button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
            <span className="col-span-6">Description</span>
            <span className="col-span-2 text-right">Qté</span>
            <span className="col-span-2 text-right">Prix unit.</span>
            <span className="col-span-2 text-right">Total</span>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-6">
                <input className="input text-xs" placeholder="Description" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} required />
              </div>
              <div className="col-span-2">
                <input className="input text-xs text-right" type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} required />
              </div>
              <div className="col-span-2">
                <input className="input text-xs text-right" type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} required />
              </div>
              <div className="col-span-1 py-2 text-xs text-right font-medium">
                {formatMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
              </div>
              <div className="col-span-1 flex justify-center pt-1.5">
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Sous-total HT</span><span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>TVA ({taxRate}%)</span><span>{formatMoney(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t">
            <span>Total TTC</span><span className="text-[var(--color-primary-600)]">{formatMoney(total)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Conditions de paiement" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="Paiement à 30 jours" />
        <div />
      </div>
      <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Mentions légales, informations bancaires..." rows={2} />

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={mutation.isPending}>Créer la facture</Button>
      </div>
    </form>
  );
}

function PaymentModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(invoice.total));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('VIREMENT');
  const [reference, setReference] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post(`/invoices/${invoice.id}/pay`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Paiement enregistré !');
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Facture <strong>{invoice.number}</strong> - Montant: <strong>{formatMoney(invoice.total)}</strong>
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Montant reçu (€)" type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" required />
        <Input label="Date de paiement" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        <Select label="Moyen de paiement" value={method} onChange={e => setMethod(e.target.value)} options={PAYMENT_METHODS} />
        <Input label="Référence" value={reference} onChange={e => setReference(e.target.value)} placeholder="N° virement..." />
      </div>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button loading={mutation.isPending} onClick={() => mutation.mutate({ amount: Number(amount), date, method, reference })}>
          Confirmer le paiement
        </Button>
      </div>
    </div>
  );
}

export function Invoices() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(location.pathname === '/invoices/new');

  useEffect(() => {
    if (location.pathname === '/invoices/new') setShowCreate(true);
  }, [location.pathname]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, search, status],
    queryFn: () => api.get('/invoices', { params: { page, limit: 20, search, status } }).then(r => r.data),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/send`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Facture envoyée par email !'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur lors de l\'envoi'),
  });

  const reminderMutation = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/reminder`),
    onSuccess: () => toast.success('Relance envoyée !'),
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Facture supprimée'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const handleDownload = async (invoice: Invoice) => {
    const { data } = await api.get(`/invoices/${invoice.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = `facture-${invoice.number}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      key: 'number', header: 'Numéro',
      render: (inv: Invoice) => <span className="font-mono font-medium text-slate-900 dark:text-white">{inv.number}</span>,
    },
    { key: 'client', header: 'Client', render: (inv: Invoice) => inv.client?.name || '-' },
    {
      key: 'issueDate', header: 'Émission',
      render: (inv: Invoice) => <span className="text-slate-500">{formatShortDate(inv.issueDate)}</span>,
    },
    {
      key: 'dueDate', header: 'Échéance',
      render: (inv: Invoice) => {
        const days = Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / 86400000);
        const isLate = days < 0 && inv.status !== 'PAID';
        return <span className={isLate ? 'text-red-600 font-medium' : 'text-slate-500'}>{formatShortDate(inv.dueDate)}</span>;
      },
    },
    {
      key: 'total', header: 'Montant',
      render: (inv: Invoice) => <span className="font-semibold">{formatMoney(inv.total)}</span>,
    },
    {
      key: 'status', header: 'Statut',
      render: (inv: Invoice) => <span className={`badge ${INVOICE_STATUS_COLORS[inv.status]}`}>{INVOICE_STATUS_LABELS[inv.status]}</span>,
    },
    {
      key: 'actions', header: '',
      render: (inv: Invoice) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => navigate(`/invoices/${inv.id}`)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition-colors" title="Voir">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={() => handleDownload(inv)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 transition-colors" title="Télécharger">
            <Download className="w-4 h-4" />
          </button>
          {inv.status === 'DRAFT' && (
            <button onClick={() => sendMutation.mutate(inv.id)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-green-600 transition-colors" title="Envoyer">
              <Send className="w-4 h-4" />
            </button>
          )}
          {['SENT', 'OVERDUE'].includes(inv.status) && (
            <>
              <button onClick={() => { setSelectedInvoice(inv); setShowPayment(true); }} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-green-600 transition-colors" title="Marquer payé">
                <CheckCircle className="w-4 h-4" />
              </button>
              <button onClick={() => reminderMutation.mutate(inv.id)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-orange-600 transition-colors" title="Relancer">
                <Bell className="w-4 h-4" />
              </button>
            </>
          )}
          {inv.status !== 'PAID' && (
            <button onClick={() => { setSelectedInvoice(inv); setShowDelete(true); }} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-600 transition-colors" title="Supprimer">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Factures</h1>
          <p className="text-slate-500 text-sm mt-1">{data?.total || 0} facture(s)</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
          Nouvelle facture
        </Button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <Select className="w-44" placeholder="Tous les statuts" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          options={[
            { value: 'DRAFT', label: 'Brouillon' }, { value: 'SENT', label: 'Envoyée' },
            { value: 'PAID', label: 'Payée' }, { value: 'OVERDUE', label: 'En retard' },
          ]}
        />
      </div>

      {/* Table */}
      <div className="card">
        <Table
          columns={columns}
          data={data?.invoices || []}
          keyExtractor={inv => inv.id}
          onRowClick={inv => navigate(`/invoices/${inv.id}`)}
          loading={isLoading}
          emptyMessage="Aucune facture. Créez votre première facture !"
        />
        <Pagination page={page} total={data?.total || 0} limit={20} onPageChange={setPage} />
      </div>

      {/* Modals */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle facture" size="2xl">
        <InvoiceForm onSuccess={() => setShowCreate(false)} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={showPayment && !!selectedInvoice} onClose={() => { setShowPayment(false); setSelectedInvoice(null); }} title="Enregistrer un paiement" size="md">
        {selectedInvoice && <PaymentModal invoice={selectedInvoice} onClose={() => { setShowPayment(false); setSelectedInvoice(null); }} />}
      </Modal>

      <ConfirmModal
        open={showDelete && !!selectedInvoice}
        onClose={() => { setShowDelete(false); setSelectedInvoice(null); }}
        onConfirm={() => selectedInvoice && deleteMutation.mutate(selectedInvoice.id)}
        title="Supprimer la facture"
        message={`Êtes-vous sûr de vouloir supprimer la facture ${selectedInvoice?.number} ?`}
        confirmLabel="Supprimer"
      />
    </div>
  );
}
