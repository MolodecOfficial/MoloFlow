/**
 * MoloFlow ⇄ Google Sheets bridge.
 * Создайте Apps Script из самой нужной Google Таблицы (Расширения → Apps Script).
 * Скрипт работает только с таблицей, к которой прикреплён; никаких service account / JSON-ключей.
 */
const MOLOFLOW_SPREADSHEET_ID = '1CTE1Xx-NdiMon18iRfqBfzqZww-50dfMzZlTZj5d1e8';

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    return json_(dispatch_(p.action, p, null));
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const raw = e && e.postData && e.postData.contents || '{}';
    const body = JSON.parse(raw);
    return json_(dispatch_(body.action || p.action, Object.assign({}, p, body), body));
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

function dispatch_(action, params, body) {
  const id = String(params.spreadsheetId || '');
  if (id !== MOLOFLOW_SPREADSHEET_ID) throw new Error('Этот Apps Script разрешает доступ только к привязанной таблице MoloFlow.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId() !== MOLOFLOW_SPREADSHEET_ID) throw new Error('Скрипт должен быть создан внутри указанной Google Таблицы.');

  if (action === 'meta') {
    return { spreadsheetId: ss.getId(), title: ss.getName(), sheets: ss.getSheets().map(function (s) {
      return { sheetId: s.getSheetId(), title: s.getName(), rowCount: s.getMaxRows(), columnCount: s.getMaxColumns() };
    }) };
  }
  if (action === 'values') {
    const sheet = ss.getSheetByName(String(params.sheet || ''));
    if (!sheet) throw new Error('Вкладка не найдена: ' + params.sheet);
    const values = sheet.getDataRange().getValues().map(function (row) {
      return row.map(function (v) {
        if (v instanceof Date) return v.toISOString();
        return v === null || v === undefined ? '' : v;
      });
    });
    return { spreadsheetId: ss.getId(), sheet: sheet.getName(), values: values };
  }
  if (action === 'write') {
    const writes = body && body.data;
    if (!Array.isArray(writes) || writes.length > 500) throw new Error('Некорректный список диапазонов.');
    writes.forEach(function (item) {
      if (!item || typeof item.range !== 'string' || !Array.isArray(item.values)) throw new Error('Некорректная запись.');
      const match = item.range.match(/^'((?:[^']|'')+)'!(\$?[A-Z]+\$?\d+)(?::(\$?[A-Z]+\$?\d+))?$/i);
      if (!match) throw new Error('Недопустимый A1-диапазон: ' + item.range);
      const sheetName = match[1].replace(/''/g, "'");
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error('Вкладка не найдена: ' + sheetName);
      const rangeA1 = match[2] + (match[3] ? ':' + match[3] : '');
      const range = sheet.getRange(rangeA1);
      const rows = item.values;
      if (!rows.length || !Array.isArray(rows[0])) throw new Error('Значения диапазона должны быть двумерным массивом.');
      const normalized = rows.map(function (row) { return row.map(function (v) { return v === null || v === undefined ? '' : v; }); });
      if (normalized.length !== range.getNumRows() || normalized.some(function (row) { return row.length !== range.getNumColumns(); })) {
        throw new Error('Размер values не совпадает с диапазоном ' + item.range);
      }
      range.setValues(normalized);
    });
    SpreadsheetApp.flush();
    return { ok: true, updatedRanges: writes.length };
  }
  throw new Error('Неизвестное действие: ' + action);
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
