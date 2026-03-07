import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Wrench, Mail, Lock, Chrome, Building } from 'lucide-react';
import toast from 'react-hot-toast';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;
    setLoading(true);
    try {
      const { useAuthStore: store } = await import('@/store/auth.store');
      await useAuthStore.getState().register({ name, email, password, companyName });
      navigate('/');
      toast.success('Compte créé avec succès !');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const API_URL = import.meta.env.VITE_API_URL || '/api';

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center"
        style={{ background: 'linear-gradient(135deg, var(--color-primary-900) 0%, var(--color-primary-600) 100%)' }}>
        <div className="relative z-10 text-center px-12">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-8">
            <Wrench className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">WorkKnock</h1>
          <p className="text-xl text-white/80 mb-8">La plateforme tout-en-un pour les freelances</p>
          <div className="grid grid-cols-2 gap-4 text-left mt-12">
            {[
              { emoji: '📄', title: 'Factures', desc: 'Créez et envoyez vos factures en quelques clics' },
              { emoji: '📊', title: 'Comptabilité', desc: 'Suivez votre CA et vos dépenses en temps réel' },
              { emoji: '📱', title: 'Multi-canaux', desc: 'WhatsApp, Slack, Teams, Telegram' },
              { emoji: '🏖️', title: 'Congés', desc: 'Gérez vos congés selon les règles françaises' },
            ].map(f => (
              <div key={f.title} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-2xl mb-2">{f.emoji}</div>
                <h3 className="font-semibold text-white text-sm">{f.title}</h3>
                <p className="text-white/60 text-xs mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-white/5" />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary-600)' }}>
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900 dark:text-white">WorkKnock</span>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-8">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === t ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Bon retour !</h2>
                <p className="text-slate-500 text-sm mt-1">Connectez-vous à votre espace freelance</p>
              </div>

              <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} leftIcon={<Mail className="w-4 h-4" />} placeholder="vous@exemple.fr" required />
              <Input label="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} leftIcon={<Lock className="w-4 h-4" />} placeholder="••••••••" required />

              <Button type="submit" className="w-full" loading={loading}>Se connecter</Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700" /></div>
                <div className="relative flex justify-center text-xs text-slate-400"><span className="px-2 bg-white dark:bg-slate-950">ou continuer avec</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a href={`${API_URL}/auth/google`} className="btn-secondary justify-center">
                  <Chrome className="w-4 h-4" /> Google
                </a>
                <a href={`${API_URL}/auth/microsoft`} className="btn-secondary justify-center">
                  <Building className="w-4 h-4" /> Microsoft
                </a>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Créer un compte</h2>
                <p className="text-slate-500 text-sm mt-1">Démarrez votre espace freelance gratuit</p>
              </div>

              <Input label="Nom complet" value={name} onChange={e => setName(e.target.value)} placeholder="Jean Dupont" required />
              <Input label="Nom de l'entreprise" value={companyName} onChange={e => setCompanyName(e.target.value)} leftIcon={<Building className="w-4 h-4" />} placeholder="Dupont Consulting" />
              <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} leftIcon={<Mail className="w-4 h-4" />} placeholder="vous@exemple.fr" required />
              <Input label="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} leftIcon={<Lock className="w-4 h-4" />} placeholder="••••••••" required minLength={8} hint="Minimum 8 caractères" />

              <Button type="submit" className="w-full" loading={loading}>Créer mon compte</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
