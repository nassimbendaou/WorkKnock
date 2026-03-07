import { prisma } from '../utils/prisma';

export class NotificationService {
  static async create(userId: string, type: string, title: string, message: string, data?: any) {
    return prisma.notification.create({
      data: { userId, type, title, message, data },
    });
  }
}
