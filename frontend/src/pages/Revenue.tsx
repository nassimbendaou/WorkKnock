import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { MONTHS_FR } from '@/lib/utils';
import { TrendingUp, Receipt, AlertCircle, CheckCircle } from 'lucide-react';

const COLORS = ['#4f46e5', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4'];

export function Revenue() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['revenue-stats', year],
    queryFn: () => api.get('/revenue/stats', { params: { year } }).then(r => r.data),
  });

  const monthData = data?.byMonth?.map((m: any) => ({
    name: MONTHS_FR[m.month - 1].slice(0, 3),
    CA: m.revenue,
    Factures: m.count,
  })) || [];

  const clientData = data?.byClient?.slice(0, 10) || [];

  const summary = data?.summary || {};
  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Chiffre d'affaires</h1>
          <p className="text-slate-500 text-sm mt-1">Analyse de vos revenus</p>
        </div>
        <select
          className="input w-32"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
        >
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Facturé & payé</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatMoney(summary.paid?.total || 0)}</p>
            <p className="text-xs text-slate-500">{summary.paid?.count || 0} facture(s)</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <Receipt className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">En attente</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatMoney(summary.sent?.total || 0)}</p>
            <p className="text-xs text-slate-500">{summary.sent?.count || 0} facture(s)</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">En retard</p>
            <p className="text-2xl font-bold text-red-600">{formatMoney(summary.overdue?.total || 0)}</p>
            <p className="text-xs text-slate-500">{summary.overdue?.count || 0} facture(s)</p>
          </div>
        </div>
      </div>

      {/* Monthly chart */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-6">CA mensuel {year}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k€`} />
            <Tooltip
              formatter={(v: number, name: string) => [name === 'CA' ? formatMoney(v) : v, name]}
              contentStyle={{ border: 'none', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
            />
            <Bar dataKey="CA" fill="var(--color-primary-600)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* By client */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">CA par client {year}</h3>
          <div className="space-y-3">
            {clientData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Aucune donnée</p>
            ) : clientData.map((c: any, i: number) => {
              const max = clientData[0]?.revenue || 1;
              return (
                <div key={c.clientName}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{c.clientName}</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatMoney(c.revenue)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(c.revenue / max) * 100}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{c.count} facture(s)</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cumulative */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Cumul CA {year}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthData.map((m: any, i: number) => ({
              ...m,
              Cumulé: monthData.slice(0, i + 1).reduce((s: number, x: any) => s + x.CA, 0),
            }))}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary-600)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-primary-600)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k€`} />
              <Tooltip formatter={(v: number) => [formatMoney(v), 'Cumulé']} contentStyle={{ border: 'none', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="Cumulé" stroke="var(--color-primary-600)" strokeWidth={2} fill="url(#cumGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
