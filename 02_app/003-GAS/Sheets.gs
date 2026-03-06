/**
 * スプレッドシートアクセス
 * シート名: inquiries, reservations, guests, templates, config
 */
var SHEET_NAMES = {
  INQUIRIES: 'inquiries',
  RESERVATIONS: 'reservations',
  GUESTS: 'guests',
  TEMPLATES: 'templates',
  CONFIG: 'config',
  PHOTOS: 'photos'
};

function getSpreadsheet() {
  var id = getSpreadsheetId();
  if (!id) throw new Error('SPREADSHEET_ID が設定されていません');
  return SpreadsheetApp.openById(id);
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

function formatDateAsString(dateValue) {
  if (!dateValue) return '';
  var d;
  if (dateValue instanceof Date) {
    d = dateValue;
  } else if (typeof dateValue === 'string') {
    var str = String(dateValue).trim();
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
    d = new Date(str);
  } else {
    d = new Date(dateValue);
  }
  if (isNaN(d.getTime())) return String(dateValue);
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
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
  var checkInDate = String(checkIn).slice(0, 10);
  var checkOutDate = String(checkOut).slice(0, 10);
  sheet.appendRow([
    reservationId,
    guestLineUserId,
    checkInDate,
    checkOutDate,
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

/**
 * 指定月に含まれる「確定」予約の日付キー（YYYY-MM-DD）を返す（iCal とマージしてカレンダー用）
 */
function getBlockedDateKeysFromReservations(year, month) {
  var sheet = getSheet(SHEET_NAMES.RESERVATIONS);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var keysMap = {};
  var monthStart = new Date(year, month - 1, 1);
  var monthEnd = new Date(year, month, 0);
  for (var i = 1; i < data.length; i++) {
    if (data[i][7] !== '確定') continue;
    var checkInRaw = data[i][2];
    var checkOutRaw = data[i][3];
    if (!checkInRaw || !checkOutRaw) continue;
    var checkInStr = formatDateAsString(checkInRaw);
    var checkOutStr = formatDateAsString(checkOutRaw);
    var cinParts = checkInStr.split('-');
    var coutParts = checkOutStr.split('-');
    if (cinParts.length !== 3 || coutParts.length !== 3) continue;
    var cin = new Date(parseInt(cinParts[0], 10), parseInt(cinParts[1], 10) - 1, parseInt(cinParts[2], 10));
    var cout = new Date(parseInt(coutParts[0], 10), parseInt(coutParts[1], 10) - 1, parseInt(coutParts[2], 10));
    if (isNaN(cin.getTime()) || isNaN(cout.getTime())) continue;
    var d = new Date(cin.getTime());
    while (d < cout) {
      if (d >= monthStart && d <= monthEnd) {
        var y = d.getFullYear();
        var m = d.getMonth() + 1;
        var day = d.getDate();
        var key = y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
        keysMap[key] = true;
      }
      d.setDate(d.getDate() + 1);
    }
  }
  return Object.keys(keysMap);
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

/**
 * 指定月に1日でもかかる「確定」予約をすべて返す（管理者用・前月開始の予約も含む）
 */
function getReservationsOverlappingMonth(year, month) {
  var sheet = getSheet(SHEET_NAMES.RESERVATIONS);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var monthStart = new Date(year, month - 1, 1);
  var monthEnd = new Date(year, month, 0);
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][7] !== '確定') continue;
    var checkInRaw = data[i][2];
    var checkOutRaw = data[i][3];
    if (!checkInRaw || !checkOutRaw) continue;
    var checkInStr = formatDateAsString(checkInRaw);
    var checkOutStr = formatDateAsString(checkOutRaw);
    var cinParts = checkInStr.split('-');
    var coutParts = checkOutStr.split('-');
    if (cinParts.length !== 3 || coutParts.length !== 3) continue;
    var cin = new Date(parseInt(cinParts[0], 10), parseInt(cinParts[1], 10) - 1, parseInt(cinParts[2], 10));
    var cout = new Date(parseInt(coutParts[0], 10), parseInt(coutParts[1], 10) - 1, parseInt(coutParts[2], 10));
    if (isNaN(cin.getTime()) || isNaN(cout.getTime())) continue;
    if (cout <= monthStart || cin > monthEnd) continue;
    result.push({
      reservationId: data[i][0],
      guestLineUserId: data[i][1],
      checkIn: checkInStr,
      checkOut: checkOutStr,
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
    result.push({ 
      checkIn: formatDateAsString(data[i][2]), 
      checkOut: formatDateAsString(data[i][3]) 
    });
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
  var list = getReservationsOverlappingMonth(year, month);
  var result = [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    var totalAmount = (Number(r.amount) || 0) + (Number(r.cleaningFee) || 0);
    result.push({
      guestDisplayName: getGuestDisplayName(r.guestLineUserId) || '(不明)',
      checkIn: formatDateAsString(r.checkIn),
      checkOut: formatDateAsString(r.checkOut),
      totalAmount: totalAmount
    });
  }
  return result;
}

/**
 * スプレッドシートの確定予約を全件取得（管理者用・過去・当月・未来の区別なし）
 */
function getAllReservationsWithDetails() {
  var sheet = getSheet(SHEET_NAMES.RESERVATIONS);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][7] !== '確定') continue;
    var checkInStr = String(data[i][2]).trim();
    var checkOutStr = String(data[i][3]).trim();
    if (!checkInStr || !checkOutStr) continue;
    var totalAmount = (Number(data[i][5]) || 0) + (Number(data[i][6]) || 0);
    result.push({
      guestDisplayName: getGuestDisplayName(data[i][1]) || '(不明)',
      checkIn: formatDateAsString(data[i][2]),
      checkOut: formatDateAsString(data[i][3]),
      totalAmount: totalAmount
    });
  }
  result.sort(function (a, b) {
    var t1 = new Date(a.checkIn).getTime();
    var t2 = new Date(b.checkIn).getTime();
    return t1 - t2;
  });
  return result;
}

function getPhotos() {
  var sheet = getSheet(SHEET_NAMES.PHOTOS);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0] || !data[i][1]) continue;
    result.push({
      photoId: data[i][0],
      imageUrl: data[i][1],
      displayOrder: Number(data[i][2]) || 0,
      caption: data[i][3] || ''
    });
  }
  result.sort(function(a, b) {
    return a.displayOrder - b.displayOrder;
  });
  return result;
}

function savePhotos(photos) {
  var sheet = getSheet(SHEET_NAMES.PHOTOS);
  if (!sheet) return false;
  sheet.clear();
  sheet.appendRow(['photoId', 'imageUrl', 'displayOrder', 'caption']);
  for (var i = 0; i < photos.length; i++) {
    var p = photos[i];
    sheet.appendRow([
      p.photoId || '',
      p.imageUrl || '',
      Number(p.displayOrder) || 0,
      p.caption || ''
    ]);
  }
  return true;
}

function uploadPhotoToDrive(base64Data, fileName, mimeType) {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('photosFolderId');
  if (!folderId) {
    throw new Error('photosFolderId が設定されていません');
  }
  var folder = DriveApp.getFolderById(folderId);
  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fileId = file.getId();
  var url = 'https://drive.google.com/uc?export=view&id=' + fileId;
  return url;
}
