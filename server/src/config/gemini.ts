import { GoogleGenAI } from '@google/genai';
import { env } from './env.js';

let aiClient: GoogleGenAI | null = null;

if (env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'ifysora-ai-service',
      },
    },
  });
  console.log('[Gemini] AI client initialized successfully.');
} else {
  console.warn('[Gemini] GEMINI_API_KEY not found. AI features will be disabled.');
}

export { aiClient };
