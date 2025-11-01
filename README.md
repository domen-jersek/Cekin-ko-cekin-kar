# cekinčko_cekinčkar – Discord + Google Sheets Bot

A Discord bot that syncs server members to a Google Sheet and manages a per-user integer value called "cekinčki" by assigning a tiered Discord role.

What it does automatically:

- Ensures tier roles exist in your server
- Adds any missing members to the sheet with value 0
- Periodically reads the sheet and updates members' cekinčki roles

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

The permissions value `268435456` includes Manage Roles; adjust as needed.

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
GCP_CREDENTIALS_PATH=c:\\Users\\<you>\\secrets\\cekincki-service-account.json
# Optional: role tiers and prefix (JSON)
# CEKINCKI_TIERS=[{"min":0,"name":"Novice"},{"min":10,"name":"Bronze"},{"min":50,"name":"Silver"},{"min":100,"name":"Gold"},{"min":500,"name":"Platinum"}]
CEKINCKI_ROLE_PREFIX=cekinčki
SYNC_INTERVAL_SECONDS=300
```

On Windows PowerShell, escape backslashes as shown.

### 4) Install deps and run the bot

```powershell
npm install
npm start
```

The bot logs in and will automatically:

- Create missing cekinčki roles from your tiers
- Add missing members to the sheet with value 0
- Sync member roles from the sheet on startup and every SYNC_INTERVAL_SECONDS

## How it works

- The sheet uses three columns: `user_id`, `username`, `cekincki` (header row ensured on first run).
- On member join, the bot upserts the user into the sheet with a default value `0`, and assigns the appropriate cekinčki tier role.
- The bot only updates roles if it has the "Manage Roles" permission and its highest role is above the target roles and members.

## Troubleshooting

- Ensure the Service Account email has Editor access to the sheet.
- Check that `GCP_CREDENTIALS_PATH` points to a valid JSON file.
- Make sure `SERVER MEMBERS INTENT` is enabled in the Discord Developer Portal.
- If role changes fail, check the bot has a role above the cekinčki roles and members, and the Manage Roles permission.

## Security notes

- Never commit your `.env` or Service Account JSON.
- Use a separate Google project and Discord application for testing.

## Next steps (optional)

- Add a small dashboard or optional command for manual sync
- Customize tiers with colors/hoist settings
- Add a "leaderboard" (web or message) to show top cekinčki
