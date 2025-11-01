const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Single enforced schema: [nickname, username, cekincki]
const NICKNAME_HEADER = ['nickname', 'username', 'cekincki'];

function getAuth() {
  // Prefer explicit path, then GOOGLE_APPLICATION_CREDENTIALS, then inline JSON
  let credentialsPath = process.env.GCP_CREDENTIALS_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let creds;
  if (credentialsPath) {
    const fullPath = path.resolve(credentialsPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Google credentials file not found at ${fullPath}`);
    }
    creds = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } else if (process.env.GCP_CREDENTIALS_JSON) {
    creds = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
  } else {
    throw new Error('No Google credentials configured. Set GCP_CREDENTIALS_PATH (or GOOGLE_APPLICATION_CREDENTIALS) to a Service Account key JSON, or set GCP_CREDENTIALS_JSON.');
  }

  const clientEmail = creds.client_email;
  let privateKey = creds.private_key;
  if (!clientEmail || !privateKey) {
    throw new Error('Credentials JSON missing client_email or private_key. Ensure this is a Service Account key (Keys → Add key → JSON) and not an OAuth client or metadata file.');
  }
  // Handle escaped newlines if credentials provided inline via env
  if (typeof privateKey === 'string' && (privateKey.includes('\\n') || privateKey.includes('\r\n'))) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // Prefer GoogleAuth which tolerates different key formats
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

async function getSheets() {
  const googleAuth = await getAuth();
  try {
    const client = await googleAuth.getClient();
    return google.sheets({ version: 'v4', auth: client });
  } catch (e) {
    throw new Error(`Google auth failed: ${e && e.message ? e.message : e}`);
  }
}

function quoteSheetName(name) {
  const escaped = String(name).replace(/'/g, "''");
  return `'${escaped}'`;
}

function verifyGoogleCredentials() {
  const result = { source: null, path: null, hasClientEmail: false, hasPrivateKey: false };
  let credentialsPath = process.env.GCP_CREDENTIALS_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  try {
    if (credentialsPath) {
      const fullPath = require('path').resolve(credentialsPath);
      result.source = 'file';
      result.path = fullPath;
      if (!require('fs').existsSync(fullPath)) return result;
      const creds = JSON.parse(require('fs').readFileSync(fullPath, 'utf8'));
      result.hasClientEmail = !!creds.client_email;
      result.hasPrivateKey = !!creds.private_key;
      return result;
    }
    if (process.env.GCP_CREDENTIALS_JSON) {
      result.source = 'inline';
      const creds = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
      result.hasClientEmail = !!creds.client_email;
      result.hasPrivateKey = !!creds.private_key;
      return result;
    }
    result.source = 'none';
    return result;
  } catch (_) {
    return result;
  }
}

function getSheetMeta() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = process.env.SHEET_NAME || 'cekincki';
  if (!spreadsheetId) throw new Error('SPREADSHEET_ID is not set');
  const q = quoteSheetName(sheetName);
  return { spreadsheetId, range: `${q}!A:C`, sheetName, qSheet: q };
}

async function ensureSheetExists(sheets, spreadsheetId, sheetName) {
  // Ensure the worksheet/tab exists; create if missing
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets || []).some(s => s.properties && s.properties.title === sheetName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
    console.log(`[sheets] Created missing tab '${sheetName}'`);
  }
}

async function ensureHeader() {
  const sheets = await getSheets();
  const { spreadsheetId, range, sheetName, qSheet } = getSheetMeta();
  await ensureSheetExists(sheets, spreadsheetId, sheetName);
  // Read first row
  const read = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${qSheet}!A1:C1` });
  const values = read.data.values || [];
  // Always enforce the nickname header as requested
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${qSheet}!A1:C1`,
    valueInputOption: 'RAW',
    requestBody: { values: [NICKNAME_HEADER] },
  });
  console.log(`[sheets] Enforced header on '${sheetName}' as: ${NICKNAME_HEADER.join(', ')}`);
}

// Fixed columns: A=nickname, B=username, C=cekincki

async function readAll() {
  const sheets = await getSheets();
  const { spreadsheetId, range, sheetName, qSheet } = getSheetMeta();
  await ensureSheetExists(sheets, spreadsheetId, sheetName);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values || [];
  // Map by nickname
  const mapByNickname = new Map();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const nickname = row[0];
    const username = row[1];
    const cekincki = row[2];
    const value = Number.parseInt(cekincki, 10);
    const entry = { username: username || '', nickname: nickname || '', value: Number.isFinite(value) ? value : 0, rowIndex: i + 1 };
    if (nickname) mapByNickname.set(nickname, entry);
  }
  return { rows, mapByNickname };
}

async function upsertUser(userId, username, value) {
  const sheets = await getSheets();
  const { spreadsheetId, range, sheetName, qSheet } = getSheetMeta();
  await ensureHeader();
  // No-op in nickname-only schema
  return { action: 'skipped-nickname-schema' };
}

async function bulkSyncMembers(members) {
  // members: array of { id, username, displayName }
  const sheets = await getSheets();
  const { spreadsheetId, range, sheetName } = getSheetMeta();
  await ensureHeader();
  const { mapByNickname } = await readAll();
  const rowsToAppend = [];
  const existingNicks = new Set(mapByNickname.keys());
  for (const m of members) {
    const nick = m.displayName || m.username;
    if (nick && !existingNicks.has(nick)) {
      rowsToAppend.push([nick, m.username, 0]);
    }
  }
  if (rowsToAppend.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rowsToAppend },
    });
  }
  return { inserted: rowsToAppend.length, totalMembers: members.length };
}

async function upsertMemberRecord(member, value) {
  const sheets = await getSheets();
  const { spreadsheetId, range, sheetName, qSheet } = getSheetMeta();
  await ensureHeader();
  const { mapByNickname } = await readAll();
  const nick = member.displayName || member.user?.username || member.username;
  const username = member.user?.tag || member.tag || member.username;
  const row = [nick, username, value != null ? Number(value) : 0];
  if (mapByNickname.has(nick)) {
    const { rowIndex } = mapByNickname.get(nick);
    const targetRange = `${qSheet}!A${rowIndex}:C${rowIndex}`;
    await sheets.spreadsheets.values.update({ spreadsheetId, range: targetRange, valueInputOption: 'RAW', requestBody: { values: [row] } });
    return { action: 'updated', rowIndex };
  } else {
    await sheets.spreadsheets.values.append({ spreadsheetId, range, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [row] } });
    return { action: 'inserted' };
  }
}

module.exports = {
  ensureHeader,
  readAll,
  upsertUser,
  bulkSyncMembers,
  upsertMemberRecord,
  // for diagnostics
  getAuth,
  verifyGoogleCredentials,
};
