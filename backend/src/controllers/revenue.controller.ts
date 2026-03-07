import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const getDashboard = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const startOfYear = new Date(`${currentYear}-01-01`);
  const startOfMonth = new Date(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`);

  const [
    totalRevenue,
    monthRevenue,
    invoiceStats,
    clientCount,
    activeContracts,
    unpaidInvoices,
    recentInvoices,
    monthlyRevenue,
    expenseStats,
  ] = await Promise.all([
    // Total CA this year
    prisma.invoice.aggregate({
      where: { userId, status: 'PAID', issueDate: { gte: startOfYear } },
      _sum: { total: true },
    }),
    // CA this month
    prisma.invoice.aggregate({
      where: { userId, status: 'PAID', issueDate: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    // Invoice stats
    prisma.invoice.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
      _sum: { total: true },
    }),
    // Client count
    prisma.client.count({ where: { userId, status: 'ACTIVE' } }),
    // Active contracts
    prisma.contract.count({ where: { userId, status: 'ACTIVE' } }),
    // Unpaid total
    prisma.invoice.aggregate({
      where: { userId, status: { in: ['SENT', 'OVERDUE'] } },
      _sum: { total: true },
      _count: true,
    }),
    // Recent invoices
    prisma.invoice.findMany({
      where: { userId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { name: true } } },
    }),
    // Monthly revenue (last 12 months)
    prisma.$queryRaw<any[]>`
      SELECT
        YEAR(issueDate) as year,
        MONTH(issueDate) as month,
        SUM(total) as revenue,
        COUNT(*) as count
      FROM invoices
      WHERE userId = ${userId}
        AND status = 'PAID'
        AND issueDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY YEAR(issueDate), MONTH(issueDate)
      ORDER BY year, month
    `,
    // Expenses this year
    prisma.expenseReport.aggregate({
      where: { userId, year: currentYear },
      _sum: { total: true },
    }),
  ]);

  // Build complete 12-month chart data
  const chartData = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const found = monthlyRevenue.find((r: any) => Number(r.year) === y && Number(r.month) === m);
    chartData.push({
      month: `${String(m).padStart(2, '0')}/${y}`,
      revenue: found ? Number(found.revenue) : 0,
      count: found ? Number(found.count) : 0,
    });
  }

  res.json({
    kpis: {
      yearRevenue: totalRevenue._sum.total || 0,
      monthRevenue: monthRevenue._sum.total || 0,
      clientCount,
      activeContracts,
      unpaidTotal: unpaidInvoices._sum.total || 0,
      unpaidCount: unpaidInvoices._count,
      yearExpenses: expenseStats._sum.total || 0,
    },
    invoiceStats,
    recentInvoices,
    chartData,
  });
};

export const getRevenueStats = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { year = new Date().getFullYear() } = req.query;

  const [byClient, byMonth, totalPaid, totalSent, totalOverdue] = await Promise.all([
    // Revenue by client
    prisma.invoice.groupBy({
      by: ['clientId'],
      where: { userId, status: 'PAID', issueDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
      _sum: { total: true },
      _count: true,
    }),
    // Revenue by month
    prisma.$queryRaw<any[]>`
      SELECT MONTH(issueDate) as month, SUM(total) as revenue, COUNT(*) as count
      FROM invoices
      WHERE userId = ${userId} AND status = 'PAID'
        AND YEAR(issueDate) = ${year}
      GROUP BY MONTH(issueDate)
      ORDER BY month
    `,
    prisma.invoice.aggregate({ where: { userId, status: 'PAID', issueDate: { gte: new Date(`${year}-01-01`) } }, _sum: { total: true }, _count: true }),
    prisma.invoice.aggregate({ where: { userId, status: 'SENT' }, _sum: { total: true }, _count: true }),
    prisma.invoice.aggregate({ where: { userId, status: 'OVERDUE' }, _sum: { total: true }, _count: true }),
  ]);

  // Enrich clientId with names
  const clientIds = byClient.map((c: any) => c.clientId);
  const clients = await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } });
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

  const byClientEnriched = byClient.map((c: any) => ({
    clientName: clientMap[c.clientId] || 'Inconnu',
    revenue: c._sum.total || 0,
    count: c._count,
  })).sort((a, b) => b.revenue - a.revenue);

  const monthData = Array.from({ length: 12 }, (_, i) => {
    const found = byMonth.find((m: any) => Number(m.month) === i + 1);
    return {
      month: i + 1,
      revenue: found ? Number(found.revenue) : 0,
      count: found ? Number(found.count) : 0,
    };
  });

  res.json({
    year,
    byClient: byClientEnriched,
    byMonth: monthData,
    summary: {
      paid: { total: totalPaid._sum.total || 0, count: totalPaid._count },
      sent: { total: totalSent._sum.total || 0, count: totalSent._count },
      overdue: { total: totalOverdue._sum.total || 0, count: totalOverdue._count },
    },
  });
};
