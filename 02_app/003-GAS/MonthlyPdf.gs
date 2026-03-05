/**
 * 月次売上集計・PDF 生成・Google Drive 保存
 * Google Document を一時作成し PDF にエクスポートして Drive に保存する
 */
function saveMonthlyPdfToDrive(year, month) {
  var folderId = getConfigValue('driveFolderId');
  if (!folderId) throw new Error('driveFolderId が設定されていません');
  var rows = getReservationsForMonth(year, month);
  var doc = DocumentApp.create('月間売上_' + year + '年' + (month < 10 ? '0' : '') + month + '月');
  var body = doc.getBody();
  body.appendParagraph('月間売上レポート ' + year + '年' + month + '月').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('');
  var totalAmount = 0;
  var totalCleaning = 0;
  var table = body.appendTable();
  var headerRow = table.appendTableRow();
  headerRow.appendTableCell('予約ID');
  headerRow.appendTableCell('チェックイン');
  headerRow.appendTableCell('チェックアウト');
  headerRow.appendTableCell('宿泊料金');
  headerRow.appendTableCell('清掃代');
  headerRow.appendTableCell('合計');
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var rowTotal = (r.amount || 0) + (r.cleaningFee || 0);
    totalAmount += r.amount || 0;
    totalCleaning += r.cleaningFee || 0;
    var tr = table.appendTableRow();
    tr.appendTableCell(r.reservationId || '');
    tr.appendTableCell(r.checkIn || '');
    tr.appendTableCell(r.checkOut || '');
    tr.appendTableCell(String(r.amount || 0));
    tr.appendTableCell(String(r.cleaningFee || 0));
    tr.appendTableCell(String(rowTotal));
  }
  body.appendParagraph('');
  body.appendParagraph('宿泊料金合計: ' + totalAmount + ' 円');
  body.appendParagraph('清掃代合計: ' + totalCleaning + ' 円');
  body.appendParagraph('売上合計: ' + (totalAmount + totalCleaning) + ' 円（' + rows.length + ' 件）');
  body.appendParagraph('作成日時: ' + new Date().toLocaleString('ja-JP'));
  doc.saveAndClose();
  var file = DriveApp.getFileById(doc.getId());
  var pdf = file.getAs('application/pdf');
  var fileName = '月間売上_' + year + '年' + (month < 10 ? '0' : '') + month + '月.pdf';
  pdf.setName(fileName);
  var folder = DriveApp.getFolderById(folderId);
  folder.createFile(pdf);
  file.setTrashed(true);
  return { count: rows.length, fileName: fileName };
}
