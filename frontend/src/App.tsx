import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from './store/auth.store';
import { useThemeStore } from './store/theme.store';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/auth/Login';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { Contracts } from './pages/Contracts';
import { Invoices } from './pages/Invoices';
import { Expenses } from './pages/Expenses';
import { PaySlips } from './pages/PaySlips';
import { Leaves } from './pages/Leaves';
import { Revenue } from './pages/Revenue';
import { Integrations } from './pages/Integrations';
import { Settings } from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// Saves token then hard-reloads to / so Zustand rehydrates cleanly
function AuthCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('wk_token', token);
      window.location.replace('/');
    } else {
      window.location.replace('/login');
    }
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-[var(--color-primary-600)] border-t-transparent rounded-full" />
    </div>
  );
}

// On every app load: if a token exists but we're not authenticated yet, fetch the user
function TokenInit() {
  const { isAuthenticated, refreshUser, logout } = useAuthStore();
  useEffect(() => {
    const token = localStorage.getItem('wk_token');
    if (token && !isAuthenticated) {
      refreshUser().catch(() => logout());
    }
  }, []);
  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ThemeInit() {
  const theme = useThemeStore();
  useEffect(() => { theme.applyTheme(); }, []);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeInit />
        <TokenInit />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="revenue" element={<Revenue />} />
            <Route path="clients" element={<Clients />} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="intercontract" element={<Contracts />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/new" element={<Invoices />} />
            <Route path="invoices/unpaid" element={<Invoices />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="payslips" element={<PaySlips />} />
            <Route path="leaves" element={<Leaves />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
