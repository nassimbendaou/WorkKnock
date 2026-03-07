import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useThemeStore, ThemeColor, ThemeMode, FontFamily, BorderRadius, SidebarStyle } from '@/store/theme.store';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Palette, Building, CreditCard, Bell, Lock, Sun, Moon } from 'lucide-react';
import { useEffect } from 'react';

const THEMES: { color: ThemeColor; label: string; hex: string }[] = [
  { color: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { color: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { color: 'blue', label: 'Bleu', hex: '#3b82f6' },
  { color: 'green', label: 'Vert', hex: '#22c55e' },
  { color: 'rose', label: 'Rose', hex: '#f43f5e' },
  { color: 'orange', label: 'Orange', hex: '#f97316' },
];

const FONTS: { font: FontFamily; label: string }[] = [
  { font: 'inter', label: 'Inter (par défaut)' },
  { font: 'poppins', label: 'Poppins (arrondi)' },
  { font: 'mono', label: 'JetBrains Mono (tech)' },
];

const RADII: { radius: BorderRadius; label: string }[] = [
  { radius: 'none', label: 'Carré' },
  { radius: 'sm', label: 'Petit' },
  { radius: 'md', label: 'Moyen' },
  { radius: 'lg', label: 'Grand' },
  { radius: 'xl', label: 'Extra' },
  { radius: 'full', label: 'Pill' },
];

const SIDEBAR_STYLES: { style: SidebarStyle; label: string }[] = [
  { style: 'colored', label: 'Coloré (thème)' },
  { style: 'dark', label: 'Sombre' },
  { style: 'light', label: 'Clair' },
];

type Tab = 'appearance' | 'company' | 'billing' | 'security';

export function Settings() {
  const { user, updateUser, refreshUser } = useAuthStore();
  const theme = useThemeStore();
  const settings = user?.settings;

  const [tab, setTab] = useState<Tab>('appearance');
  const [company, setCompany] = useState({
    companyName: settings?.companyName || '',
    companyAddress: settings?.companyAddress || '',
    companyCity: settings?.companyCity || '',
    companyPostalCode: settings?.companyPostalCode || '',
    companyCountry: settings?.companyCountry || 'France',
    companySiret: settings?.companySiret || '',
    companyTva: settings?.companyTva || '',
    companyPhone: settings?.companyPhone || '',
    companyEmail: settings?.companyEmail || '',
    companyWebsite: settings?.companyWebsite || '',
    taxRate: String(settings?.taxRate || 20),
    invoicePrefix: settings?.invoicePrefix || 'FAC',
    cpPerYear: String(settings?.cpPerYear || 25),
    rttPerYear: String(settings?.rttPerYear || 0),
  });

  const [bank, setBank] = useState({
    bankIban: settings?.bankIban || '',
    bankBic: settings?.bankBic || '',
    bankName: settings?.bankName || '',
  });

  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' });

  const setC = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setCompany(prev => ({ ...prev, [f]: e.target.value }));
  const setB = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setBank(prev => ({ ...prev, [f]: e.target.value }));

  const settingsMutation = useMutation({
    mutationFn: (data: any) => api.put('/auth/settings', data),
    onSuccess: () => { refreshUser(); toast.success('Paramètres sauvegardés !'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const pwdMutation = useMutation({
    mutationFn: (data: any) => api.put('/auth/password', data),
    onSuccess: () => { setPwd({ current: '', newPwd: '', confirm: '' }); toast.success('Mot de passe mis à jour !'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  // Apply theme on mount and changes
  useEffect(() => { theme.applyTheme(); }, [theme.mode, theme.color, theme.font, theme.radius, theme.sidebarStyle]);

  const tabs = [
    { id: 'appearance', label: 'Apparence', icon: Palette },
    { id: 'company', label: 'Entreprise', icon: Building },
    { id: 'billing', label: 'Facturation & Banque', icon: CreditCard },
    { id: 'security', label: 'Sécurité', icon: Lock },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres</h1>
        <p className="text-slate-500 text-sm mt-1">Personnalisez votre espace WorkKnock</p>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === t.id ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Appearance ── */}
      {tab === 'appearance' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Mode d'affichage</h3>
            <div className="flex gap-3">
              {([['light', 'Clair', Sun], ['dark', 'Sombre', Moon]] as const).map(([mode, label, Icon]) => (
                <button key={mode} onClick={() => theme.setMode(mode as ThemeMode)}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme.mode === mode ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-50)] dark:bg-[var(--color-primary-900)]/10' : 'border-slate-200 dark:border-slate-700'}`}>
                  <Icon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Couleur principale</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {THEMES.map(t => (
                <button key={t.color} onClick={() => theme.setColor(t.color)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme.color === t.color ? 'border-current' : 'border-transparent'}`}
                  style={{ color: t.hex }}>
                  <div className="w-10 h-10 rounded-full shadow-md" style={{ background: t.hex }} />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.label}</span>
                  {theme.color === t.color && <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.hex }} />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="card p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Police</h3>
              <div className="space-y-2">
                {FONTS.map(f => (
                  <button key={f.font} onClick={() => theme.setFont(f.font)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm ${theme.font === f.font ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-medium' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Arrondi des éléments</h3>
              <div className="space-y-2">
                {RADII.map(r => (
                  <button key={r.radius} onClick={() => theme.setRadius(r.radius)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm ${theme.radius === r.radius ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-medium' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Style de la sidebar</h3>
              <div className="space-y-2">
                {SIDEBAR_STYLES.map(s => (
                  <button key={s.style} onClick={() => theme.setSidebarStyle(s.style)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm ${theme.sidebarStyle === s.style ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-medium' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Company ── */}
      {tab === 'company' && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Informations de l'entreprise</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nom de l'entreprise" value={company.companyName} onChange={setC('companyName')} className="col-span-2" />
            <Input label="Adresse" value={company.companyAddress} onChange={setC('companyAddress')} className="col-span-2" />
            <Input label="Code postal" value={company.companyPostalCode} onChange={setC('companyPostalCode')} />
            <Input label="Ville" value={company.companyCity} onChange={setC('companyCity')} />
            <Input label="SIRET" value={company.companySiret} onChange={setC('companySiret')} placeholder="12345678900012" />
            <Input label="N° TVA intracommunautaire" value={company.companyTva} onChange={setC('companyTva')} placeholder="FR12345678901" />
            <Input label="Email de facturation" type="email" value={company.companyEmail} onChange={setC('companyEmail')} />
            <Input label="Téléphone" value={company.companyPhone} onChange={setC('companyPhone')} />
            <Input label="Site web" value={company.companyWebsite} onChange={setC('companyWebsite')} />
            <Input label="Taux TVA par défaut (%)" type="number" value={company.taxRate} onChange={setC('taxRate')} min="0" max="100" step="0.1" />
            <Input label="Préfixe des factures" value={company.invoicePrefix} onChange={setC('invoicePrefix')} placeholder="FAC" />
            <div />
            <Input label="Congés payés/an (jours)" type="number" value={company.cpPerYear} onChange={setC('cpPerYear')} min="0" />
            <Input label="RTT/an (jours)" type="number" value={company.rttPerYear} onChange={setC('rttPerYear')} min="0" />
          </div>
          <div className="flex justify-end pt-2">
            <Button loading={settingsMutation.isPending} onClick={() => settingsMutation.mutate({ ...company, taxRate: Number(company.taxRate), cpPerYear: Number(company.cpPerYear), rttPerYear: Number(company.rttPerYear) })}>
              Sauvegarder
            </Button>
          </div>
        </div>
      )}

      {/* ── Billing / Bank ── */}
      {tab === 'billing' && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Informations bancaires</h3>
          <p className="text-sm text-slate-500">Ces informations apparaissent sur vos factures PDF.</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="IBAN" value={bank.bankIban} onChange={setB('bankIban')} placeholder="FR76 0000 0000 0000 0000 0000 000" className="col-span-2" />
            <Input label="BIC / SWIFT" value={bank.bankBic} onChange={setB('bankBic')} placeholder="BNPAFRPPXXX" />
            <Input label="Nom de la banque" value={bank.bankName} onChange={setB('bankName')} placeholder="BNP Paribas" />
          </div>
          <div className="flex justify-end pt-2">
            <Button loading={settingsMutation.isPending} onClick={() => settingsMutation.mutate(bank)}>
              Sauvegarder
            </Button>
          </div>
        </div>
      )}

      {/* ── Security ── */}
      {tab === 'security' && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Changer le mot de passe</h3>
          <Input label="Mot de passe actuel" type="password" value={pwd.current} onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} />
          <Input label="Nouveau mot de passe" type="password" value={pwd.newPwd} onChange={e => setPwd(p => ({ ...p, newPwd: e.target.value }))} minLength={8} hint="Minimum 8 caractères" />
          <Input label="Confirmer le mot de passe" type="password" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} error={pwd.confirm && pwd.newPwd !== pwd.confirm ? 'Les mots de passe ne correspondent pas' : ''} />
          <div className="flex justify-end">
            <Button loading={pwdMutation.isPending} onClick={() => {
              if (pwd.newPwd !== pwd.confirm) { toast.error('Les mots de passe ne correspondent pas'); return; }
              pwdMutation.mutate({ currentPassword: pwd.current, newPassword: pwd.newPwd });
            }}>
              Mettre à jour
            </Button>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Sessions actives</h4>
            <p className="text-sm text-slate-500">Compte: <strong>{user?.email}</strong></p>
            {user?.ssoProvider && <p className="text-sm text-slate-500 mt-1">Connecté via SSO: <strong>{user.ssoProvider}</strong></p>}
          </div>
        </div>
      )}
    </div>
  );
}
