import crypto from 'node:crypto';

const roles = new Set(['Svetlana', 'Richard', 'Anastasia', 'Jean-Claude', 'Kevin']);
const encode = (value) => Buffer.from(value).toString('base64url');
const decode = (value) => Buffer.from(value, 'base64url').toString();

function configuredCodes() {
  try { return JSON.parse(process.env.DEMO_ACCESS_CODES_JSON || '{}'); } catch { return {}; }
}

export function authIsConfigured() {
  const codes = configuredCodes();
  return Boolean(process.env.SESSION_SIGNING_SECRET && roles.size === Object.keys(codes).filter((role) => roles.has(role) && codes[role]).length);
}

export function issueSession(role) {
  const payload = encode(JSON.stringify({ role, exp: Date.now() + 8 * 60 * 60 * 1000 }));
  const signature = crypto.createHmac('sha256', process.env.SESSION_SIGNING_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readSession(req) {
  const value = req.headers['x-demo-session'];
  if (!value || !process.env.SESSION_SIGNING_SECRET) return null;
  const [payload, signature] = String(value).split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', process.env.SESSION_SIGNING_SECRET).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(decode(payload));
    return roles.has(session.role) && Number(session.exp) > Date.now() ? session : null;
  } catch { return null; }
}

export function requireSession(req, res) {
  const session = readSession(req);
  if (session) return session;
  res.status(401).json({ error: 'Please sign in with your demonstration access code.' });
  return null;
}

export function validRole(role) { return roles.has(role); }

export function verifyAccessCode(role, code) {
  const expected = configuredCodes()[role];
  if (!expected || typeof code !== 'string' || code.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expected));
}
