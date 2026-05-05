import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    console.log('✅  MongoDB connected');
  });

  mongoose.connection.on('error', (err: Error) => {
    console.error('❌  MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️   MongoDB disconnected');
  });

  await mongoose.connect(env.MONGO_URI);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
  console.log('🔌  MongoDB connection closed');
}
