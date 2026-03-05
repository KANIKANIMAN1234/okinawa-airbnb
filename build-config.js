/**
 * Vercel の環境変数から config.js を生成するスクリプト
 * フロントは CORS を避けるため /api/proxy-gas を呼ぶ。プロキシが GAS_API_URL に転送する。
 */
const fs = require('fs');
const path = require('path');
const LIFF_ID = process.env.LIFF_ID || '';
const GAS_API_URL_FRONT = '/api/proxy-gas';
const out = `/**
 * ビルド時に環境変数から生成（build-config.js）
 */
var APP_CONFIG = {
  LIFF_ID: ${JSON.stringify(LIFF_ID)},
  GAS_API_URL: ${JSON.stringify(GAS_API_URL_FRONT)}
};
`;
fs.writeFileSync(path.join(__dirname, 'config.js'), out, 'utf8');
console.log('config.js generated (LIFF_ID:', LIFF_ID ? 'set' : 'empty', ', GAS_API_URL: proxy)');
