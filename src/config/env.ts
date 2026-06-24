import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GATEWAY_PORT: z.coerce.number().int().min(0).max(65_535).default(4000),

  JWT_SECRET: z.string().min(32),
  INTERNAL_API_TOKEN: z.string().min(32),

  AUTH_SERVICE_URL: z.string().url().default('http://localhost:4003'),
  USER_SERVICE_URL: z.string().url().default('http://localhost:4001'),
  CHAT_SERVICE_URL: z.string().url().default('http://localhost:4002'),
  MULTIMEDIA_SERVICE_URL: z.string().url().default('http://localhost:4004'),
  NOTIFICATION_SERVICE_URL: z.string().url().default('http://localhost:4010'),
  REALTIME_SERVICE_URL: z.string().url().default('http://localhost:3001'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    '[gateway-service] Environment variable validation failed:',
    JSON.stringify(parsed.error.format(), null, 2),
  );
  process.exit(1);
}

export const env = parsed.data;
