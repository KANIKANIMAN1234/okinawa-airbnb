/**
 * 時間駆動トリガー用：日次で「今日送るべき通知」を判定してゲストに送信
 * トリガー設定: 毎日 午前6時 などで runDailyNotify を実行
 */
function runDailyNotify() {
  var today = new Date();
  var todayStr = formatDateKey(today);
  var sheet = getSheet(SHEET_NAMES.RESERVATIONS);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][7] !== '確定') continue;
    var checkInStr = data[i][2];
    var checkOutStr = data[i][3];
    var guestId = data[i][1];
    if (!checkInStr || !guestId) continue;
    var checkIn = parseDateStr(checkInStr);
    var checkOut = parseDateStr(checkOutStr);
    if (!checkIn) continue;
    var daysToCheckIn = Math.floor((checkIn.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    var daysToCheckOut = Math.floor((checkOut.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (daysToCheckIn === 7) {
      var msg = getTemplateBody('oneWeekBefore');
      if (msg) pushToUser(guestId, msg);
    }
    if (daysToCheckIn === 3) {
      var pdfUrl = getConfigValue('checkInGuidePdfUrl');
      if (pdfUrl) pushToUser(guestId, 'チェックインガイド: ' + pdfUrl);
    }
    if (isSameDay(checkIn, today)) {
      var videoUrl = getConfigValue('doorVideoYoutubeUrl');
      if (videoUrl) pushToUser(guestId, '玄関の開け方動画: ' + videoUrl);
    }
    if (daysToCheckOut === 1) {
      pushToUser(guestId, '明日はチェックアウトです。お忘れ物のないようご確認ください。清掃にご協力いただきありがとうございます。');
    }
  }
}

function formatDateKey(d) {
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

function parseDateStr(s) {
  if (!s) return null;
  var parts = String(s).split('-');
  if (parts.length < 3) return null;
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
