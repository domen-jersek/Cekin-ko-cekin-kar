const { SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('sync_sheet').setDescription('Add all server members to the Google Sheet (no duplicates).'),
  new SlashCommandBuilder()
    .setName('set_cekincki')
    .setDescription('Set cekinčki value for a user and update their cekinčki role')
    .addUserOption(opt => opt.setName('user').setDescription('User to set').setRequired(true))
    .addIntegerOption(opt => opt.setName('value').setDescription('Integer value').setRequired(true)),
  new SlashCommandBuilder().setName('update_roles').setDescription('Update all member cekinčki roles from the Sheet'),
];

module.exports = { commands };
