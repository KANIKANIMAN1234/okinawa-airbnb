/**
 * LINE Messaging API - Push Message
 * @return {boolean} 送信に成功した場合 true、失敗時は false（トークン未設定・友だち未追加・API エラー等）
 */
function pushToUser(userId, text) {
  var token = getChannelAccessToken();
  if (!token) {
    Logger.log('LINE Push: CHANNEL_ACCESS_TOKEN が設定されていません');
    return false;
  }
  if (!userId || !text) return false;
  var url = 'https://api.line.me/v2/bot/message/push';
  var payload = {
    to: userId,
    messages: [{ type: 'text', text: text }]
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('LINE Push 失敗: status=' + code + ', body=' + res.getContentText());
      return false;
    }
    return true;
  } catch (e) {
    Logger.log('LINE Push 例外: ' + (e.message || e));
    return false;
  }
}

function pushToGroup(groupId, text) {
  var token = getChannelAccessToken();
  if (!token || !groupId) return;
  var url = 'https://api.line.me/v2/bot/message/push';
  var payload = {
    to: groupId,
    messages: [{ type: 'text', text: text }]
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  UrlFetchApp.fetch(url, options);
}

function replyToReplyToken(replyToken, text) {
  var token = getChannelAccessToken();
  if (!token) return;
  var url = 'https://api.line.me/v2/bot/message/reply';
  var payload = {
    replyToken: replyToken,
    messages: [{ type: 'text', text: text }]
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  UrlFetchApp.fetch(url, options);
}
