require('dotenv').config();
const { verifyGoogleCredentials } = require('./sheets');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

(async () => {
  const info = verifyGoogleCredentials();
  console.log('[check-google] credentials source:', info.source);
  if (info.path) console.log('[check-google] path:', info.path);
  console.log('[check-google] has client_email:', info.hasClientEmail);
  console.log('[check-google] has private_key:', info.hasPrivateKey);
  try {
    // Build credentials explicitly from file or inline
    let creds;
    if (info.source === 'file') {
      const p = info.path;
      creds = JSON.parse(fs.readFileSync(p, 'utf8'));
    } else if (info.source === 'inline') {
      creds = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
    } else {
      throw new Error('No credentials found.');
    }
    console.log('[check-google] service account email:', creds.client_email || '(missing)');
    if (typeof creds.private_key === 'string' && creds.private_key.includes('\\n')) {
      creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }
    const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const client = await auth.getClient();
    // Try fetching a token
    const token = await client.getAccessToken();
    if (!token || !token.token) throw new Error('No access token returned');
    console.log('[check-google] Auth success: received access token.');
  } catch (e) {
    console.error('[check-google] Auth failed:', e && e.message ? e.message : e);
    process.exitCode = 1;
  }
})();
