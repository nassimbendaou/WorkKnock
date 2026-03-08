import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import dayjs from 'dayjs';

// French public holidays calculation (simplified)
const getFrenchPublicHolidays = (year: number): string[] => {
  // Fixed holidays
  const fixed = [
    `${year}-01-01`, `${year}-05-01`, `${year}-05-08`,
    `${year}-07-14`, `${year}-08-15`, `${year}-11-01`,
    `${year}-11-11`, `${year}-12-25`,
  ];

  // Easter calculation (Gauss algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = dayjs(`${year}-${month}-${day}`);

  fixed.push(
    easter.add(1, 'day').format('YYYY-MM-DD'), // Lundi de Pâques
    easter.add(39, 'day').format('YYYY-MM-DD'), // Ascension
    easter.add(50, 'day').format('YYYY-MM-DD'), // Lundi de Pentecôte
  );

  return fixed;
};

const countWorkingDays = (startDate: Date, endDate: Date): number => {
  const holidays = [
    ...getFrenchPublicHolidays(startDate.getFullYear()),
    ...getFrenchPublicHolidays(endDate.getFullYear()),
  ];

  let count = 0;
  const current = dayjs(startDate);
  const end = dayjs(endDate);

  for (let d = current; d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
    const dayOfWeek = d.day();
    const dateStr = d.format('YYYY-MM-DD');
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(dateStr)) {
      count++;
    }
  }
  return count;
};

export const getLeaves = async (req: Request, res: Response) => {
  const { status, type, year, page = '1', limit = '50' } = req.query;
  const where: any = { userId: req.user!.id };
  if (status) where.status = status;
  if (type) where.type = type;
  if (year) {
    where.startDate = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31`),
    };
  }

  const [leaves, total] = await Promise.all([
    prisma.leave.findMany({
      where,
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
      orderBy: { startDate: 'desc' },
    }),
    prisma.leave.count({ where }),
  ]);
  res.json({ leaves, total });
};

export const getLeaveBalance = async (req: Request, res: Response) => {
  const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
  const settings = await prisma.userSettings.findUnique({ where: { userId: req.user!.id } });

  const approved = await prisma.leave.findMany({
    where: {
      userId: req.user!.id,
      status: 'APPROVED',
      startDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
    },
  });

  const used = {
    CP: approved.filter(l => l.type === 'CP').reduce((s, l) => s + l.days, 0),
    RTT: approved.filter(l => l.type === 'RTT').reduce((s, l) => s + l.days, 0),
    MALADIE: approved.filter(l => l.type === 'MALADIE').reduce((s, l) => s + l.days, 0),
    SANS_SOLDE: approved.filter(l => l.type === 'SANS_SOLDE').reduce((s, l) => s + l.days, 0),
    AUTRE: approved.filter(l => l.type === 'AUTRE').reduce((s, l) => s + l.days, 0),
  };

  const allocated = {
    CP: settings?.cpPerYear || 25,
    RTT: settings?.rttPerYear || 0,
  };

  res.json({
    year,
    allocated,
    used,
    remaining: {
      CP: Math.max(0, allocated.CP - used.CP),
      RTT: Math.max(0, allocated.RTT - used.RTT),
    },
    holidays: getFrenchPublicHolidays(year),
  });
};

export const createLeave = async (req: Request, res: Response) => {
  const { type, startDate, endDate, reason } = req.body;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = countWorkingDays(start, end);

  const leave = await prisma.leave.create({
    data: {
      userId: req.user!.id,
      type, reason, days,
      startDate: start,
      endDate: end,
      status: 'APPROVED', // Auto-approve for freelancers
      approvedAt: new Date(),
    },
  });
  res.status(201).json(leave);
};

export const updateLeave = async (req: Request, res: Response) => {
  const exists = await prisma.leave.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Congé non trouvé' });

  const { startDate, endDate, ...rest } = req.body;
  let days = exists.days;

  if (startDate && endDate) {
    days = countWorkingDays(new Date(startDate), new Date(endDate));
  }

  const leave = await prisma.leave.update({
    where: { id: req.params.id },
    data: {
      ...rest, days,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    },
  });
  res.json(leave);
};

export const deleteLeave = async (req: Request, res: Response) => {
  const exists = await prisma.leave.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Congé non trouvé' });
  await prisma.leave.delete({ where: { id: req.params.id } });
  res.status(204).send();
};
