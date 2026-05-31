import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'), // 0.0.0.0 = all interfaces; localhost also reachable for QBO OAuth callback
  PORT: z.string().default('5000').transform(Number),
  APP_URL: z.string().url().default('http://your-server-ip:3000'),

  // JWT
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRY: z.string().default('8h'),

  // Admin seed
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_NAME: z.string().optional(),

  // MongoDB
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  // QBO OAuth
  QBO_CLIENT_ID: z.string().min(1, 'QBO_CLIENT_ID is required'),
  QBO_CLIENT_SECRET: z.string().min(1, 'QBO_CLIENT_SECRET is required'),
  QBO_REDIRECT_URI: z.string().url('QBO_REDIRECT_URI must be a valid URL'),
  QBO_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  QBO_MINOR_VERSION: z.string().default('65'),

  // Settings defaults
  DEFAULT_SUPERVISOR: z.string().default('Your Supervising Clinician Name, Credentials'),

  // NR Auth integration
  AUTH_SERVICE_URL: z.string().url('AUTH_SERVICE_URL must be a valid URL'),
  APP_NAME: z.string().min(1, 'APP_NAME is required'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:');
  parsed.error.errors.forEach((err) => {
    console.error(`   ${err.path.join('.')}: ${err.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;
