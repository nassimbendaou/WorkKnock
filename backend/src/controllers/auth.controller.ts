import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { signToken } from '../utils/jwt';
import { WhatsAppIntegration } from '../integrations/whatsapp.integration';

const userSelect = {
  id: true, email: true, name: true, role: true, avatar: true, isActive: true,
  settings: true, createdAt: true,
};

export const register = async (req: Request, res: Response) => {
  const { email, password, name, companyName, phone } = req.body;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ message: 'Email déjà utilisé' });

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email, name, password: hashed,
      settings: {
        create: {
          companyName: companyName || name,
          invoicePrefix: 'FAC',
          invoiceNextNumber: 1,
        },
      },
    },
    select: userSelect,
  });

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  // Send WhatsApp welcome message if phone provided
  if (phone) {
    const welcomeMsg = `🎉 *Bienvenue sur WorkKnock, ${name} !*

Votre compte a été créé avec succès ! 🚀

Je suis votre assistant IA. Vous pouvez me parler en langage naturel pour :

📄 *Facturation:* "Crée une facture pour [client] de 500€ pour du développement web"
👤 *Clients:* "Ajoute un client Dupont avec l'email dupont@mail.com"
💰 *Comptabilité:* "Quel est mon chiffre d'affaires ce mois-ci ?"
💸 *Impayés:* "Quelles factures sont en retard ?"
🏖️ *Congés:* "Combien de jours de CP il me reste ?"

Pour commencer, configurez WhatsApp dans les *Intégrations* de votre tableau de bord.

Bonne gestion ! 💼`;

    WhatsAppIntegration.sendMessage(phone, welcomeMsg).catch(err => {
      console.error('[WhatsApp] Welcome message failed:', err.message);
    });
  }

  res.status(201).json({ token, user });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email }, select: { ...userSelect, password: true } });
  if (!user || !user.password) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Email ou mot de passe incorrect' });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { password: _, ...userWithoutPassword } = user;
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.json({ token, user: userWithoutPassword });
};

export const me = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: userSelect,
  });
  res.json(user);
};

export const updateProfile = async (req: Request, res: Response) => {
  const { name, avatar } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { name, avatar },
    select: userSelect,
  });
  res.json(user);
};

export const updatePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { password: true },
  });

  if (!user?.password) return res.status(400).json({ message: 'Aucun mot de passe défini' });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return res.status(400).json({ message: 'Mot de passe actuel incorrect' });

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: req.user!.id }, data: { password: hashed } });
  res.json({ message: 'Mot de passe mis à jour' });
};

export const updateSettings = async (req: Request, res: Response) => {
  const settings = await prisma.userSettings.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, ...req.body },
    update: req.body,
  });
  res.json(settings);
};

export const googleCallback = async (req: Request, res: Response) => {
  const user = req.user as any;
  if (!user) return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
};

export const microsoftCallback = async (req: Request, res: Response) => {
  const user = req.user as any;
  if (!user) return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
};
