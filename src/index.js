require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const { bulkSyncMembers, upsertMemberRecord, readAll } = require('./sheets');
const { getPrefix, applyMemberValueRole } = require('./roles');

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'cekincki';
const NOTIFY_ON_CHANGE = String(process.env.NOTIFY_ON_CHANGE || 'true').toLowerCase() !== 'false';
const NOTIFY_MODE = (process.env.NOTIFY_MODE || 'dm').toLowerCase();
const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID;
const NOTIFY_TEMPLATE = process.env.NOTIFY_TEMPLATE || 'Tvoji čekinčki so se posodobili iz {old} na {new}.';

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN in env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.GuildMember],
});

// Track last seen cekinčki values by nickname to log detected sheet changes
const lastValues = new Map(); // nickname -> value

async function syncGuild(guild) {
  try {
    await guild.members.fetch();
    const canManageRoles = guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageRoles);
    if (!canManageRoles) {
      console.warn(`[sync] Missing Manage Roles in guild ${guild.name}`);
      return { updated: 0 };
    }
    console.log(`[sync] Members fetched: ${guild.members.cache.size}`);
    const prefix = getPrefix();

    // Ensure all members exist in sheet
    const members = guild.members.cache
      .filter(m => !m.user.bot)
      .map(m => ({ id: m.id, username: m.user.tag, displayName: m.displayName }));
  const sheetSync = await bulkSyncMembers(members);
  console.log(`[sync] Sheet add missing: inserted ${sheetSync.inserted} of ${sheetSync.totalMembers}`);

    // Read all values and apply roles
    const { mapByNickname } = await readAll();
    let updated = 0;
    // Match by nickname (display name). If duplicates, first match wins.
    for (const member of guild.members.cache.values()) {
      if (member.user.bot) continue;
      const nick = member.displayName || member.user.username;
      const entry = mapByNickname.get(nick);
      if (!entry) continue;
      const prev = lastValues.get(nick);
      if (prev !== undefined && prev !== entry.value) {
        console.log(`[sheet] Value change detected for '${nick}': ${prev} -> ${entry.value}`);
      }
      lastValues.set(nick, entry.value);
      const res = await applyMemberValueRole(member, entry.value, prefix);
      if (res.changed) {
        const removed = res.removedNames && res.removedNames.length ? `, removed [${res.removedNames.join(', ')}]` : '';
        console.log(`[roles] Updated '${nick}': now '${res.targetName}' (value ${entry.value})${removed}`);
        if (NOTIFY_ON_CHANGE && prev !== undefined && prev !== entry.value) {
          await notifyChange(guild, member, nick, prev, entry.value).catch(() => {});
        }
        updated++;
      }
    }
    return { updated };
  } catch (e) {
    const msg = e && e.response && e.response.data ? JSON.stringify(e.response.data) : (e && e.message ? e.message : String(e));
    console.error('[sync] Failed:', msg);
    return { updated: 0, error: e };
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  if (GUILD_ID) {
    const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
    if (guild) {
  console.log(`Connected to guild: ${guild.name}`);
  console.log(`[sync] Target spreadsheet: id=${SPREADSHEET_ID} sheet=${SHEET_NAME}`);
      // Ensure roles exist on startup
      const prefix = getPrefix();
      // Initial sync
      const res = await syncGuild(guild);
      console.log(`[sync] Initial updated members: ${res.updated}`);
      // Schedule periodic sync
      const intervalSec = parseInt(process.env.SYNC_INTERVAL_SECONDS || '300', 10);
      const intervalMs = Number.isFinite(intervalSec) && intervalSec > 0 ? intervalSec * 1000 : 300000;
      setInterval(async () => {
        const r = await syncGuild(guild);
        if (!r.error) console.log(`[sync] Periodic updated members: ${r.updated}`);
      }, intervalMs);
    }
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    // Add to sheet with 0 default and apply lowest tier role
    await upsertMemberRecord(member, 0);
    const prefix = getPrefix();
    await applyMemberValueRole(member, 0, prefix);
  } catch (e) {
    console.warn('Failed to upsert on join:', e.message);
  }
});

// No slash commands; updates happen automatically on a schedule.

client.login(TOKEN);

function formatNotification(guild, member, nick, oldVal, newVal) {
  const tokens = {
    '{nickname}': nick,
    '{old}': String(oldVal),
    '{new}': String(newVal),
    '{guild}': guild.name,
    '{userMention}': `<@${member.id}>`,
  };
  let msg = NOTIFY_TEMPLATE;
  for (const [k, v] of Object.entries(tokens)) msg = msg.split(k).join(v);
  return msg;
}

async function notifyChange(guild, member, nick, oldVal, newVal) {
  const content = formatNotification(guild, member, nick, oldVal, newVal);
  if (NOTIFY_MODE === 'dm' || NOTIFY_MODE === 'both') {
    try {
      await member.send(content);
      console.log(`[notify] DM sent to ${member.user.tag}`);
      if (NOTIFY_MODE === 'dm') return;
    } catch (_) {
      console.log(`[notify] DM failed for ${member.user.tag}`);
    }
  }
  if ((NOTIFY_MODE === 'channel' || NOTIFY_MODE === 'both') && NOTIFY_CHANNEL_ID) {
    try {
      const channel = guild.channels.cache.get(NOTIFY_CHANNEL_ID) || await guild.channels.fetch(NOTIFY_CHANNEL_ID);
      if (channel && channel.isTextBased()) {
        await channel.send({ content: content });
        console.log(`[notify] Channel message sent in #${channel.name || NOTIFY_CHANNEL_ID}`);
      }
    } catch (_) {
      console.log(`[notify] Channel send failed for ${NOTIFY_CHANNEL_ID}`);
    }
  }
}
