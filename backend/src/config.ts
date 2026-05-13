import dotenv from 'dotenv';
dotenv.config();

function env(key: string): string {
  return process.env[key] ?? '';
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    console.warn(`[config] WARNING: ${key} is not set — related features will fail`);
    return '';
  }
  return val;
}

export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  tomorrowIoApiKey: requireEnv('TOMORROW_IO_API_KEY'),
  aisStreamApiKey: requireEnv('AIS_STREAM_API_KEY'),
  googleMapsApiKey: requireEnv('GOOGLE_MAPS_API_KEY'),
  newsApiKey: requireEnv('NEWS_API_KEY'),
  slackWebhookUrl: env('SLACK_WEBHOOK_URL'),
} as const;
