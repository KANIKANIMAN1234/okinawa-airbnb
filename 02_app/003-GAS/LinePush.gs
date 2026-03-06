/**
 * LINE Messaging API - Push Message
 * @return {boolean} 送信に成功した場合 true、失敗時は false（トークン未設定・友だち未追加・API エラー等）
 */
function pushToUser(userId, text) {
  var token = getChannelAccessToken();
  if (!token) return false;
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
    if (code < 200 || code >= 300) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function pushToGroup(groupId, text) {
  var token = getChannelAccessToken();
  Logger.log('[pushToGroup] 開始 - groupId: ' + groupId + ', text: ' + text);
  
  if (!token) {
    Logger.log('[pushToGroup] エラー: Channel Access Token が設定されていません');
    return false;
  }
  if (!groupId) {
    Logger.log('[pushToGroup] エラー: groupId が指定されていません');
    return false;
  }
  
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
  
  try {
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    var responseText = res.getContentText();
    
    Logger.log('[pushToGroup] レスポンスコード: ' + code);
    Logger.log('[pushToGroup] レスポンス内容: ' + responseText);
    
    if (code < 200 || code >= 300) {
      Logger.log('[pushToGroup] エラー: LINE API がエラーを返しました');
      return false;
    }
    
    Logger.log('[pushToGroup] 成功: グループへの通知送信完了');
    return true;
  } catch (e) {
    Logger.log('[pushToGroup] 例外エラー: ' + e.message);
    return false;
  }
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
