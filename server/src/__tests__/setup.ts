process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://placeholder/test';
process.env.QBO_CLIENT_ID = 'test-client-id';
process.env.QBO_CLIENT_SECRET = 'test-client-secret';
process.env.QBO_REDIRECT_URI = 'http://localhost:5000/api/auth/qbo/callback';
process.env.APP_URL = 'http://localhost:3000';
process.env.AUTH_SERVICE_URL = 'http://auth-service:5100';
process.env.APP_NAME = 'evoke_sync';

import { afterAll, afterEach, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
