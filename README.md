# cekinčko_cekinčkar – Discord + Google Sheets Bot

A Discord bot that keeps a per-user integer called "cekinčki" in a Google Sheet and mirrors it in Discord by assigning a numeric role with the exact value.

What it does automatically:

- Adds any missing members to the sheet with value 0
- Periodically reads the sheet and updates members' cekinčki roles
- Creates missing numeric roles on demand (e.g., "Cekinčki: 9") and removes outdated ones with the same prefix
- Sends optional notifications when a user's value changes

## Requirements

- Node.js 18+ (for discord.js v14)
- A Discord Application/Bot and a test server (guild)
- Google Cloud project with a Service Account and Sheets API enabled
- A Google Sheet shared with the Service Account email

## Setup

### 1) Discord: Create a bot and invite it

1. Go to https://discord.com/developers/applications and create an application.
2. Add a Bot user under "Bot".
3. Copy the bot token and put it in your `.env` as `DISCORD_TOKEN`.
4. Under "Bot" → Privileged Gateway Intents, enable:
   - SERVER MEMBERS INTENT (members)
5. Invite the bot to your server with permissions that include:
   - Manage Roles (to assign cekinčki roles)
   - Read Messages/View Channels (implicit via Guilds intent)

An example invite URL (replace CLIENT_ID) with Manage Roles:
`https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=268435456&scope=bot`

### 2) Google: Service Account + Sheets

1. In Google Cloud Console, create a project and enable the "Google Sheets API".
2. Create a Service Account and generate a JSON key.
3. Download the JSON key and save it locally; for example:
   `c:\\Users\\<you>\\secrets\\cekincki-service-account.json`
4. Open your target Google Sheet and share it (Editor) with the Service Account email (ends with `iam.gserviceaccount.com`).
5. Copy the Sheet ID from the URL, e.g. `https://docs.google.com/spreadsheets/d/<THIS_PART_IS_ID>/edit`.

### 3) Configure environment

Copy `.env.example` to `.env` and fill in values:

```
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-id
GUILD_ID=your-test-guild-id
SPREADSHEET_ID=your-google-sheet-id
SHEET_NAME=cekincki

# Google credentials – prefer inline JSON in production
# GCP_CREDENTIALS_PATH=c:\\Users\\<you>\\secrets\\cekincki-service-account.json
# or
# GCP_CREDENTIALS_JSON={...full service account json...}

# Role name prefix – roles will look like "Cekinčki: 9"
CEKINCKI_ROLE_PREFIX=Cekinčki:

# Auto sync interval in seconds
SYNC_INTERVAL_SECONDS=300

# Notifications on change
NOTIFY_ON_CHANGE=true
# dm | channel | both
NOTIFY_MODE=dm
# Required if NOTIFY_MODE is channel or both
NOTIFY_CHANNEL_ID=
# Tokens: {nickname} {old} {new} {guild} {userMention}
NOTIFY_TEMPLATE=Tvoji čekinčki so se posodobili iz {old} na {new}.
```

On Windows PowerShell, escape backslashes as shown.

### 4) Install deps and run the bot

```powershell
npm install
npm start
```

The bot logs in and will automatically:

- Add missing members to the sheet with value 0
- Read the sheet and assign an exact-value role with your prefix (e.g., "Cekinčki: 12")
- Remove any other cekinčki roles with the same prefix from that member
- Repeat the sync every SYNC_INTERVAL_SECONDS

## Deploying for free (or nearly free)

Below are practical options to run the bot in the cloud. Free tiers change over time; check provider pricing.

### Option A: Fly.io (small free allowance; may require card)

This repo includes a `Dockerfile` and `fly.toml`.

1. Install Fly CLI and login
   - https://fly.io/docs/hands-on/install-flyctl/
   - fly auth signup; fly auth login
2. Create an app and launch
   - Edit `fly.toml` → set `app = "your-app-name"` and `primary_region` close to you.
   - From repo root:
     ```powershell
     fly launch --no-deploy
     ```
3. Set secrets (use JSON for Google credentials)
     ```powershell
     fly secrets set DISCORD_TOKEN=... GUILD_ID=... SPREADSHEET_ID=... SHEET_NAME=cekincki CEKINCKI_ROLE_PREFIX="Cekinčki:" SYNC_INTERVAL_SECONDS=300 NOTIFY_ON_CHANGE=true NOTIFY_MODE=dm
     # Paste your service account JSON literally; PowerShell tip: enclose in single quotes
     fly secrets set GCP_CREDENTIALS_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@...iam.gserviceaccount.com","client_id":"...","token_uri":"https://oauth2.googleapis.com/token"}'
     ```
4. Deploy
   ```powershell
   fly deploy
   ```
5. Verify logs
   ```powershell
   fly logs
   ```

Notes
- Fly Machines run continuously; free allowances are limited. You can stop machines when not needed.
- Ensure your Google Sheet is shared with the service account email as Editor.

### Option B: Koyeb (free tier subject to change)

Koyeb can build from your GitHub repo with the provided `Dockerfile`.

1. Push this repo to GitHub.
2. Create a new Koyeb Service from GitHub, pick this repository.
3. Set environment variables in the dashboard (same as above) and include `GCP_CREDENTIALS_JSON`.
4. Deploy; check logs.

### Option C: Your own machine (free)

Run on a home server/PC with Node.js and keep it alive using a process manager.

```powershell
npm install -g pm2
pm2 start npm --name cekincki-bot -- start
pm2 save
pm2 startup  # generate and run the command it prints to auto-start on boot
```

Security tip: never commit `.env` or your service account JSON. Use secrets in your platform.

## How it works

- The sheet uses three columns: `Server ime` (nickname), `Dejansko ime` (username), `Cekincki`.
  - The header is enforced on first run and basic formatting is applied (frozen header, number format for the value, auto-resize columns).
- On member join, the bot upserts the user into the sheet with a default value `0`, and assigns the role with exact value (e.g., "Cekinčki: 0").
- On each sync, it maps members by their server display name (nickname). If multiple members share the same nickname, the first match wins.
- The bot only updates roles if it has the "Manage Roles" permission and its highest role is above the target roles and members.

## Troubleshooting

- Ensure the Service Account email has Editor access to the sheet.
- Use `GCP_CREDENTIALS_JSON` in production deployments to avoid mounting files; if using a path locally, verify the path and that the JSON includes `client_email` and `private_key`.
- Make sure `SERVER MEMBERS INTENT` is enabled in the Discord Developer Portal.
- If role changes fail, check the bot has a role above the cekinčki roles and members, and the Manage Roles permission.
- If you see "Unable to parse range", confirm the tab (sheet) name matches `SHEET_NAME`; the code quotes names and auto-creates missing tabs.

## Next steps (optional)

- Prune unused numeric roles (cleanup script)
- Add a small dashboard or optional command for manual sync
- Add a "leaderboard" (web or message) to show top cekinčki
