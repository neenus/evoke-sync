import path from 'path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '..', '..', '.env') });

import { app } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { seedAdminUser } from './config/seed';

async function bootstrap(): Promise<void> {
  await connectDB();
  await seedAdminUser();

  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`\n🚀  Evoke Sync API running on http://${env.HOST}:${env.PORT}`);
    console.log(`📋  Environment: ${env.NODE_ENV}`);
    console.log(`🔗  QBO environment: ${env.QBO_ENVIRONMENT}\n`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err: Error) => {
  console.error('❌  Failed to start server:', err.message);
  process.exit(1);
});

export default app;
