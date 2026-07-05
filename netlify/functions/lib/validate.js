const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@][^\s@]{0,253}$/;

export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
export const isEmail = (v) => typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v);
export const isStr = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export const isEnum = (v, allowed) => allowed.includes(v);
export const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

export const err422 = (msg) => ({
  statusCode: 422,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: msg }),
});
