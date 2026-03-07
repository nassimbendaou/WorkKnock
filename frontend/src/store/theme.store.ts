import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeColor = 'indigo' | 'violet' | 'blue' | 'green' | 'rose' | 'orange';
export type ThemeMode = 'light' | 'dark';
export type FontFamily = 'inter' | 'poppins' | 'mono';
export type BorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type SidebarStyle = 'colored' | 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  color: ThemeColor;
  font: FontFamily;
  radius: BorderRadius;
  sidebarStyle: SidebarStyle;
  sidebarCollapsed: boolean;
  setMode: (mode: ThemeMode) => void;
  setColor: (color: ThemeColor) => void;
  setFont: (font: FontFamily) => void;
  setRadius: (radius: BorderRadius) => void;
  setSidebarStyle: (style: SidebarStyle) => void;
  toggleSidebar: () => void;
  applyTheme: () => void;
}

const COLOR_VARIABLES: Record<ThemeColor, Record<string, string>> = {
  indigo: {
    '--color-primary-50': '#eef2ff', '--color-primary-100': '#e0e7ff',
    '--color-primary-500': '#6366f1', '--color-primary-600': '#4f46e5',
    '--color-primary-700': '#4338ca', '--color-sidebar': '#1e1b4b',
  },
  violet: {
    '--color-primary-50': '#f5f3ff', '--color-primary-100': '#ede9fe',
    '--color-primary-500': '#8b5cf6', '--color-primary-600': '#7c3aed',
    '--color-primary-700': '#6d28d9', '--color-sidebar': '#2e1065',
  },
  blue: {
    '--color-primary-50': '#eff6ff', '--color-primary-100': '#dbeafe',
    '--color-primary-500': '#3b82f6', '--color-primary-600': '#2563eb',
    '--color-primary-700': '#1d4ed8', '--color-sidebar': '#1e3a5f',
  },
  green: {
    '--color-primary-50': '#f0fdf4', '--color-primary-100': '#dcfce7',
    '--color-primary-500': '#22c55e', '--color-primary-600': '#16a34a',
    '--color-primary-700': '#15803d', '--color-sidebar': '#14532d',
  },
  rose: {
    '--color-primary-50': '#fff1f2', '--color-primary-100': '#ffe4e6',
    '--color-primary-500': '#f43f5e', '--color-primary-600': '#e11d48',
    '--color-primary-700': '#be123c', '--color-sidebar': '#4c0519',
  },
  orange: {
    '--color-primary-50': '#fff7ed', '--color-primary-100': '#ffedd5',
    '--color-primary-500': '#f97316', '--color-primary-600': '#ea580c',
    '--color-primary-700': '#c2410c', '--color-sidebar': '#431407',
  },
};

const SIDEBAR_VARS: Record<SidebarStyle, Record<string, string>> = {
  colored: { '--color-sidebar-text': 'rgba(255,255,255,0.9)' },
  dark: { '--color-sidebar': '#0f172a', '--color-sidebar-text': 'rgba(255,255,255,0.9)' },
  light: { '--color-sidebar': '#f8fafc', '--color-sidebar-text': '#1e293b' },
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      color: 'indigo',
      font: 'inter',
      radius: 'md',
      sidebarStyle: 'colored',
      sidebarCollapsed: false,

      setMode: (mode) => { set({ mode }); get().applyTheme(); },
      setColor: (color) => { set({ color }); get().applyTheme(); },
      setFont: (font) => { set({ font }); get().applyTheme(); },
      setRadius: (radius) => { set({ radius }); get().applyTheme(); },
      setSidebarStyle: (sidebarStyle) => { set({ sidebarStyle }); get().applyTheme(); },
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      applyTheme: () => {
        const { mode, color, font, radius, sidebarStyle } = get();
        const root = document.documentElement;

        // Dark/light mode
        root.classList.toggle('dark', mode === 'dark');

        // Color variables
        const vars = COLOR_VARIABLES[color] || COLOR_VARIABLES.indigo;
        Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));

        // Sidebar
        const sidebarVars = SIDEBAR_VARS[sidebarStyle];
        if (sidebarStyle !== 'colored') {
          Object.entries(sidebarVars).forEach(([k, v]) => root.style.setProperty(k, v));
        } else {
          root.style.setProperty('--color-sidebar-text', 'rgba(255,255,255,0.9)');
          root.style.setProperty('--color-sidebar', vars['--color-sidebar'] || '#1e1b4b');
        }

        // Font
        const fontMap: Record<string, string> = {
          inter: 'Inter', poppins: 'Poppins', mono: 'JetBrains Mono',
        };
        root.style.setProperty('--font-family', `'${fontMap[font]}', sans-serif`);

        // Radius
        const radiusMap: Record<string, string> = {
          none: '0', sm: '0.25rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', full: '9999px',
        };
        root.style.setProperty('--border-radius', radiusMap[radius] || '0.5rem');
      },
    }),
    { name: 'wk_theme' }
  )
);
