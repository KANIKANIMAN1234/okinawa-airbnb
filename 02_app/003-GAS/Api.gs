/**
 * Vercel 用 API（URL-B）action 分岐
 * POST body: { action: "xxx", data: { ... } }
 */
function handleApiAction(action, data) {
  if (!action) return { status: 'error', message: 'action が指定されていません' };
  try {
    switch (action) {
      case 'isAdmin':
        return apiIsAdmin(data);
      case 'getTemplate':
        return apiGetTemplate(data);
      case 'saveTemplate':
        return apiSaveTemplate(data);
      case 'getConfig':
        return apiGetConfig(data);
      case 'saveConfig':
        return apiSaveConfig(data);
      case 'getAvailability':
        return apiGetAvailability(data);
      case 'getPricing':
        return apiGetPricing(data);
      case 'confirmReservation':
        return apiConfirmReservation(data);
      case 'getMyReservations':
        return apiGetMyReservations(data);
      case 'getMonthReservationDetails':
        return apiGetMonthReservationDetails(data);
      case 'getAllReservationDetails':
        return apiGetAllReservationDetails(data);
      case 'closeMonth':
        return apiCloseMonth(data);
      case 'getPhotos':
        return apiGetPhotos(data);
      case 'savePhotos':
        return apiSavePhotos(data);
      case 'uploadPhoto':
        return apiUploadPhoto(data);
      case 'cancelReservation':
        return apiCancelReservation(data);
      default:
        return { status: 'error', message: '不明な action: ' + action };
    }
  } catch (e) {
    return { status: 'error', message: e.message || String(e) };
  }
}

function apiIsAdmin(data) {
  var lineUserId = data && data.lineUserId;
  if (!lineUserId) return { status: 'success', result: { isAdmin: false } };
  var adminId = getConfigValue('adminLineUserId');
  return { status: 'success', result: { isAdmin: adminId === lineUserId } };
}

function apiGetTemplate(data) {
  var key = data && data.key;
  if (!key) return { status: 'error', message: 'key が指定されていません' };
  var body = getTemplateBody(key);
  return { status: 'success', result: { body: body || '' } };
}

function apiSaveTemplate(data) {
  var key = data && data.key;
  var body = data && data.body;
  if (!key) return { status: 'error', message: 'key が指定されていません' };
  saveTemplate(key, body != null ? String(body) : '');
  return { status: 'success' };
}

function apiGetConfig(data) {
  var key = data && data.key;
  if (!key) return { status: 'error', message: 'key が指定されていません' };
  var value = getConfigValue(key);
  return { status: 'success', result: { value: value != null ? value : '' } };
}

function apiSaveConfig(data) {
  var lineUserId = data && data.lineUserId;
  var adminId = getConfigValue('adminLineUserId');
  if (!adminId || adminId !== lineUserId)
    return { status: 'error', message: '管理者のみ保存できます' };
  var key = data && data.key;
  var value = data && data.value;
  if (!key) return { status: 'error', message: 'key が指定されていません' };
  setConfigValue(key, value != null ? String(value) : '');
  return { status: 'success' };
}

function apiGetAvailability(data) {
  var year = data && data.year;
  var month = data && data.month;
  var blocked = [];
  var icalUrl = getConfigValue('airbnbIcalUrl');
  if (icalUrl) {
    if (year != null && month != null) {
      blocked = getBlockedDatesFromIcal(icalUrl, parseInt(year, 10), parseInt(month, 10));
    } else {
      var start = data && data.start;
      var end = data && data.end;
      if (start && end) {
        var startDate = new Date(start);
        var endDate = new Date(end);
        blocked = getBlockedDatesInRange(icalUrl, startDate, endDate);
      } else {
        var now = new Date();
        blocked = getBlockedDatesFromIcal(icalUrl, now.getFullYear(), now.getMonth() + 1);
      }
    }
  }
  if (year != null && month != null) {
    var fromSheets = getBlockedDateKeysFromReservations(parseInt(year, 10), parseInt(month, 10));
    for (var i = 0; i < fromSheets.length; i++) {
      if (blocked.indexOf(fromSheets[i]) === -1) blocked.push(fromSheets[i]);
    }
  }
  return { status: 'success', result: { blockedDates: blocked } };
}

function apiGetPricing(data) {
  var nightlyRate = parseInt(getConfigValue('nightlyRate') || '0', 10) || 15000;
  var cleaningFee = parseInt(getConfigValue('cleaningFee') || '0', 10) || 10000;
  return { status: 'success', result: { nightlyRate: nightlyRate, cleaningFee: cleaningFee } };
}

function apiConfirmReservation(data) {
  var lineUserId = data && data.lineUserId;
  var displayName = data && data.displayName;
  var checkIn = data && data.checkIn;
  var checkOut = data && data.checkOut;
  var numberOfGuests = data && data.numberOfGuests;
  var totalAmount = data && data.totalAmount;
  if (!lineUserId || !checkIn || !checkOut) {
    return { status: 'error', message: 'lineUserId, checkIn, checkOut は必須です' };
  }
  var icalUrl = getConfigValue('airbnbIcalUrl');
  if (icalUrl) {
    var startDate = new Date(checkIn);
    var endDate = new Date(checkOut);
    var blocked = getBlockedDatesInRange(icalUrl, startDate, endDate);
    var d = new Date(checkIn);
    while (d < endDate) {
      var key = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
      if (blocked.indexOf(key) !== -1)
        return { status: 'error', message: '選択された期間は既に予約が入っています' };
      d.setDate(d.getDate() + 1);
    }
  }
  var nightlyRate = parseInt(getConfigValue('nightlyRate') || '0', 10) || 15000;
  var cleaningFee = parseInt(getConfigValue('cleaningFee') || '0', 10) || 10000;
  var nights = Math.round((new Date(checkOut) - new Date(checkIn)) / (24 * 60 * 60 * 1000));
  var amount = nightlyRate * nights;
  var reservationId = createReservation(
    lineUserId,
    checkIn,
    checkOut,
    parseInt(numberOfGuests, 10) || 1,
    amount,
    cleaningFee,
    totalAmount != null ? Number(totalAmount) : amount + cleaningFee
  );
  ensureGuest(lineUserId, displayName || '');
  
  var guestMsg = getTemplateBody('reservationConfirm') || 'ご予約ありがとうございます。当日はよろしくお願いいたします。';
  var restaurantGuide = getTemplateBody('restaurantGuide');
  if (restaurantGuide) guestMsg += '\n\n' + restaurantGuide;
  
  var checkInDate = new Date(checkIn);
  var date50 = new Date(checkInDate);
  date50.setDate(date50.getDate() - 7);
  var date80 = new Date(checkInDate);
  date80.setDate(date80.getDate() - 4);
  var date100 = new Date(checkInDate);
  date100.setDate(date100.getDate() - 3);
  
  var formatDate = function(d) {
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  };
  
  guestMsg += '\n\n【キャンセル規定のご案内】\nご予約後のキャンセルポリシー\n　1週間前：50%\n　4日前　：80%\n　3日前　：100%\n\n';
  guestMsg += formatDate(date50) + '以降のキャンセル料は50%\n';
  guestMsg += formatDate(date80) + '以降のキャンセル料は80%\n';
  guestMsg += formatDate(date100) + '以降のキャンセル料は100%\n';
  guestMsg += '（※キャンセル料は清掃代も含む）';
  
  var lineNotifyGuest = pushToUser(lineUserId, guestMsg);

  var lineNotifyAdmin = true;
  var adminId = getConfigValue('adminLineUserId');
  if (adminId) {
    var adminMsg = '予約が入りました\nゲスト: ' + (displayName || lineUserId) + '\nチェックイン: ' + checkIn + '\nチェックアウト: ' + checkOut + '\n人数: ' + (numberOfGuests || '-') + '\n金額: ' + (totalAmount != null ? totalAmount : amount + cleaningFee) + ' 円';
    lineNotifyAdmin = pushToUser(adminId, adminMsg);
  }

  var cleanerGroupId = getConfigValue('cleanerLineGroupId');
  if (cleanerGroupId) {
    var cleanerMsg = checkIn + '〜' + checkOut + ' 予約確定。チェックアウト ' + checkOut + '。清掃よろしくお願いします。';
    pushToGroup(cleanerGroupId, cleanerMsg);
  }

  var calendarAdded = addReservationToCalendar(reservationId, checkIn, checkOut, displayName || '', numberOfGuests);

  return {
    status: 'success',
    result: {
      reservationId: reservationId,
      lineNotifyGuest: lineNotifyGuest,
      lineNotifyAdmin: lineNotifyAdmin,
      calendarAdded: calendarAdded
    }
  };
}

function apiGetMyReservations(data) {
  var lineUserId = data && data.lineUserId;
  if (!lineUserId) return { status: 'success', result: { reservations: [] } };
  var list = getReservationsByGuest(lineUserId);
  return { status: 'success', result: { reservations: list } };
}

function apiGetMonthReservationDetails(data) {
  var lineUserId = data && data.lineUserId;
  var adminId = getConfigValue('adminLineUserId');
  if (!lineUserId || adminId !== lineUserId) {
    return { status: 'error', message: '管理者のみ利用できます' };
  }
  var year = data && data.year;
  var month = data && data.month;
  if (year == null || month == null) return { status: 'success', result: { reservationDetails: [] } };
  var list = getReservationsForMonthWithDetails(parseInt(year, 10), parseInt(month, 10));
  return { status: 'success', result: { reservationDetails: list } };
}

function apiGetAllReservationDetails(data) {
  var lineUserId = data && data.lineUserId;
  var adminId = getConfigValue('adminLineUserId');
  if (!lineUserId || adminId !== lineUserId) {
    return { status: 'error', message: '管理者のみ利用できます' };
  }
  var list = getAllReservationsWithDetails();
  return { status: 'success', result: { reservationDetails: list } };
}

function apiCloseMonth(data) {
  var lineUserId = data && data.lineUserId;
  var adminId = getConfigValue('adminLineUserId');
  if (!adminId || adminId !== lineUserId)
    return { status: 'error', message: '管理者のみ実行できます' };
  var year = data && data.year != null ? parseInt(data.year, 10) : new Date().getFullYear();
  var month = data && data.month != null ? parseInt(data.month, 10) : new Date().getMonth();
  if (month === 0) { year--; month = 12; }
  var result = saveMonthlyPdfToDrive(year, month);
  return { status: 'success', result: result };
}

function apiGetPhotos(data) {
  var photos = getPhotos();
  return { status: 'success', result: { photos: photos } };
}

function apiSavePhotos(data) {
  var lineUserId = data && data.lineUserId;
  var adminId = getConfigValue('adminLineUserId');
  if (!adminId || adminId !== lineUserId) {
    return { status: 'error', message: '管理者のみ保存できます' };
  }
  var photos = data && data.photos;
  if (!photos || !Array.isArray(photos)) {
    return { status: 'error', message: 'photos 配列が必要です' };
  }
  var success = savePhotos(photos);
  return success ? { status: 'success' } : { status: 'error', message: '保存に失敗しました' };
}

function apiUploadPhoto(data) {
  var lineUserId = data && data.lineUserId;
  var adminId = getConfigValue('adminLineUserId');
  if (!adminId || adminId !== lineUserId) {
    return { status: 'error', message: '管理者のみアップロードできます' };
  }
  var base64Data = data && data.base64Data;
  var fileName = data && data.fileName;
  var mimeType = data && data.mimeType;
  if (!base64Data || !fileName || !mimeType) {
    return { status: 'error', message: 'base64Data, fileName, mimeType が必要です' };
  }
  try {
    var url = uploadPhotoToDrive(base64Data, fileName, mimeType);
    return { status: 'success', result: { imageUrl: url } };
  } catch (e) {
    return { status: 'error', message: e.message || String(e) };
  }
}

function apiCancelReservation(data) {
  var lineUserId = data && data.lineUserId;
  var reservationId = data && data.reservationId;
  
  if (!lineUserId || !reservationId) {
    return { status: 'error', message: 'lineUserId と reservationId が必要です' };
  }
  
  var result = cancelReservation(reservationId, lineUserId);
  
  if (!result.success) {
    return { status: 'error', message: result.message };
  }
  
  if (result.cancellationFee > 0) {
    var adminId = getConfigValue('adminLineUserId');
    if (adminId) {
      var feeRateText = result.cancellationFeeRate === 1.0 ? '100%' : 
                        result.cancellationFeeRate === 0.8 ? '80%' : 
                        result.cancellationFeeRate === 0.5 ? '50%' : '0%';
      var adminMsg = 'キャンセルが発生しました\n予約ID: ' + reservationId + 
                     '\nチェックイン: ' + result.checkIn + 
                     '\nキャンセル料率: ' + feeRateText + 
                     '\nキャンセル料: ' + result.cancellationFee + '円';
      pushToUser(adminId, adminMsg);
    }
  }
  
  removeReservationFromCalendar(reservationId, result.checkIn, result.checkOut);
  
  return {
    status: 'success',
    result: {
      cancellationFee: result.cancellationFee,
      cancellationFeeRate: result.cancellationFeeRate
    }
  };
}
