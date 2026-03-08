import app from './app';
import { config } from './config';
import { prisma } from './utils/prisma';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const startServer = async (retries = 10, delay = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`⏳ Connecting to database... (attempt ${attempt}/${retries})`);
      await prisma.$connect();
      console.log('✅ Database connected');

      app.listen(config.port, () => {
        console.log(`🚀 WorkKnock API running on port ${config.port}`);
        console.log(`📍 Environment: ${config.nodeEnv}`);
        console.log(`🌐 Frontend URL: ${config.frontendUrl}`);
      });
      return;
    } catch (error: any) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message || error);
      if (attempt < retries) {
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      } else {
        console.error('❌ All retries exhausted. Exiting.');
        process.exit(1);
      }
    }
  }
};

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
