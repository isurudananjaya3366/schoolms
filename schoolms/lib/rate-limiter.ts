interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  ip: string,
  maxAttempts = 5,
  windowMs = 3600000
): {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
} {
  const now = Date.now();
  const entry = store.get(ip);

  // No existing entry or window expired → reset
  if (!entry || now > entry.windowStart + windowMs) {
    store.set(ip, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt: new Date(now + windowMs),
    };
  }

  // Window still active and limit exceeded
  if (entry.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.windowStart + windowMs),
    };
  }

  // Window still active, increment
  entry.count += 1;
  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    resetAt: new Date(entry.windowStart + windowMs),
  };
}
