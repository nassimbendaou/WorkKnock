import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { KpiCard } from '@/components/ui/Card';
import { TrendingUp, Users, Receipt, AlertCircle, Briefcase, Calculator, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { formatMoney, formatShortDate, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/auth.store';
import { MONTHS_FR } from '@/lib/utils';

const COLORS = ['#4f46e5', '#22c55e', '#f97316', '#ef4444', '#8b5cf6'];

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/revenue/dashboard').then(r => r.data),
    refetchInterval: 60000,
  });

  const kpis = data?.kpis;
  const chartData = data?.chartData || [];
  const recentInvoices = data?.recentInvoices || [];

  // Invoice status distribution
  const invoiceStats = data?.invoiceStats || [];
  const pieData = invoiceStats.map((s: any) => ({
    name: INVOICE_STATUS_LABELS[s.status] || s.status,
    value: Number(s._sum?.total) || 0,
    count: s._count,
  }));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {greeting}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Voici un aperçu de votre activité freelance
          </p>
        </div>
        <div className="text-right text-sm text-slate-500 hidden sm:block">
          <p>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="CA de l'année"
          value={isLoading ? '...' : formatMoney(kpis?.yearRevenue || 0)}
          subtitle="Factures payées"
          icon={<TrendingUp className="w-5 h-5" />}
          color="primary"
          onClick={() => navigate('/revenue')}
        />
        <KpiCard
          title="CA du mois"
          value={isLoading ? '...' : formatMoney(kpis?.monthRevenue || 0)}
          subtitle={MONTHS_FR[new Date().getMonth()]}
          icon={<Receipt className="w-5 h-5" />}
          color="blue"
          onClick={() => navigate('/invoices')}
        />
        <KpiCard
          title="Impayés"
          value={isLoading ? '...' : formatMoney(kpis?.unpaidTotal || 0)}
          subtitle={`${kpis?.unpaidCount || 0} facture(s)`}
          icon={<AlertCircle className="w-5 h-5" />}
          color="red"
          onClick={() => navigate('/invoices/unpaid')}
        />
        <KpiCard
          title="Clients actifs"
          value={isLoading ? '...' : String(kpis?.clientCount || 0)}
          subtitle={`${kpis?.activeContracts || 0} contrat(s) actif(s)`}
          icon={<Users className="w-5 h-5" />}
          color="green"
          onClick={() => navigate('/clients')}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="xl:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Chiffre d'affaires</h3>
              <p className="text-xs text-slate-500 mt-0.5">12 derniers mois</p>
            </div>
            <button onClick={() => navigate('/revenue')} className="text-xs text-[var(--color-primary-600)] hover:underline flex items-center gap-1">
              Détails <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary-600)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-primary-600)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k€`} />
              <Tooltip
                formatter={(v: number) => [formatMoney(v), 'CA']}
                contentStyle={{ border: 'none', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="var(--color-primary-600)" strokeWidth={2} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-6">Statuts des factures</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value, entry: any) => (
                    <span style={{ fontSize: 11, color: '#64748b' }}>{value}: {entry.payload.count}</span>
                  )}
                />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Aucune facture</div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent invoices */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Factures récentes</h3>
            <button onClick={() => navigate('/invoices')} className="text-xs text-[var(--color-primary-600)] hover:underline flex items-center gap-1">
              Voir tout <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {recentInvoices.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Aucune facture</p>
            ) : recentInvoices.map((inv: any) => (
              <div key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] dark:bg-[var(--color-primary-900)]/20 flex items-center justify-center">
                    <Receipt className="w-4 h-4 text-[var(--color-primary-600)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{inv.number}</p>
                    <p className="text-xs text-slate-500">{inv.client?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatMoney(inv.total)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${INVOICE_STATUS_COLORS[inv.status]}`}>
                    {INVOICE_STATUS_LABELS[inv.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Actions rapides</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Nouvelle facture', icon: Receipt, color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20', to: '/invoices/new' },
              { label: 'Nouveau client', icon: Users, color: 'bg-green-50 text-green-600 dark:bg-green-900/20', to: '/clients' },
              { label: 'Note de frais', icon: Calculator, color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20', to: '/expenses' },
              { label: 'Poser des congés', icon: Briefcase, color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20', to: '/leaves' },
            ].map(action => (
              <button
                key={action.label}
                onClick={() => navigate(action.to)}
                className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all text-left"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{action.label}</span>
              </button>
            ))}
          </div>

          {/* Expenses summary */}
          {kpis && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Frais de l'année</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(kpis.yearExpenses)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-slate-500">Net estimé</span>
                <span className="font-semibold text-green-600">{formatMoney(kpis.yearRevenue - kpis.yearExpenses)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
