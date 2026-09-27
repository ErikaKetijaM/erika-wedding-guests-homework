import { authIsConfigured, issueSession, validRole, verifyAccessCode } from '../lib/auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!authIsConfigured()) return res.status(503).json({ error: 'Demonstration access has not been configured by the manager.' });
  const { role, code } = req.body || {};
  if (!validRole(role) || !verifyAccessCode(role, code)) return res.status(401).json({ error: 'That access code is not valid.' });
  return res.status(200).json({ ok: true, role, session: issueSession(role), expiresInHours: 8 });
}
