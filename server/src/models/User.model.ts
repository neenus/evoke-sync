import { Schema, model, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUserBase {
  email: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'employee';
  lastLogin?: Date;
}

export interface IUserDocument extends IUserBase, Document {
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

interface IUserModel extends Model<IUserDocument> {
  findByEmail(email: string): Promise<IUserDocument | null>;
}

const userSchema = new Schema<IUserDocument, IUserModel>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'employee'], default: 'admin' },
    lastLogin: { type: Date },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.findByEmail = function (email: string): Promise<IUserDocument | null> {
  return this.findOne({ email: email.toLowerCase().trim() });
};

export const User = model<IUserDocument, IUserModel>('User', userSchema);
