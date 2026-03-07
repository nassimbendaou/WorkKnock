import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/theme.store';
import { useAuthStore } from '@/store/auth.store';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, Receipt, DollarSign,
  Calculator, Calendar, Settings, ChevronLeft, ChevronRight,
  Briefcase, TrendingUp, Bell, Plug, FileCheck, AlertCircle,
  LogOut, Wrench,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';

const navItems = [
  { label: 'Tableau de bord', icon: LayoutDashboard, to: '/' },
  { label: 'Chiffre d\'affaires', icon: TrendingUp, to: '/revenue' },
  { divider: true, label: 'Gestion' },
  { label: 'Clients', icon: Users, to: '/clients' },
  { label: 'Contrats', icon: FileCheck, to: '/contracts' },
  { label: 'Intercontrat', icon: Briefcase, to: '/intercontract' },
  { divider: true, label: 'Finance' },
  { label: 'Factures', icon: Receipt, to: '/invoices' },
  { label: 'Impayés', icon: AlertCircle, to: '/invoices/unpaid' },
  { label: 'Notes de frais', icon: Calculator, to: '/expenses' },
  { label: 'Fiches de paie', icon: DollarSign, to: '/payslips' },
  { divider: true, label: 'RH' },
  { label: 'Congés', icon: Calendar, to: '/leaves' },
  { divider: true, label: 'Configuration' },
  { label: 'Intégrations', icon: Plug, to: '/integrations' },
  { label: 'Paramètres', icon: Settings, to: '/settings' },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useThemeStore();
  const { user, logout } = useAuthStore();

  return (
    <aside
      style={{ background: 'var(--color-sidebar)' }}
      className={cn(
        'flex flex-col h-full transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <span className="font-bold text-white text-lg tracking-tight">WorkKnock</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item, idx) => {
          if ('divider' in item && item.divider) {
            return !sidebarCollapsed ? (
              <div key={idx} className="px-3 pt-4 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{item.label}</span>
              </div>
            ) : <div key={idx} className="my-2 border-t border-white/10" />;
          }

          return (
            <NavLink
              key={item.to}
              to={item.to!}
              end={item.to === '/'}
              className={({ isActive }) => cn(
                'sidebar-link',
                isActive && 'active',
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              {item.icon && <item.icon className="w-5 h-5 flex-shrink-0" />}
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 p-3">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                getInitials(user?.name || 'U')
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/50 truncate">{user?.email}</p>
            </div>
            <button onClick={logout} className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Déconnexion">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={logout} className="sidebar-link justify-center" title="Déconnexion">
            <LogOut className="w-5 h-5" />
          </button>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="w-full mt-2 flex items-center justify-center p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          title={sidebarCollapsed ? 'Développer' : 'Réduire'}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
