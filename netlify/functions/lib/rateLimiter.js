// In-memory rate limiter — state is shared within a warm function instance
// and resets on cold starts. Sufficient for a small-team app; replace with
// a Redis/Supabase-backed store if cold-start resets become a problem.

const store = new Map();

// Purge expired entries periodically so the Map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}, 60_000);

/**
 * @param {string} ip
 * @param {{ max: number, windowMs: number }} opts
 * @returns {{ limited: boolean, remaining: number, retryAfter?: number }}
 */
export function rateLimit(ip, { max, windowMs }) {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now >= entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: max - 1 };
  }

  if (entry.count >= max) {
    return {
      limited: true,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { limited: false, remaining: max - entry.count };
}

/** Extract the real client IP from Netlify's forwarded headers. */
export function clientIp(headers) {
  return (
    headers['x-forwarded-for']?.split(',')[0].trim() ||
    headers['client-ip'] ||
    'unknown'
  );
}

/** Standard 429 response. */
export function tooManyRequests(retryAfter) {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
    },
    body: JSON.stringify({
      error: 'Too many requests. Please wait before trying again.',
      retryAfter,
    }),
  };
}
