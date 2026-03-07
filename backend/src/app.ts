import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import rateLimit from 'express-rate-limit';
import path from 'path';
import 'express-async-errors';

import { config } from './config';
import { prisma } from './utils/prisma';
import { errorHandler, notFound } from './middleware/error.middleware';
import routes from './routes';

const app = express();

// ── Security ──
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiting ──
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api', limiter);

// ── Middleware ──
app.use(compression());
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static uploads ──
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Passport - Google SSO ──
if (config.google.clientId) {
  passport.use(new GoogleStrategy(
    {
      clientID: config.google.clientId,
      clientSecret: config.google.clientSecret,
      callbackURL: config.google.callbackUrl,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('No email from Google'));

        let user = await prisma.user.findFirst({
          where: { OR: [{ email }, { ssoProvider: 'google', ssoProviderId: profile.id }] },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name: profile.displayName || email,
              ssoProvider: 'google',
              ssoProviderId: profile.id,
              avatar: profile.photos?.[0]?.value,
              settings: { create: { companyName: profile.displayName } },
            },
          });
        } else {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date(), avatar: profile.photos?.[0]?.value },
          });
        }

        done(null, user);
      } catch (err) {
        done(err as Error);
      }
    }
  ));
}

app.use(passport.initialize());

// ── Health check ──
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── API Routes ──
app.use('/api', routes);

// ── Error handling ──
app.use(notFound);
app.use(errorHandler);

export default app;
