require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;
  if (!token || !clientId || !guildId) {
    throw new Error('DISCORD_TOKEN, CLIENT_ID, and GUILD_ID must be set');
  }
  const rest = new REST({ version: '10' }).setToken(token);
  const body = commands.map(c => c.toJSON());
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  console.log(`Registered ${body.length} command(s) for guild ${guildId}`);
}

main().catch(err => {
  console.error('Failed to register commands:', err);
  process.exitCode = 1;
});
