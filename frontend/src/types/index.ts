export interface User {
  id: string;
  email: string;
  name: string;
  role: 'FREELANCER' | 'ADMIN';
  avatar?: string;
  ssoProvider?: string;
  settings?: UserSettings;
  createdAt: string;
}

export interface UserSettings {
  id: string;
  userId: string;
  theme: string;
  primaryColor: string;
  accentColor: string;
  sidebarColor: string;
  fontFamily: string;
  borderRadius: string;
  sidebarCollapsed: boolean;
  language: string;
  currency: string;
  taxRate: number;
  companyName?: string;
  companyAddress?: string;
  companyCity?: string;
  companyPostalCode?: string;
  companyCountry: string;
  companySiret?: string;
  companyTva?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  bankIban?: string;
  bankBic?: string;
  bankName?: string;
  logoUrl?: string;
  invoicePrefix: string;
  invoiceNextNumber: number;
  cpPerYear: number;
  rttPerYear: number;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country: string;
  siret?: string;
  tva?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE';
  _count?: { invoices: number; contracts: number };
  totalRevenue?: number;
  createdAt: string;
}

export interface Contract {
  id: string;
  clientId: string;
  client?: Pick<Client, 'id' | 'name'>;
  title: string;
  description?: string;
  type: 'REGIE' | 'FORFAIT' | 'PORTAGE';
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'TERMINATED';
  startDate: string;
  endDate?: string;
  dailyRate?: number;
  monthlyRate?: number;
  fixedAmount?: number;
  workingDays?: number;
  signedAt?: string;
  documentUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  order?: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  client?: Pick<Client, 'id' | 'name' | 'email'>;
  number: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  issueDate: string;
  dueDate: string;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
  paymentTerms?: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  sentAt?: string;
  paidAt?: string;
  reminderSentAt?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method?: string;
  reference?: string;
}

export interface ExpenseItem {
  id?: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  vatAmount?: number;
  receiptUrl?: string;
  isReimbursable?: boolean;
  merchant?: string;
}

export type ExpenseCategory = 'TRANSPORT' | 'REPAS' | 'HEBERGEMENT' | 'MATERIEL' | 'LOGICIEL' | 'TELEPHONE' | 'FORMATION' | 'AUTRE';

export interface ExpenseReport {
  id: string;
  title: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  month: number;
  year: number;
  total: number;
  items?: ExpenseItem[];
  submittedAt?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface PaySlip {
  id: string;
  month: number;
  year: number;
  grossAmount: number;
  netAmount: number;
  socialCharges: number;
  urssafAmount: number;
  csgAmount: number;
  retirementAmount: number;
  status: 'DRAFT' | 'GENERATED' | 'SENT';
  documentUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface Leave {
  id: string;
  type: 'CP' | 'RTT' | 'MALADIE' | 'SANS_SOLDE' | 'AUTRE';
  startDate: string;
  endDate: string;
  days: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface Integration {
  id: string;
  type: 'WHATSAPP' | 'SLACK' | 'TEAMS' | 'TELEGRAM';
  config: Record<string, string>;
  enabled: boolean;
  webhookUrl?: string;
  lastUsedAt?: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: any;
  createdAt: string;
}

export interface DashboardKpis {
  yearRevenue: number;
  monthRevenue: number;
  clientCount: number;
  activeContracts: number;
  unpaidTotal: number;
  unpaidCount: number;
  yearExpenses: number;
}

export interface ChartData {
  month: string;
  revenue: number;
  count: number;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  success?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
