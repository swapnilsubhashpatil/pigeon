import axios from 'axios';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '@/config';
import { safeFetch, clamp } from './fetcher';
import { MOCK_GEOPOLITICAL_SCORES } from './mock-scores';

const REGION_KEYWORDS: Record<string, string> = {
  CNSHA: 'China port strike OR customs OR embargo OR trade ban',
  DEHAM: 'Hamburg port strike OR closure OR congestion',
  NLRTM: 'Rotterdam port strike OR closure OR congestion',
  USLAX: 'Los Angeles port strike OR closure OR congestion',
  GBFXT: 'Felixstowe UK port strike OR closure',
  JPYOK: 'Japan port strike OR earthquake OR closure',
  SGSIN: 'Singapore port closure OR customs OR congestion',
  INNSA: 'India port strike OR customs OR closure',
  KRPUS: 'South Korea port strike OR closure',
  USNYC: 'New York port strike OR closure OR congestion',
  AUMEL: 'Melbourne Australia port strike OR closure',
};

const RISK_LEVEL_TO_SCORE: Record<number, number> = { 0: 5, 1: 15, 2: 35, 3: 60 };

// NewsData.io response schema (keys start with pub_)
const NewsApiResponseSchema = z.object({
  status: z.string(),
  results: z.array(
    z.object({
      title: z.string(),
      description: z.string().nullable().optional(),
    })
  ).optional().default([]),
});

const GeminiOutputSchema = z.object({
  risk_level: z.number().min(0).max(3),
  reason: z.string(),
});

// 30-minute cache per port
const cache = new Map<string, { score: number; expiresAt: number }>();

async function classifyWithGemini(headlines: string[]): Promise<number> {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY not set');

  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are a supply chain risk analyst. Given these news headlines, classify the disruption risk to port operations on a scale of 0–3:
0 = no disruption risk
1 = low risk (minor incidents, normal operations)
2 = medium risk (significant delays possible)
3 = high risk (major disruption likely)

Headlines:
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Respond with ONLY valid JSON: {"risk_level": <0-3>, "reason": "<one sentence>"}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch?.[0]) throw new Error('Gemini did not return JSON');

  const parsed = GeminiOutputSchema.parse(JSON.parse(jsonMatch[0]));
  return parsed.risk_level;
}

async function fetchFromNewsApiAndGemini(portCode: string): Promise<number> {
  if (!config.newsApiKey) throw new Error('NEWS_API_KEY not set');

  const query = REGION_KEYWORDS[portCode];
  if (!query) throw new Error(`No keyword mapping for port: ${portCode}`);

  const response = await axios.get('https://newsdata.io/api/1/news', {
    params: { q: query, language: 'en', size: 5, apikey: config.newsApiKey },
    timeout: 8000,
  });

  const parsed = NewsApiResponseSchema.parse(response.data);
  const headlines = (parsed.results ?? [])
    .slice(0, 3)
    .map((a) => a.title + (a.description ? ` — ${a.description}` : ''));

  if (headlines.length === 0) return 5; // no news = no risk

  const riskLevel = await classifyWithGemini(headlines);
  return clamp(RISK_LEVEL_TO_SCORE[riskLevel] ?? 5);
}

export async function fetchGeopoliticalScore(portCode: string): Promise<number> {
  const cached = cache.get(portCode);
  if (cached && cached.expiresAt > Date.now()) return cached.score;

  const result = await safeFetch(
    'geopolitical',
    () => fetchFromNewsApiAndGemini(portCode),
    () => MOCK_GEOPOLITICAL_SCORES[portCode] ?? MOCK_GEOPOLITICAL_SCORES['default'] ?? 15
  );

  cache.set(portCode, { score: result.score, expiresAt: Date.now() + 30 * 60 * 1000 });
  return result.score;
}
