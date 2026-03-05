/**
 * Airbnb iCal 取得・パース（RFC 5545）
 * VEVENT の DTSTART/DTEND から予約済み日（YYYY-MM-DD）を抽出
 */
function getBlockedDatesFromIcal(icalUrl, year, month) {
  if (!icalUrl) return [];
  var startDate = new Date(year, month - 1, 1);
  var endDate = new Date(year, month, 0);
  return getBlockedDatesInRange(icalUrl, startDate, endDate);
}

function getBlockedDatesInRange(icalUrl, startDate, endDate) {
  if (!icalUrl) return [];
  var ics;
  try {
    var res = UrlFetchApp.fetch(icalUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; iCal-Reader/1.0)',
        'Accept': 'text/calendar, text/plain, */*'
      }
    });
    if (res.getResponseCode() !== 200) return [];
    ics = res.getContentText('UTF-8');
  } catch (e) {
    return [];
  }
  var blocked = [];
  var events = parseIcalEvents(ics);
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var d = new Date(ev.start.getTime());
    while (d < ev.end) {
      var y = d.getFullYear();
      var m = d.getMonth() + 1;
      var day = d.getDate();
      var key = y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
      if (blocked.indexOf(key) === -1) blocked.push(key);
      d.setDate(d.getDate() + 1);
    }
  }
  if (startDate && endDate) {
    blocked = blocked.filter(function (key) {
      var p = key.split('-');
      var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
      return d >= startDate && d <= endDate;
    });
  }
  return blocked;
}

function parseIcalEvents(ics) {
  var events = [];
  if (!ics || typeof ics !== 'string') return events;
  var unfolded = ics.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
  var blocks = unfolded.split('BEGIN:VEVENT');
  for (var b = 1; b < blocks.length; b++) {
    var block = blocks[b].split('END:VEVENT')[0];
    var dtStart = null;
    var dtEnd = null;
    var lines = block.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var idx = line.indexOf(':');
      if (idx === -1) continue;
      var key = line.substring(0, idx).split(';')[0].trim();
      var val = line.substring(idx + 1).trim();
      if (key === 'DTSTART') dtStart = parseIcalDate(val);
      if (key === 'DTEND') dtEnd = parseIcalDate(val);
    }
    if (dtStart && dtEnd) events.push({ start: dtStart, end: dtEnd });
  }
  return events;
}

function parseIcalDate(str) {
  if (!str) return null;
  str = String(str).replace(/\s/g, '');
  if (str.length >= 8) {
    var y = parseInt(str.substring(0, 4), 10);
    var m = parseInt(str.substring(4, 6), 10) - 1;
    var d = parseInt(str.substring(6, 8), 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      return new Date(y, m, d);
    }
  }
  if (str.indexOf('-') !== -1) {
    var parts = str.split('-');
    if (parts.length >= 3) {
      var y2 = parseInt(parts[0], 10);
      var m2 = parseInt(parts[1], 10) - 1;
      var d2 = parseInt(parts[2], 10);
      if (!isNaN(y2) && !isNaN(m2) && !isNaN(d2)) return new Date(y2, m2, d2);
    }
  }
  return null;
}
