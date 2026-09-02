import dotenv from 'dotenv';

dotenv.config();

export const config = {
  apifyApiKey: process.env.APIFY_API_KEY || '',
  googleApiKey: process.env.GOOGLE_API_KEY || '',
  googleCx: process.env.GOOGLE_CX || '',
  
  requestDelay: [1500, 3500],
  maxRetries: 3,
  timeout: 30000,
  
  outputPrefix: 'leads',
  
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
  }
};