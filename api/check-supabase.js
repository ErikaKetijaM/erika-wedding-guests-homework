export default async function handler(_request, response) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return response.status(500).json({ ok: false, reason: 'missing configuration' });
  const result = await fetch(`${url}/rest/v1/employees?select=display_name&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  return response.status(result.ok ? 200 : 502).json({ ok: result.ok, status: result.status });
}
