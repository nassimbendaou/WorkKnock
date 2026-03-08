import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Phone, QrCode, CheckCircle, MessageSquare } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Integration } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import { formatShortDate } from '@/lib/utils';

// Free QR code API
const qrUrl = (data: string, size = 200) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=000000&margin=10`;

// ── WhatsApp Card ──
function WhatsAppCard({ integration }: { integration?: Integration }) {
  const qc = useQueryClient();
  const [phone, setPhone] = useState('');
  const isConnected = !!integration?.enabled;
  const connectedPhone = (integration?.config as any)?.phone || '';

  const { data: botInfo } = useQuery({
    queryKey: ['bot-info'],
    queryFn: () => api.get('/integrations/bot-info').then(r => r.data),
  });

  const connectMutation = useMutation({
    mutationFn: (p: string) => api.post('/integrations/connect/whatsapp', { phone: p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('WhatsApp connecté ! Vérifiez vos messages 📱');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete('/integrations/WHATSAPP'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('WhatsApp déconnecté');
      setPhone('');
    },
  });

  const botPhone = botInfo?.whatsapp?.botPhone;
  const waLink = botPhone ? `https://wa.me/${botPhone}` : '';

  return (
    <div className="card overflow-hidden border-2 border-green-200 dark:border-green-800">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">📱</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white">WhatsApp</h3>
            <p className="text-sm text-white/80">Assistant IA intelligent</p>
          </div>
          {isConnected ? (
            <span className="flex items-center gap-2 bg-green-700/50 px-3 py-1.5 rounded-full text-white text-sm">
              <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" /> Connecté
            </span>
          ) : (
            <span className="bg-white/20 px-3 py-1.5 rounded-full text-white text-sm">Non connecté</span>
          )}
        </div>
      </div>

      <div className="p-6">
        {!isConnected ? (
          /* ── Not connected: phone input + connect ── */
          <div className="space-y-5">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Connectez votre WhatsApp en <strong>2 secondes</strong>. Entrez votre numéro et le bot vous envoie un message !
            </p>

            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+212 6XX XXX XXX (avec indicatif pays)"
                />
              </div>
              <Button
                onClick={() => connectMutation.mutate(phone)}
                loading={connectMutation.isPending}
                disabled={!phone || phone.replace(/[^0-9]/g, '').length < 8}
              >
                🔗 Connecter
              </Button>
            </div>

            {/* Examples */}
            <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl">
              <p className="text-xs text-green-700 dark:text-green-400 mb-3 font-medium">💡 Parlez au bot en langage naturel :</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  '"Crée une facture pour Dupont de 500€"',
                  '"Quelles sont mes factures impayées ?"',
                  '"Ajoute un client Martin"',
                  '"Quel est mon CA cette année ?"',
                  '"Marque la facture FAC-001 payée"',
                  '"Combien de congés il me reste ?"',
                ].map(ex => (
                  <p key={ex} className="text-xs text-green-600 dark:text-green-500 italic">{ex}</p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── Connected: QR code + status ── */
          <div className="flex items-start gap-6">
            {/* QR Code */}
            {waLink && (
              <div className="flex-shrink-0 text-center">
                <div className="bg-white p-3 rounded-2xl shadow-sm border">
                  <img src={qrUrl(waLink)} alt="QR WhatsApp" className="w-40 h-40 rounded-lg" />
                </div>
                <p className="text-xs text-slate-500 mt-2">Scannez pour ouvrir le chat</p>
              </div>
            )}

            <div className="flex-1 space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Numéro connecté</p>
                <p className="font-semibold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                  <Phone className="w-4 h-4" /> +{connectedPhone}
                </p>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400">
                Envoyez un message au bot pour gérer vos factures, clients et comptabilité par IA 🤖
              </p>

              <div className="flex gap-2">
                {waLink && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="primary" size="sm" className="w-full">
                      <MessageSquare className="w-4 h-4 mr-1" /> Ouvrir WhatsApp
                    </Button>
                  </a>
                )}
                <Button
                  onClick={() => disconnectMutation.mutate()}
                  variant="ghost" size="sm"
                  className="text-red-500 hover:text-red-700"
                  loading={disconnectMutation.isPending}
                >
                  Déconnecter
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Telegram Card ──
function TelegramCard({ integration }: { integration?: Integration }) {
  const { data: botInfo } = useQuery({
    queryKey: ['bot-info'],
    queryFn: () => api.get('/integrations/bot-info').then(r => r.data),
  });
  const isConfigured = botInfo?.telegram?.configured;
  const isConnected = !!integration?.enabled;

  return (
    <div className="card overflow-hidden border border-blue-200 dark:border-blue-800">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">✈️</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white">Telegram</h3>
            <p className="text-sm text-white/80">Bot de gestion</p>
          </div>
          <span className="bg-white/20 px-3 py-1.5 rounded-full text-white text-sm">
            {isConnected ? '● Connecté' : isConfigured ? 'Disponible' : '🔜 Bientôt'}
          </span>
        </div>
      </div>
      <div className="p-6 text-center">
        {isConfigured ? (
          <p className="text-sm text-slate-600 dark:text-slate-400 py-4">
            Scannez le QR code ou cherchez le bot Telegram pour commencer.
          </p>
        ) : (
          <p className="text-sm text-slate-500 py-4">
            🔜 Bientôt disponible. Le bot Telegram sera activé prochainement.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Coming Soon Card ──
function ComingSoonCard({ name, icon, description }: { name: string; icon: string; description: string }) {
  return (
    <div className="card overflow-hidden border border-slate-200 dark:border-slate-700 opacity-75">
      <div className="bg-gradient-to-r from-slate-500 to-slate-600 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">{icon}</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white">{name}</h3>
            <p className="text-sm text-white/80">{description}</p>
          </div>
          <span className="bg-white/20 px-3 py-1.5 rounded-full text-white text-sm">🔜 Bientôt</span>
        </div>
      </div>
      <div className="p-6 text-center">
        <p className="text-sm text-slate-500 py-4">Cette intégration sera bientôt disponible.</p>
      </div>
    </div>
  );
}

// ── Notifications Panel ──
function NotificationsPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/integrations/notifications').then(r => r.data),
  });

  const markRead = useMutation({
    mutationFn: () => api.post('/integrations/notifications/read'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.notifications || [];

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Bell className="w-5 h-5" /> Notifications ({data?.unreadCount || 0} non lues)
        </h3>
        {data?.unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markRead.mutate()}>Tout marquer lu</Button>
        )}
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Aucune notification</p>
        ) : notifications.map((n: any) => (
          <div key={n.id} className={`p-3 rounded-lg flex items-start gap-3 ${n.read ? 'bg-slate-50 dark:bg-slate-800/50' : 'bg-[var(--color-primary-50)] dark:bg-[var(--color-primary-900)]/10 border border-[var(--color-primary-100)] dark:border-[var(--color-primary-800)]'}`}>
            {!n.read && <div className="w-2 h-2 rounded-full bg-[var(--color-primary-600)] mt-1.5 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{n.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
              <p className="text-xs text-slate-400 mt-1">{formatShortDate(n.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──
export function Integrations() {
  const { user } = useAuthStore();
  const { data: integrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get('/integrations').then(r => r.data),
  });

  const intMap: Record<string, Integration> = {};
  if (Array.isArray(integrations)) {
    integrations.forEach((i: Integration) => { intMap[i.type] = i; });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Intégrations</h1>
        <p className="text-slate-500 text-sm mt-1">Scannez le QR code et commencez à utiliser le bot — aucune configuration technique</p>
      </div>

      <NotificationsPanel />

      {/* Main integration: WhatsApp (full width) */}
      <WhatsAppCard integration={intMap['WHATSAPP']} />

      {/* Secondary integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TelegramCard integration={intMap['TELEGRAM']} />
        <ComingSoonCard name="Slack" icon="💼" description="Commandes Slack" />
        <ComingSoonCard name="Teams" icon="🏢" description="Intégration Teams" />
      </div>
    </div>
  );
}
