/**
 * LINE Webhook 受信・署名検証・イベント処理
 * メッセージ → 問い合わせ保存・管理者通知
 * postback（リッチメニュー）→ ゴミ捨て方法等の自動返信
 */
function verifyLineSignature(body, signature) {
  var secret = getChannelSecret();
  if (!secret) return false;
  var mac = Utilities.computeHmacSha256Signature(body, secret);
  var expected = Utilities.base64Encode(mac);
  return signature === expected;
}

function handleLineWebhook(postData) {
  var json = JSON.parse(postData);
  var events = json.events;
  if (!events || !events.length) return;

  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    try {
      // グループIDをログ出力＆スプレッドシートに記録（OPENチャット・グループトーク用）
      if (event.source && event.source.type === 'group') {
        var groupId = event.source.groupId;
        Logger.log('=== グループIDを検出 ===');
        Logger.log('グループID: ' + groupId);
        Logger.log('イベントタイプ: ' + event.type);
        Logger.log('送信者userId: ' + (event.source.userId || 'なし'));
        Logger.log('========================');
        
        // スプレッドシートに記録
        try {
          var ss = SpreadsheetApp.openById(getSpreadsheetId());
          var sheet = ss.getSheetByName('group_ids');
          if (!sheet) {
            sheet = ss.insertSheet('group_ids');
            sheet.appendRow(['検出日時', 'グループID', 'イベントタイプ', 'メッセージ内容']);
          }
          var messageText = (event.message && event.message.text) ? event.message.text : '';
          sheet.appendRow([new Date(), groupId, event.type, messageText]);
        } catch (e) {
          Logger.log('スプレッドシート記録エラー: ' + e.message);
        }
      }
      
      if (event.type === 'message' && event.message && event.message.type === 'text') {
        handleMessageEvent(event);
      } else if (event.type === 'postback') {
        handlePostbackEvent(event);
      }
    } catch (e) {
      Logger.log('イベント処理エラー: ' + e.message);
    }
  }
}

/** リッチメニュー「テキスト」タイプで送られてくる識別子（マネージャー用） */
var RICH_MENU_TEXT_ACTIONS = ['facility_info', 'restaurant_guide', 'terms_of_use', 'menu_contact', 'access_info'];

function handleMessageEvent(event) {
  var userId = event.source.userId;
  var text = (event.message && event.message.text) ? String(event.message.text).trim() : '';

  if (RICH_MENU_TEXT_ACTIONS.indexOf(text) !== -1) {
    replyWithMenuAction(event.replyToken, text);
    return;
  }

  var displayName = '';
  try {
    var profileUrl = 'https://api.line.me/v2/bot/profile/' + userId;
    var res = UrlFetchApp.fetch(profileUrl, {
      headers: { Authorization: 'Bearer ' + getChannelAccessToken() },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      var profile = JSON.parse(res.getContentText());
      displayName = profile.displayName || '';
    }
  } catch (e) {}

  var adminId = getConfigValue('adminLineUserId');
  if (adminId && userId === adminId) {
    return;
  }

  var messageId = event.message.id;
  if (isMessageIdExists(messageId)) return;

  appendInquiry(userId, displayName, text, messageId);
  ensureGuest(userId, displayName);

  if (adminId) {
    var msg = 'ゲストからの問い合わせ\n' + (displayName ? '[' + displayName + ']\n' : '') + text;
    pushToUser(adminId, msg);
  }

  var replyTemplate = getTemplateBody('replyMessage');
  if (replyTemplate && event.replyToken) {
    replyToReplyToken(event.replyToken, replyTemplate);
  }
}

function replyWithMenuAction(replyToken, data) {
  if (!replyToken) return;
  var body = '';
  var defaultMsg = '';
  switch (data) {
    case 'facility_info':
      body = getTemplateBody('facilityInfo');
      defaultMsg = '施設情報のご案内です。';
      break;
    case 'restaurant_guide':
      body = getTemplateBody('restaurantGuide');
      defaultMsg = '周辺・レストランのご案内です。';
      break;
    case 'terms_of_use':
      body = getTemplateBody('termsOfUse');
      defaultMsg = '利用規約のご案内です。';
      break;
    case 'menu_contact':
      body = getTemplateBody('contactPrompt');
      defaultMsg = 'ご不明点は、このチャットにメッセージでお送りください。担当者よりご返信いたします。';
      break;
    case 'access_info':
      body = getTemplateBody('accessInfo');
      defaultMsg = 'アクセスのご案内です。';
      break;
    default:
      return;
  }
  replyToReplyToken(replyToken, body && body.length > 0 ? body : defaultMsg);
}

function handlePostbackEvent(event) {
  var data = event.postback ? event.postback.data : '';
  var replyToken = event.replyToken;
  if (!replyToken) return;

  if (data === 'garbage_disposal') {
    var body = getTemplateBody('garbage_disposal');
    replyToReplyToken(replyToken, body && body.length > 0 ? body : 'ゴミの出し方のご案内です。');
    return;
  }
  replyWithMenuAction(replyToken, data);
}
