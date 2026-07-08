/**
 * RTL3D Lightning Quiz → Google Sheet
 * Paste into Extensions → Apps Script on your results spreadsheet, then
 * Deploy → Manage deployments → Edit → New version → Deploy.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Name', 'School/University', 'Score', 'Total', 'Percent']);
    }

    var p = (e && e.parameter) ? e.parameter : {};
    sheet.appendRow([
      p.timestamp || new Date().toISOString(),
      p.name || '',
      p.school || '',
      p.score || '',
      p.total || '',
      (p.percent || '') + (p.percent ? '%' : '')
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  e = e || {};
  var p = e.parameter || {};

  if (p.action === 'results') {
    var payload = getResultsPayload_();
    var json = JSON.stringify(payload);
    if (p.callback) {
      return ContentService
        .createTextOutput(p.callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      message: 'RTL3D quiz endpoint is live.',
      sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getResultsPayload_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { ok: true, rows: [], sheetUrl: ss.getUrl() };
  }

  var values = sheet.getRange(2, 1, lastRow, 6).getValues();
  var rows = values.map(function (row) {
    return {
      timestamp: row[0] ? String(row[0]) : '',
      name: row[1] || '',
      school: row[2] || '',
      score: row[3],
      total: row[4],
      percent: row[5]
    };
  }).reverse();

  return { ok: true, rows: rows, sheetUrl: ss.getUrl() };
}
