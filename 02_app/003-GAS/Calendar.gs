/**
 * Googleカレンダー連携
 * LINE予約をGoogleカレンダーに追加し、iCal経由でAirbnbに同期
 */

function addReservationToCalendar(reservationId, checkIn, checkOut, guestDisplayName, numberOfGuests) {
  var props = PropertiesService.getScriptProperties();
  var calendarId = props.getProperty('googleCalendarId');
  
  if (!calendarId) {
    Logger.log('googleCalendarId が設定されていません。カレンダー連携をスキップします。');
    return false;
  }
  
  try {
    var calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      Logger.log('指定されたカレンダーが見つかりません: ' + calendarId);
      return false;
    }
    
    var checkInDate = new Date(checkIn);
    var checkOutDate = new Date(checkOut);
    
    var title = 'LINE予約 - ' + (guestDisplayName || '予約者');
    var description = '予約ID: ' + reservationId + '\n';
    description += '宿泊人数: ' + (numberOfGuests || '-') + '名\n';
    description += 'チェックイン: ' + checkIn + '\n';
    description += 'チェックアウト: ' + checkOut;
    
    var event = calendar.createAllDayEvent(
      title,
      checkInDate,
      checkOutDate,
      {
        description: description
      }
    );
    
    Logger.log('Googleカレンダーに予約を追加しました: ' + event.getId());
    return true;
  } catch (e) {
    Logger.log('Googleカレンダーへの追加に失敗: ' + e.message);
    return false;
  }
}

function removeReservationFromCalendar(reservationId, checkIn, checkOut) {
  var props = PropertiesService.getScriptProperties();
  var calendarId = props.getProperty('googleCalendarId');
  
  if (!calendarId) {
    return false;
  }
  
  try {
    var calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      return false;
    }
    
    var checkInDate = new Date(checkIn);
    var checkOutDate = new Date(checkOut);
    checkOutDate.setDate(checkOutDate.getDate() + 1);
    
    var events = calendar.getEvents(checkInDate, checkOutDate);
    
    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      var desc = event.getDescription();
      if (desc && desc.indexOf('予約ID: ' + reservationId) !== -1) {
        event.deleteEvent();
        Logger.log('Googleカレンダーから予約を削除しました: ' + reservationId);
        return true;
      }
    }
    
    Logger.log('該当する予約がカレンダーに見つかりませんでした: ' + reservationId);
    return false;
  } catch (e) {
    Logger.log('Googleカレンダーからの削除に失敗: ' + e.message);
    return false;
  }
}
