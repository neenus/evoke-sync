import { Schema, model, Document, Model } from 'mongoose';
import { OAuthTokenData, Company } from '../types';

export interface IQBOTokenBase {
  company: Company;
  companyId: string;
  companyName: string;
  tokenData: OAuthTokenData;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
  environment: 'sandbox' | 'production';
}

export interface IQBOTokenDocument extends IQBOTokenBase, Document {
  createdAt: Date;
  updatedAt: Date;
  isAccessTokenExpired(): boolean;
  isRefreshTokenExpired(): boolean;
  updateTokens(tokenData: OAuthTokenData): Promise<IQBOTokenDocument>;
}

interface IQBOTokenModel extends Model<IQBOTokenDocument> {
  findByCompany(company: Company): Promise<IQBOTokenDocument | null>;
}

const tokenDataSchema = new Schema<OAuthTokenData>(
  {
    token_type: { type: String, required: true },
    access_token: { type: String, required: true },
    refresh_token: { type: String, required: true },
    expires_in: { type: Number, required: true },
    x_refresh_token_expires_in: { type: Number, required: true },
    createdAt: { type: Number },
  },
  { _id: false },
);

const qboTokenSchema = new Schema<IQBOTokenDocument, IQBOTokenModel>(
  {
    company: {
      type: String,
      enum: ['york_region', 'consulting'],
      required: true,
      unique: true,
    },
    companyId: { type: String, required: true },
    companyName: { type: String, required: true, trim: true },
    tokenData: { type: tokenDataSchema, required: true },
    accessTokenExpiry: { type: Date, required: true },
    refreshTokenExpiry: { type: Date, required: true },
    environment: {
      type: String,
      enum: ['sandbox', 'production'],
      required: true,
    },
  },
  { timestamps: true, collection: 'qbotokens' },
);

qboTokenSchema.methods.isAccessTokenExpired = function (): boolean {
  return new Date() >= this.accessTokenExpiry;
};

qboTokenSchema.methods.isRefreshTokenExpired = function (): boolean {
  return new Date() >= this.refreshTokenExpiry;
};

qboTokenSchema.methods.updateTokens = async function (
  tokenData: OAuthTokenData,
): Promise<IQBOTokenDocument> {
  this.tokenData = { ...tokenData, createdAt: Date.now() };
  this.accessTokenExpiry = new Date(Date.now() + (tokenData.expires_in - 60) * 1000);
  this.refreshTokenExpiry = new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000);
  return this.save();
};

qboTokenSchema.statics.findByCompany = function (
  company: Company,
): Promise<IQBOTokenDocument | null> {
  return this.findOne({ company });
};

export const QBOToken = model<IQBOTokenDocument, IQBOTokenModel>('QBOToken', qboTokenSchema);
