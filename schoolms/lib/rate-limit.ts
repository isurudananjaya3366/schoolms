import { NextResponse } from "next/server";
import { getSecureSetting } from "@/lib/secure-settings";

interface RateLimitResult {
  limited: boolean;
  retryAfter?: number;
}

// In-memory store for development
const memoryStore = new Map<string, { count: number; expiresAt: number }>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const upstashUrl = await getSecureSetting("UPSTASH_REDIS_REST_URL");
  const upstashToken = await getSecureSetting("UPSTASH_REDIS_REST_TOKEN");

  if (upstashUrl && upstashToken) {
    // Use Upstash Redis (optional dependency)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Redis } = (await import(/* webpackIgnore: true */ "@upstash/redis" as string)) as {
        Redis: new (opts: { url: string; token: string }) => {
          pipeline: () => {
            incr: (key: string) => void;
            expire: (key: string, seconds: number) => void;
            exec: () => Promise<unknown[]>;
          };
          ttl: (key: string) => Promise<number>;
        };
      };
      const redis = new Redis({ url: upstashUrl, token: upstashToken });
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, windowSeconds);
      const results = await pipeline.exec();
      const count = results[0] as number;
      if (count > limit) {
        const ttl = await redis.ttl(key);
        return { limited: true, retryAfter: Math.max(ttl, 1) };
      }
      return { limited: false };
    } catch (err) {
      console.error("Redis rate limit error:", err);
      return { limited: false }; // Fail open
    }
  }

  // In-memory fallback
  const now = Date.now();
  // Evict expired entries
  for (const [k, v] of memoryStore) {
    if (v.expiresAt < now) memoryStore.delete(k);
  }

  const existing = memoryStore.get(key);
  if (!existing) {
    memoryStore.set(key, {
      count: 1,
      expiresAt: now + windowSeconds * 1000,
    });
    return { limited: false };
  }

  existing.count++;
  if (existing.count > limit) {
    const retryAfter = Math.ceil((existing.expiresAt - now) / 1000);
    return { limited: true, retryAfter: Math.max(retryAfter, 1) };
  }
  return { limited: false };
}

export async function withRateLimit(
  request: Request,
  keyPrefix: string,
  limit: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const key = `rate-limit:${keyPrefix}:${ip}`;
  const result = await checkRateLimit(key, limit, windowSeconds);

  if (result.limited) {
    return NextResponse.json(
      {
        message: `Rate limit exceeded. Maximum ${limit} requests per ${windowSeconds} seconds. Try again later.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfter || windowSeconds),
        },
      }
    );
  }

  return null; // Not limited - proceed
}
