/**
 * メインエントリ
 * - LINE Webhook 用 URL（URL-A）: LINE Developers の Webhook URL に設定。body に "events" が含まれる場合は Webhook として処理。
 * - Vercel 用 API（URL-B）: 環境変数 GAS_API_URL に設定。body に "action" が含まれる場合は API として処理。
 * 判別: POST body を JSON パースし、events 配列があれば LINE Webhook、action があれば Vercel API。
 * 注意: GAS の doPost では HTTP ヘッダを取得できないため、署名検証は Webhook 用に別プロキシを使うか省略する。
 */
function doGet(e) {
  var output = ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'GAS API' }));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function doPost(e) {
  var postData = e.postData && e.postData.contents;
  if (!postData) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No body' })).setMimeType(ContentService.MimeType.JSON);
  }
  var body;
  try {
    body = JSON.parse(postData);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid JSON' })).setMimeType(ContentService.MimeType.JSON);
  }
  if (body.events && Array.isArray(body.events)) {
    var sig = e.parameter && e.parameter['X-Line-Signature'];
    if (sig && !verifyLineSignature(postData, sig)) {
      return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
    }
    try {
      handleLineWebhook(postData);
    } catch (err) {}
    return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
  }
  var result;
  try {
    var action = body.action;
    var data = body.data || {};
    result = handleApiAction(action, data);
  } catch (err) {
    result = { status: 'error', message: err.message || String(err) };
  }
  var output = ContentService.createTextOutput(JSON.stringify(result));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
