/**
 * RTL3D Lightning Quiz -> Google Sheet
 *
 * Paste into Extensions -> Apps Script on your results spreadsheet, then
 * Deploy -> Manage deployments -> Edit -> New version -> Deploy.
 *
 * Each attempt becomes one row:
 *   Timestamp | Name | School/University | Score | Total | Percent | Q1 | Q2 | ...
 *
 * The Q columns hold the letter the person picked. A wrong answer is written
 * as "A -> C", meaning they picked A and the correct option was C. The number
 * of Q columns follows whatever the quiz posts, so adding a question to the
 * quiz does not require editing this script.
 */

var BASE_HEAD = ['Timestamp', 'Name', 'School/University', 'Score', 'Total', 'Percent'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var p = (e && e.parameter) ? e.parameter : {};

    var answers = [];
    for (var i = 1; p['q' + i] !== undefined; i++) answers.push(String(p['q' + i]));

    var head = BASE_HEAD.slice();
    for (var j = 0; j < answers.length; j++) head.push('Q' + (j + 1));
    ensureHeader_(sheet, head);

    sheet.appendRow([
      p.timestamp || new Date().toISOString(),
      p.name || '',
      p.school || '',
      p.score || '',
      p.total || '',
      (p.percent || '') + (p.percent ? '%' : '')
    ].concat(answers));

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Write the header on an empty sheet, or widen it when the quiz grew. */
function ensureHeader_(sheet, head) {
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(head);
    return;
  }
  var width = sheet.getLastColumn();
  if (head.length > width) {
    sheet.getRange(1, width + 1, 1, head.length - width)
      .setValues([head.slice(width)]);
  }
}

function doGet(e) {
  e = e || {};
  var p = e.parameter || {};

  if (p.action === 'results') {
    return reply_(getResultsPayload_(), p.callback);
  }

  return reply_({
    ok: true,
    message: 'RTL3D quiz endpoint is live.',
    sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl()
  }, p.callback);
}

function getResultsPayload_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), BASE_HEAD.length);

  if (lastRow < 2) {
    return { ok: true, head: BASE_HEAD.slice(), rows: [], sheetUrl: ss.getUrl() };
  }

  var head = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h == null ? '' : h); });

  // rows 2..lastRow inclusive is lastRow - 1 rows, not lastRow
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var rows = values.map(function (row) {
    return row.map(function (c) { return c == null ? '' : String(c); });
  }).reverse();

  return { ok: true, head: head, rows: rows, sheetUrl: ss.getUrl() };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function reply_(obj, callback) {
  var body = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + body + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
