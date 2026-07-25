const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const dotenv = require('dotenv');
const { Client, GatewayIntentBits, Events, Partials } = require('discord.js');
const { shouldSendReminder: shouldSendReminderAtTime, buildReactionRoleMessageText } = require('./reminder-utils');

const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath, override: true });

const app = express();
const port = Number(process.env.PORT || 3000);
const configPath = path.join(__dirname, 'data', 'config.json');
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildMembers],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function createReminder(overrides = {}) {
  return {
    id: overrides.id || randomUUID(),
    type: overrides.type || '',
    enabled: overrides.enabled !== false,
    channelId: overrides.channelId || '',
    roleId: overrides.roleId || '',
    reminderTime: overrides.reminderTime || '09:00',
    repeatIntervalMinutes: overrides.repeatIntervalMinutes != null ? Number(overrides.repeatIntervalMinutes) : 0,
    message: overrides.message || 'Reminder time!'
  };
}

function getReminderSchedule(reminder, now = new Date()) {
  if (reminder.type === 'world-boss') {
    const day = now.getDay();
    const weekend = day === 0 || day === 6;
    return weekend ? [10 * 60, 18 * 60, 22 * 60] : [10 * 60, 22 * 60];
  }

  if (reminder.type === 'elite-boss') {
    return [1 * 60, 5 * 60, 9 * 60, 13 * 60, 17 * 60, 21 * 60, 25 * 60];
  }

  if (reminder.type === 'map-boss') {
    return [0, 2 * 60, 4 * 60, 6 * 60, 8 * 60, 10 * 60, 12 * 60, 14 * 60, 16 * 60, 18 * 60, 20 * 60, 22 * 60];
  }

  return [];
}

function shouldSendReminder(reminder, now = new Date()) {
  return shouldSendReminderAtTime(reminder, now, process.env.REMINDER_TIME_ZONE || 'Europe/Bucharest', Number(process.env.REMINDER_LOOKAHEAD_MINUTES || 5));
}

function readConfig() {
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({
      reminders: [
        createReminder({ id: 'world-boss', type: 'world-boss', enabled: true, channelId: '1530601219872129134', roleId: '1530604998805684399', reminderTime: '09:55', repeatIntervalMinutes: 10, message: 'World Boss is spawning in 5 minutes' }),
        createReminder({ id: 'elite-boss', type: 'elite-boss', enabled: true, channelId: '1530601219872129134', roleId: '1530611582332047391', reminderTime: '00:55', repeatIntervalMinutes: 10, message: 'Elite Bosses will be spawned in 5 minutes' }),
        createReminder({ id: 'map-boss', type: 'map-boss', enabled: true, channelId: '1530604998805684399', roleId: '1530611664745922730', reminderTime: '23:55', repeatIntervalMinutes: 10, message: 'Map Bosses (2hrs bosses) will be spawned in 5 minutes' })
      ],
      reactionRoleMessage: {
        channelId: '1528095638955233350',
        messageId: '',
        enabled: false,
        reactions: [
          { emoji: '🎯', roleId: '1530604998805684399' },
          { emoji: '⚔️', roleId: '1530611582332047391' },
          { emoji: '🗺️', roleId: '1530611664745922730' }
        ]
      }
    }, null, 2));
  }

  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!Array.isArray(parsed.reminders)) {
    const migrated = [createReminder({
      channelId: parsed.channelId || '',
      roleId: parsed.roleId || '',
      reminderTime: parsed.reminderTime || '09:00',
      repeatIntervalMinutes: parsed.repeatIntervalMinutes || 0,
      message: parsed.message || 'Reminder time!'
    })];
    parsed.reminders = migrated;
  }

  parsed.reminders = parsed.reminders.map((item) => createReminder(item));
  return parsed;
}

function writeConfig(data) {
  const config = { ...data };
  config.reminders = Array.isArray(config.reminders)
    ? config.reminders.map((item) => createReminder(item))
    : [createReminder()];
  if (!config.reactionRoleMessage) {
    config.reactionRoleMessage = {
      channelId: '1528095638955233350',
      messageId: '',
      enabled: false,
      reactions: [
        { emoji: '🎯', roleId: '1530604998805684399' },
        { emoji: '⚔️', roleId: '1530611582332047391' },
        { emoji: '🗺️', roleId: '1530611664745922730' }
      ]
    };
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

async function sendReminder(reminder) {
  if (!reminder.enabled || !reminder.channelId) return;

  let channel = client.channels.cache.get(reminder.channelId);
  if (!channel) {
    channel = await client.channels.fetch(reminder.channelId).catch(() => null);
  }

  if (!channel || !channel.isTextBased()) return;

  let content = reminder.message || 'Reminder time!';
  if (reminder.roleId) {
    content = `<@&${reminder.roleId}> ${content}`;
  }

  await channel.send(content).catch(console.error);
}

function normalizeEmoji(emoji) {
  if (!emoji) return '';
  if (typeof emoji === 'string') return emoji;
  return emoji.name || emoji.toString();
}

async function sendReactionRoleMessage(reactionConfigOverride = null) {
  const config = readConfig();
  const baseReactionConfig = config.reactionRoleMessage || {};
  const reactionConfig = {
    ...baseReactionConfig,
    ...(reactionConfigOverride || {})
  };

  if (!reactionConfig.channelId) {
    return { sent: false, reason: 'No channel ID was provided.' };
  }

  let channel = client.channels.cache.get(reactionConfig.channelId);
  if (!channel) {
    channel = await client.channels.fetch(reactionConfig.channelId).catch(() => null);
  }

  if (!channel) {
    return { sent: false, reason: `Could not find a channel with ID ${reactionConfig.channelId}.` };
  }

  if (!channel.isTextBased()) {
    return { sent: false, reason: `Channel ${reactionConfig.channelId} is not a text channel.` };
  }

  const messageText = buildReactionRoleMessageText(reactionConfig);
  console.log('[reaction-role] sending to channel', reactionConfig.channelId, ':', messageText);
  const sent = await channel.send(messageText).catch((error) => ({ error }));
  if (sent && sent.id) {
    reactionConfig.messageId = sent.id;
    reactionConfig.guildId = channel.guildId || reactionConfig.guildId || '';
    reactionConfig.enabled = true;
    config.reactionRoleMessage = reactionConfig;
    writeConfig(config);
    for (const item of reactionConfig.reactions || []) {
      await sent.react(item.emoji).catch(() => null);
    }
    return { sent: true, messageId: sent.id, reason: 'Message sent successfully.', messageText };
  }

  const errorMessage = sent && sent.error ? sent.error.message : 'Unknown error.';
  return { sent: false, reason: `Could not send the message. Discord returned: ${errorMessage}` };
}

async function handleReaction(role, userId, emojiName, guildId) {
  const config = readConfig();
  const reactionConfig = config.reactionRoleMessage || {};
  const reactionEntry = (reactionConfig.reactions || []).find((item) => normalizeEmoji(item.emoji) === emojiName);
  if (!reactionEntry || !reactionEntry.roleId) return;

  const guild = guildId ? await client.guilds.fetch(guildId).catch(() => null) : null;
  const targetGuild = guild || (reactionConfig.guildId ? await client.guilds.fetch(reactionConfig.guildId).catch(() => null) : null) || (await client.guilds.fetch()).first();
  if (!targetGuild) return;

  const member = await targetGuild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const roleToAssign = await targetGuild.roles.fetch(reactionEntry.roleId).catch(() => null);
  if (!roleToAssign) return;

  if (role) {
    await member.roles.add(roleToAssign).catch((error) => console.error('[reaction-role] failed to add role', error));
  } else {
    await member.roles.remove(roleToAssign).catch((error) => console.error('[reaction-role] failed to remove role', error));
  }
}

function messageMatchesReactionRoleConfig(message, reactionConfig) {
  const expected = (reactionConfig.reactions || []).map((item) => normalizeEmoji(item.emoji));
  if (!expected.length) return false;

  const present = new Set(message.reactions.cache.map((r) => normalizeEmoji(r.emoji)));
  return expected.every((emoji) => present.has(emoji));
}

async function reconcileReactionRoleMessage(message) {
  if (!client.user || message.author.id !== client.user.id) return;

  const config = readConfig();
  const reactionConfig = config.reactionRoleMessage || {};
  if (!reactionConfig.channelId || message.channelId !== reactionConfig.channelId) return;
  if (!messageMatchesReactionRoleConfig(message, reactionConfig)) return;

  if (reactionConfig.messageId !== message.id) {
    reactionConfig.messageId = message.id;
    reactionConfig.guildId = message.guildId || reactionConfig.guildId || '';
    reactionConfig.enabled = true;
    config.reactionRoleMessage = reactionConfig;
    writeConfig(config);
    console.log('[reaction-role] adopted existing message', message.id, 'as the tracked reaction-role message');
  }

  for (const item of reactionConfig.reactions || []) {
    const messageReaction = message.reactions.cache.find((r) => normalizeEmoji(r.emoji) === normalizeEmoji(item.emoji));
    if (!messageReaction) continue;

    const reactors = await messageReaction.users.fetch().catch(() => null);
    if (!reactors) continue;

    for (const reactor of reactors.values()) {
      if (reactor.bot) continue;
      await handleReaction(true, reactor.id, normalizeEmoji(item.emoji), message.guildId);
    }
  }
}

async function scanReactionRoleChannel() {
  const config = readConfig();
  const reactionConfig = config.reactionRoleMessage || {};
  if (!reactionConfig.channelId) return;

  let channel = client.channels.cache.get(reactionConfig.channelId);
  if (!channel) {
    channel = await client.channels.fetch(reactionConfig.channelId).catch(() => null);
  }
  if (!channel || !channel.isTextBased()) return;

  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (!messages) return;

  for (const message of messages.values()) {
    if (message.author.id !== client.user.id) continue;
    await reconcileReactionRoleMessage(message).catch((error) => console.error('[reaction-role] reconcile failed', error));
  }
}

function startReminderLoop() {
  setInterval(() => {
    const config = readConfig();
    const reminders = config.reminders || [];
    const now = new Date();

    reminders.forEach((reminder) => {
      if (!reminder.enabled || !reminder.reminderTime) return;

      if (shouldSendReminder(reminder, now)) {
        sendReminder(reminder).catch(console.error);
      }
    });
  }, 30000);
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'discord-reminder-bot' });
});

app.get('/config', (req, res) => {
  const config = readConfig();
  res.json(config);
});

app.post('/reaction-role/send', async (req, res) => {
  const result = await sendReactionRoleMessage(req.body || {});
  res.json({
    ...result,
    config: readConfig()
  });
});

app.delete('/reaction-role/delete', async (req, res) => {
  const config = readConfig();
  const reactionConfig = config.reactionRoleMessage || {};
  const messageId = reactionConfig.messageId;
  if (!messageId) {
    return res.json({ deleted: false, reason: 'No reaction message has been sent yet.', config: readConfig() });
  }

  let channel = client.channels.cache.get(reactionConfig.channelId);
  if (!channel) {
    channel = await client.channels.fetch(reactionConfig.channelId).catch(() => null);
  }

  if (!channel || !channel.isTextBased()) {
    return res.json({ deleted: false, reason: 'The configured channel could not be found.', config: readConfig() });
  }

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    reactionConfig.messageId = '';
    config.reactionRoleMessage = reactionConfig;
    writeConfig(config);
    return res.json({ deleted: true, reason: 'Reaction message was already missing.', config: readConfig() });
  }

  await message.delete().catch((error) => console.error('[reaction-role] failed to delete message', error));
  reactionConfig.messageId = '';
  config.reactionRoleMessage = reactionConfig;
  writeConfig(config);
  return res.json({ deleted: true, config: readConfig() });
});

app.get('/guilds', async (req, res) => {
  if (!client.isReady()) {
    return res.json({ guilds: [] });
  }

  try {
    const guilds = client.guilds.cache.map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ dynamic: true }) || null
    }));
    res.json({ guilds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/config', (req, res) => {
  const currentConfig = readConfig();
  const payload = req.body || {};
  const reminders = Array.isArray(payload.reminders) && payload.reminders.length
    ? payload.reminders.map((item) => createReminder(item))
    : [createReminder()];

  const newConfig = {
    ...currentConfig,
    ...payload,
    reminders
  };

  writeConfig(newConfig);
  res.json(newConfig);
});

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  startReminderLoop();
  await scanReactionRoleChannel().catch((error) => console.error('[reaction-role] startup scan failed', error));
});

client.on(Events.MessageCreate, async (message) => {
  if (!client.user || message.author.id !== client.user.id) return;
  await reconcileReactionRoleMessage(message).catch((error) => console.error('[reaction-role] reconcile failed', error));
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    reaction = await reaction.fetch().catch(() => null);
    if (!reaction) return;
  }

  let message = reaction.message;
  if (message.partial) {
    message = await message.fetch().catch(() => null);
    if (!message) return;
  }

  const config = readConfig();
  const reactionConfig = config.reactionRoleMessage || {};
  const emojiName = normalizeEmoji(reaction.emoji);

  if (reactionConfig.messageId && message.id === reactionConfig.messageId) {
    await handleReaction(true, user.id, emojiName, message.guildId);
    return;
  }

  if (client.user && message.author.id === client.user.id && message.channelId === reactionConfig.channelId) {
    await reconcileReactionRoleMessage(message).catch((error) => console.error('[reaction-role] reconcile failed', error));
  }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;
  const config = readConfig();
  const reactionConfig = config.reactionRoleMessage || {};
  const messageId = reactionConfig.messageId;
  if (!messageId || reaction.message.id !== messageId) return;
  const emojiName = normalizeEmoji(reaction.emoji);
  await handleReaction(false, user.id, emojiName, reaction.message.guildId);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }
});

const hasToken = Boolean(process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN !== 'your_discord_bot_token_here');
const hasClientId = Boolean(process.env.CLIENT_ID && process.env.CLIENT_ID !== 'your_discord_client_id_here');

console.log(`Env check: token=${hasToken ? 'present' : 'missing'}, clientId=${hasClientId ? 'present' : 'missing'}`);

if (hasToken) {
  client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error('Discord login failed:', error.message);
  });
} else {
  console.log('Discord token not configured. The web panel will still run, but the bot will not send messages until you set DISCORD_TOKEN in the .env file.');
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Web panel listening on http://0.0.0.0:${port}`);
});
