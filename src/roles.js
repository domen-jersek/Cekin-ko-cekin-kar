const { PermissionsBitField } = require('discord.js');

function getTiers() {
  const raw = process.env.CEKINCKI_TIERS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(t => typeof t.min === 'number' && typeof t.name === 'string')) {
        return [...parsed].sort((a, b) => a.min - b.min);
      }
    } catch (_) { /* ignore, fall back */ }
  }
  // Default tiers
  return [
    { min: 0, name: 'Novice' },
    { min: 10, name: 'Bronze' },
    { min: 50, name: 'Silver' },
    { min: 100, name: 'Gold' },
    { min: 500, name: 'Platinum' },
  ];
}

function getPrefix() {
  return process.env.CEKINCKI_ROLE_PREFIX || 'Cekinčki:';
}

function roleNameForTier(prefix, tierName) {
  return `${prefix} ${tierName}`;
}

function getTierForValue(value, tiers) {
  let chosen = tiers[0];
  for (const t of tiers) {
    if (value >= t.min) chosen = t; else break;
  }
  return chosen;
}

async function ensureRoles(guild, tiers, prefix) {
  const existing = await guild.roles.fetch();
  const result = new Map(); // name -> role
  for (const t of tiers) {
    const name = roleNameForTier(prefix, t.name);
    let role = existing.find(r => r && r.name === name);
    if (!role) {
      // Create role underneath bot's highest role if possible (position handled by Discord)
      role = await guild.roles.create({
        name,
        mentionable: false,
        hoist: false,
        reason: 'Ensure cekinčki tier role exists',
      }).catch(() => null);
    }
    if (role) result.set(name, role);
  }
  return result;
}

function botCanManageRoles(guild) {
  return guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageRoles);
}

async function applyMemberTierRole(member, value, tiers, prefix, roleMap) {
  const guild = member.guild;
  if (!botCanManageRoles(guild)) return { changed: false, reason: 'missing-permission' };

  // Determine target role
  const tier = getTierForValue(Number(value) || 0, tiers);
  const targetName = roleNameForTier(prefix, tier.name);
  const targetRole = roleMap.get(targetName);
  if (!targetRole) return { changed: false, reason: 'target-role-missing', targetName };

  // Determine roles to remove (any prefixed role not equal to target)
  const current = member.roles.cache;
  const toRemove = current.filter(r => r.name.startsWith(prefix + ' ') && r.id !== targetRole.id);
  const removedNames = [];

  let changed = false;
  if (!current.has(targetRole.id)) {
    await member.roles.add(targetRole).catch(() => {});
    changed = true;
  }
  for (const r of toRemove.values()) {
    await member.roles.remove(r).catch(() => {});
    removedNames.push(r.name);
    changed = true;
  }
  return { changed, targetName, added: !current.has(targetRole.id), removedNames };
}

module.exports = {
  getTiers,
  getPrefix,
  ensureRoles,
  applyMemberTierRole,
  getTierForValue,
};

// --- Numeric (exact value) role utilities ---

function valueRoleName(prefix, value) {
  return `${prefix} ${Number(value) || 0}`;
}

async function ensureValueRole(guild, roleName) {
  const existing = await guild.roles.fetch();
  let role = existing.find(r => r && r.name === roleName);
  if (!role) {
    role = await guild.roles.create({
      name: roleName,
      mentionable: false,
      hoist: false,
      reason: 'Ensure cekinčki numeric role exists',
    }).catch(() => null);
  }
  return role;
}

async function applyMemberValueRole(member, value, prefix) {
  const guild = member.guild;
  if (!botCanManageRoles(guild)) return { changed: false, reason: 'missing-permission' };
  const targetName = valueRoleName(prefix, value);
  const targetRole = await ensureValueRole(guild, targetName);
  if (!targetRole) return { changed: false, reason: 'target-role-missing', targetName };

  const current = member.roles.cache;
  const toRemove = current.filter(r => r.name.startsWith(prefix + ' ') && r.id !== targetRole.id);
  const removedNames = [];
  let changed = false;
  const hadTarget = current.has(targetRole.id);
  if (!hadTarget) {
    await member.roles.add(targetRole).catch(() => {});
    changed = true;
  }
  for (const r of toRemove.values()) {
    await member.roles.remove(r).catch(() => {});
    removedNames.push(r.name);
    changed = true;
  }
  return { changed, targetName, added: !hadTarget, removedNames };
}

module.exports.applyMemberValueRole = applyMemberValueRole;
module.exports.valueRoleName = valueRoleName;
module.exports.ensureValueRole = ensureValueRole;
