import 'dotenv/config';

export const config = {
  tokenUrl: process.env.TOKEN_URL || 'http://localhost:3000/token',
  apiBase: process.env.API_BASE || 'http://localhost:3000',
  clientId: process.env.CLIENT_ID || 'mock-client-id',
  clientSecret: process.env.CLIENT_SECRET || 'mock-client-secret'
};
