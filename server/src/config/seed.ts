import bcrypt from 'bcryptjs';
import { User } from '../models/User.model';
import { env } from './env';

export async function seedAdminUser(): Promise<void> {
  const count = await User.countDocuments();
  if (count > 0) return;

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.ADMIN_NAME) {
    console.warn('⚠️   ADMIN_EMAIL/PASSWORD/NAME not set — skipping admin seed');
    return;
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await User.create({
    email: env.ADMIN_EMAIL,
    passwordHash,
    name: env.ADMIN_NAME,
    role: 'admin',
  });

  console.log(`✅  Admin user created: ${env.ADMIN_EMAIL}`);
}
