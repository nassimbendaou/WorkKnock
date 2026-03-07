import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatMoney = (amount: number, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);

export const formatDate = (date: string | Date) =>
  new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

export const formatShortDate = (date: string | Date) =>
  new Date(date).toLocaleDateString('fr-FR');

export const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', SENT: 'Envoyée', PAID: 'Payée', OVERDUE: 'En retard', CANCELLED: 'Annulée',
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', ACTIVE: 'Actif', COMPLETED: 'Terminé', TERMINATED: 'Résilié',
};

export const CONTRACT_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  TERMINATED: 'bg-red-100 text-red-700',
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  REGIE: 'Régie', FORFAIT: 'Forfait', PORTAGE: 'Portage salarial',
};

export const EXPENSE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', SUBMITTED: 'Soumise', APPROVED: 'Approuvée', REJECTED: 'Rejetée',
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: 'Transport', REPAS: 'Repas', HEBERGEMENT: 'Hébergement',
  MATERIEL: 'Matériel', LOGICIEL: 'Logiciel', TELEPHONE: 'Téléphone',
  FORMATION: 'Formation', AUTRE: 'Autre',
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  CP: 'Congés Payés', RTT: 'RTT', MALADIE: 'Maladie', SANS_SOLDE: 'Sans solde', AUTRE: 'Autre',
};

export const LEAVE_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export const daysUntil = (date: string | Date): number => {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
