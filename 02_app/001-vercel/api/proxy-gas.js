/**
 * GAS 用 CORS プロキシ
 * ブラウザはこの API を呼び（同一オリジンなので CORS なし）、
 * サーバー側で GAS に転送して結果を返す。
 */
const GAS_URL = process.env.GAS_API_URL || '';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  if (!GAS_URL) {
    return res.status(500).json({ status: 'error', message: 'GAS_API_URL is not configured' });
  }

  try {
    const body = typeof req.body === 'object' ? req.body : {};
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(response.status).send(text || '{}');
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Proxy error' });
  }
}
