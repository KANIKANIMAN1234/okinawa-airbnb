/**
 * Vercel の環境変数から config.js を生成するスクリプト
 * ビルドコマンド: node build-config.js
 * Vercel の Build Command に "node build-config.js" を指定し、
 * LIFF_ID と GAS_API_URL を環境変数に設定すると、デプロイ時に config.js が生成されます。
 */
const fs = require('fs');
const path = require('path');
const LIFF_ID = process.env.LIFF_ID || '';
const GAS_API_URL = process.env.GAS_API_URL || '';
const out = `/**
 * ビルド時に環境変数から生成（build-config.js）
 */
var APP_CONFIG = {
  LIFF_ID: ${JSON.stringify(LIFF_ID)},
  GAS_API_URL: ${JSON.stringify(GAS_API_URL)}
};
`;
fs.writeFileSync(path.join(__dirname, 'config.js'), out, 'utf8');
console.log('config.js generated from env (LIFF_ID:', LIFF_ID ? 'set' : 'empty', ', GAS_API_URL:', GAS_API_URL ? 'set' : 'empty', ')');
