import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';

describe('test infrastructure', () => {
  it('connects to in-memory mongo', () => {
    expect(mongoose.connection.readyState).toBe(1);
  });
});
