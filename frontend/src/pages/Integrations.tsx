import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Slack, Bell, Send, Copy, CheckCircle, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Integration } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import { formatShortDate } from '@/lib/utils';

const INTEGRATIONS_CONFIG = [
  {
    type: 'WHATSAPP',
    name: 'WhatsApp',
    description: 'Gérez vos factures via WhatsApp. Posez vos questions au bot pour obtenir des infos.',
    icon: '📱',
    color: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800',
    headerColor: 'bg-green-500',
    fields: [
      { key: 'instanceId', label: 'Instance ID (Green API)', placeholder: '1234567890' },
      { key: 'apiToken', label: 'API Token', placeholder: 'votre-token-green-api' },
    ],
    commands: ['/aide', '/factures [client]', '/facture [numéro]', '/ca [année]', '/impayes', '/conges', '/clients'],
    setupUrl: 'https://green-api.com',
    setupLabel: 'Créer un compte Green API',
  },
  {
    type: 'TELEGRAM',
    name: 'Telegram',
    description: 'Recevez vos informations et téléchargez vos factures directement dans Telegram.',
    icon: '✈️',
    color: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
    headerColor: 'bg-blue-500',
    fields: [
      { key: 'botToken', label: 'Bot Token (BotFather)', placeholder: '123456:ABC-DEF...' },
    ],
    commands: ['/start', '/factures', '/facture [numéro]', '/ca [année]', '/impayes', '/conges', '/clients'],
    setupUrl: 'https://t.me/botfather',
    setupLabel: 'Créer un bot Telegram',
  },
  {
    type: 'SLACK',
    name: 'Slack',
    description: 'Slash commands Slack pour accéder à vos données depuis votre workspace.',
    icon: '💼',
    color: 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800',
    headerColor: 'bg-purple-500',
    fields: [
      { key: 'botToken', label: 'Bot OAuth Token', placeholder: 'xoxb-...' },
      { key: 'signingSecret', label: 'Signing Secret', placeholder: 'votre-signing-secret' },
    ],
    commands: ['/workknock-factures', '/workknock-ca', '/workknock-impayes'],
    setupUrl: 'https://api.slack.com/apps',
    setupLabel: 'Créer une Slack App',
  },
  {
    type: 'TEAMS',
    name: 'Microsoft Teams',
    description: 'Intégration avec Microsoft Teams via Incoming Webhooks.',
    icon: '🏢',
    color: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800',
    headerColor: 'bg-indigo-500',
    fields: [
      { key: 'webhookUrl', label: 'Incoming Webhook URL', placeholder: 'https://xxx.webhook.office.com/...' },
    ],
    commands: ['factures', 'ca', 'impayes'],
    setupUrl: 'https://docs.microsoft.com/teams',
    setupLabel: 'Configurer Teams Webhooks',
  },
];

function IntegrationCard({ config, integration, userId }: { config: typeof INTEGRATIONS_CONFIG[0]; integration?: Integration; userId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries(config.fields.map(f => [f.key, (integration?.config as any)?.[f.key] || '']))
  );
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/api/webhooks/${config.type.toLowerCase()}/${userId}`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/integrations/${config.type}`, { config: fields, enabled: true, webhookUrl }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integrations'] }); toast.success(`${config.name} configuré !`); setShowForm(false); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  const toggleMutation = useMutation({
    mutationFn: () => api.post(`/integrations/${config.type}/toggle`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integrations'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/integrations/${config.type}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integrations'] }); toast.success('Intégration supprimée'); },
  });

  const isEnabled = integration?.enabled;
  const isConfigured = !!integration;

  return (
    <>
      <div className={`card border ${config.color} overflow-hidden`} padding={false}>
        <div className={`${config.headerColor} px-5 py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{config.icon}</span>
              <div>
                <h3 className="font-semibold text-white">{config.name}</h3>
                <p className="text-xs text-white/70">Bot / Integration</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConfigured ? (
                <span className={`badge ${isEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'} text-xs`}>
                  {isEnabled ? '● Actif' : '○ Inactif'}
                </span>
              ) : (
                <span className="badge bg-white/20 text-white text-xs">Non configuré</span>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">{config.description}</p>

          {/* Commands */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Commandes disponibles:</p>
            <div className="flex flex-wrap gap-1.5">
              {config.commands.map(cmd => (
                <code key={cmd} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                  {cmd}
                </code>
              ))}
            </div>
          </div>

          {/* Webhook URL */}
          {isConfigured && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">URL Webhook:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg truncate">{webhookUrl}</code>
                <button onClick={copyWebhook} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={() => setShowForm(true)} variant={isConfigured ? 'secondary' : 'primary'} size="sm" className="flex-1">
              {isConfigured ? '⚙️ Reconfigurer' : '+ Configurer'}
            </Button>
            {isConfigured && (
              <>
                <Button onClick={() => toggleMutation.mutate()} variant="outline" size="sm" loading={toggleMutation.isPending}>
                  {isEnabled ? 'Désactiver' : 'Activer'}
                </Button>
                <Button onClick={() => deleteMutation.mutate()} variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                  ✕
                </Button>
              </>
            )}
          </div>

          <a href={config.setupUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-primary-600)] hover:underline">
            {config.setupLabel} →
          </a>
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={`Configurer ${config.name}`} size="md">
        <div className="space-y-4">
          {config.fields.map(f => (
            <Input
              key={f.key}
              label={f.label}
              value={fields[f.key]}
              onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              type={f.key.toLowerCase().includes('token') || f.key.toLowerCase().includes('secret') ? 'password' : 'text'}
            />
          ))}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">URL Webhook à configurer:</p>
            <code className="text-xs text-blue-600 break-all">{webhookUrl}</code>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>Sauvegarder</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

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
        <p className="text-slate-500 text-sm mt-1">Connectez WorkKnock à vos outils de communication</p>
      </div>

      <NotificationsPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {INTEGRATIONS_CONFIG.map(config => (
          <IntegrationCard
            key={config.type}
            config={config}
            integration={intMap[config.type]}
            userId={user?.id || ''}
          />
        ))}
      </div>
    </div>
  );
}
