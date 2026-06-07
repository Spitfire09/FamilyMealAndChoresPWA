const PASSWORD = 'dit-hemmelige-kodeord';
const SPREADSHEET_ID = 'dit-regneark-id';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.password !== PASSWORD) {
      return jsonResponse({ ok: false, error: 'Forkert adgangskode' });
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (body.action === 'test') {
      return jsonResponse({ ok: true });
    }
    if (body.action === 'push') {
      writeData(ss, body.data || {});
      return jsonResponse({ ok: true });
    }
    if (body.action === 'pull') {
      return jsonResponse({ ok: true, data: readData(ss) });
    }
    return jsonResponse({ ok: false, error: 'Ukendt handling: ' + body.action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function writeData(ss, d) {
  writeSheet(ss, 'MealPlan',
    Object.entries(d.mealPlan || {}).map(([k, v]) => [k, JSON.stringify(v)]));
  writeSheet(ss, 'DayOverrides',
    Object.entries(d.dayOverrides || {}).map(([k, v]) => [k, JSON.stringify(v)]));
  writeSheet(ss, 'DateCreatedAt',
    Object.entries(d.dateCreatedAt || {}).map(([k, v]) => [k, v]));
  writeSheet(ss, 'ChoreLogs',
    (d.choreLogs || []).map(e => [e.id, e.person, e.task, e.notedAt]));
  writeSheet(ss, 'LateLogs',
    (d.lateLogs || []).map(e => [e.id, e.mealDate, e.person, e.loggedAt]));
  writeSheet(ss, 'Settings', [['data', JSON.stringify(d.settings || {})]]);
}

function readData(ss) {
  const mealPlan = {};
  readSheet(ss, 'MealPlan').forEach(([k, v]) => {
    try { mealPlan[k] = JSON.parse(v); } catch {}
  });
  const dayOverrides = {};
  readSheet(ss, 'DayOverrides').forEach(([k, v]) => {
    try { dayOverrides[k] = JSON.parse(v); } catch {}
  });
  const dateCreatedAt = {};
  readSheet(ss, 'DateCreatedAt').forEach(([k, v]) => { dateCreatedAt[k] = v; });
  const choreLogs = readSheet(ss, 'ChoreLogs')
    .map(([id, person, task, notedAt]) => ({ id, person, task, notedAt }));
  const lateLogs = readSheet(ss, 'LateLogs')
    .map(([id, mealDate, person, loggedAt]) => ({ id, mealDate, person, loggedAt }));
  let settings = {};
  const settingsRows = readSheet(ss, 'Settings');
  if (settingsRows.length > 0) {
    try { settings = JSON.parse(settingsRows[0][1]); } catch {}
  }
  return { mealPlan, dayOverrides, dateCreatedAt, choreLogs, lateLogs, settings };
}

function writeSheet(ss, name, rows) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  if (rows.length > 0)
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}

function readSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() === 0) return [];
  return sheet.getDataRange().getValues();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
