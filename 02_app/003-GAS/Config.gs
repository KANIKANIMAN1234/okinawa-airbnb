/**
 * 設定取得（スクリプトプロパティ推奨）
 * GAS エディタ: プロジェクトの設定 → スクリプト プロパティ で以下を設定
 * - SPREADSHEET_ID: スプレッドシートのID
 * - CHANNEL_ACCESS_TOKEN: LINE Messaging API の Channel Access Token
 * - CHANNEL_SECRET: LINE Webhook 署名検証用
 */
function getSpreadsheetId() {
  return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '';
}

function getChannelAccessToken() {
  return PropertiesService.getScriptProperties().getProperty('CHANNEL_ACCESS_TOKEN') || '';
}

function getChannelSecret() {
  return PropertiesService.getScriptProperties().getProperty('CHANNEL_SECRET') || '';
}
