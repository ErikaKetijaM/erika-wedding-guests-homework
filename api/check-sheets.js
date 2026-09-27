import { inspectSheets } from './sheets.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try { return res.status(200).json({ ok: true, ...(await inspectSheets()) }); }
  catch (error) { return res.status(502).json({ ok: false, error: error.message }); }
}
