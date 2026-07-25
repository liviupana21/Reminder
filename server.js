const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const dotenv = require('dotenv');
const { Client, GatewayIntentBits, Events } = require('discord.js');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const configPath = path.join(__dirname, 'data', 'config.json');
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function createReminder(overrides = {}) {
  return {
    id: overrides.id || randomUUID(),
    enabled: overrides.enabled !== false,
    channelId: overrides.channelId || '',
    roleId: overrides.roleId || '',
    reminderTime: overrides.reminderTime || '09:00',
    repeatIntervalMinutes: Number(overrides.repeatIntervalMinutes) || 0,
    message: overrides.message || 'Reminder time!'
  };
}

function readConfig() {
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ reminders: [createReminder()] }, null, 2));
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

function startReminderLoop() {
  setInterval(() => {
    const config = readConfig();
    const reminders = config.reminders || [];

    reminders.forEach((reminder) => {
      if (!reminder.enabled || !reminder.reminderTime) return;

      const [hours, minutes] = reminder.reminderTime.split(':').map(Number);
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const targetMinutes = hours * 60 + minutes;

      if (nowMinutes === targetMinutes) {
        sendReminder(reminder).catch(console.error);
        const repeatMinutes = Number(reminder.repeatIntervalMinutes);
        if (repeatMinutes > 0) {
          setTimeout(() => sendReminder(reminder).catch(console.error), repeatMinutes * 60 * 1000);
        }
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
  res.json(readConfig());
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

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
  startReminderLoop();
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }
});

if (process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN !== 'your_discord_bot_token_here') {
  client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error('Discord login failed:', error.message);
  });
} else {
  console.log('Discord token not configured. The web panel will still run, but the bot will not send messages until you set DISCORD_TOKEN in the .env file.');
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Web panel listening on http://0.0.0.0:${port}`);
});
