import { useThemeStore } from '@/store/theme.store';
import { useAuthStore } from '@/store/auth.store';
import { Bell, Moon, Sun, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export function Header() {
  const { mode, setMode } = useThemeStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data: notifData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/integrations/notifications?unread=true').then(r => r.data),
    refetchInterval: 30000,
  });

  const unreadCount = notifData?.unreadCount || 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/invoices?search=${encodeURIComponent(search)}`);
  };

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 px-6">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une facture, un client..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent"
          />
        </div>
      </form>

      <div className="flex items-center gap-2 ml-auto">
        {/* Dark mode toggle */}
        <button
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
          title="Changer le thème"
        >
          {mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate('/integrations')}
          className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
          )}
        </button>

        {/* User */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900 dark:text-white leading-none">{user?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{user?.settings?.companyName || 'Freelance'}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-600)] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="" />
            ) : (
              (user?.name || 'U').charAt(0).toUpperCase()
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
