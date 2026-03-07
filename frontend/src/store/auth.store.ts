import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import api from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; companyName?: string }) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('wk_token', data.token);
        set({ user: data.user, token: data.token, isAuthenticated: true });
      },

      register: async (formData) => {
        const { data } = await api.post('/auth/register', formData);
        localStorage.setItem('wk_token', data.token);
        set({ user: data.user, token: data.token, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('wk_token');
        localStorage.removeItem('wk_user');
        set({ user: null, token: null, isAuthenticated: false });
      },

      updateUser: (updated) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...updated } });
      },

      refreshUser: async () => {
        const { data } = await api.get('/auth/me');
        set({ user: data });
      },
    }),
    {
      name: 'wk_auth',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
