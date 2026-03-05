/**
 * スプレッドシートアクセス
 * シート名: inquiries, reservations, guests, templates, config
 */
var SHEET_NAMES = {
  INQUIRIES: 'inquiries',
  RESERVATIONS: 'reservations',
  GUESTS: 'guests',
  TEMPLATES: 'templates',
  CONFIG: 'config'
};

function getSpreadsheet() {
  var id = getSpreadsheetId();
  if (!id) throw new Error('SPREADSHEET_ID が設定されていません');
  return SpreadsheetApp.openById(id);
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

function getConfigValue(key) {
  var sheet = getSheet(SHEET_NAMES.CONFIG);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1] != null ? String(data[i][1]) : null;
  }
  return null;
}

function setConfigValue(key, value) {
  var sheet = getSheet(SHEET_NAMES.CONFIG);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function getTemplateBody(templateKey) {
  var sheet = getSheet(SHEET_NAMES.TEMPLATES);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === templateKey) return data[i][1] != null ? String(data[i][1]) : null;
  }
  return null;
}

function saveTemplate(templateKey, body) {
  var sheet = getSheet(SHEET_NAMES.TEMPLATES);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === templateKey) {
      sheet.getRange(i + 1, 2).setValue(body);
      sheet.getRange(i + 1, 3).setValue(new Date());
      return;
    }
  }
  sheet.appendRow([templateKey, body, new Date()]);
}

function appendInquiry(lineUserId, displayName, messageText, messageId) {
  var sheet = getSheet(SHEET_NAMES.INQUIRIES);
  if (!sheet) return;
  sheet.appendRow([
    new Date(),
    lineUserId,
    displayName || '',
    messageText,
    messageId || '',
    '1' // 管理者通知済
  ]);
}

function ensureGuest(lineUserId, displayName) {
  var sheet = getSheet(SHEET_NAMES.GUESTS);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === lineUserId) {
      if (displayName && data[i][1] !== displayName)
        sheet.getRange(i + 1, 2).setValue(displayName);
      return;
    }
  }
  sheet.appendRow([lineUserId, displayName || '', new Date()]);
}

function isMessageIdExists(messageId) {
  if (!messageId) return false;
  var sheet = getSheet(SHEET_NAMES.INQUIRIES);
  if (!sheet) return false;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][4] === messageId) return true;
  }
  return false;
}

function createReservation(guestLineUserId, checkIn, checkOut, numberOfGuests, amount, cleaningFee, totalAmount) {
  var sheet = getSheet(SHEET_NAMES.RESERVATIONS);
  if (!sheet) return null;
  var reservationId = 'R' + new Date().getTime();
  var now = new Date();
  sheet.appendRow([
    reservationId,
    guestLineUserId,
    checkIn,
    checkOut,
    numberOfGuests,
    amount,
    cleaningFee,
    '確定',
    now,
    now,
    ''
  ]);
  return reservationId;
}

function getReservationsForMonth(year, month) {
  var sheet = getSheet(SHEET_NAMES.RESERVATIONS);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][7] !== '確定') continue; // status
    var checkInStr = data[i][2];
    if (!checkInStr) continue;
    var parts = String(checkInStr).split('-');
    if (parts.length < 2) continue;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (y === year && m === month)
      result.push({
        reservationId: data[i][0],
        guestLineUserId: data[i][1],
        checkIn: data[i][2],
        checkOut: data[i][3],
        numberOfGuests: data[i][4],
        amount: Number(data[i][5]) || 0,
        cleaningFee: Number(data[i][6]) || 0,
        status: data[i][7],
        confirmedAt: data[i][8],
        createdAt: data[i][9]
      });
  }
  return result;
}

function getReservationsByGuest(guestLineUserId) {
  var sheet = getSheet(SHEET_NAMES.RESERVATIONS);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] !== guestLineUserId || data[i][7] !== '確定') continue;
    result.push({ checkIn: data[i][2], checkOut: data[i][3] });
  }
  return result;
}

function getGuestDisplayName(lineUserId) {
  if (!lineUserId) return '';
  var sheet = getSheet(SHEET_NAMES.GUESTS);
  if (!sheet) return '';
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === lineUserId) return data[i][1] != null ? String(data[i][1]) : '';
  }
  return '';
}

function getReservationsForMonthWithDetails(year, month) {
  var list = getReservationsForMonth(year, month);
  var result = [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    var totalAmount = (Number(r.amount) || 0) + (Number(r.cleaningFee) || 0);
    result.push({
      guestDisplayName: getGuestDisplayName(r.guestLineUserId) || '(不明)',
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      totalAmount: totalAmount
    });
  }
  return result;
}
