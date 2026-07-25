# Discord Reminder Bot

A simple Discord reminder bot with a web-based control panel.

## Features
- Configure the target channel
- Configure a role mention
- Set a reminder time
- Optionally repeat every X minutes
- Edit the reminder message

## Setup
1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env`
3. Fill in your Discord bot token and other required values
4. Start the app with `npm start`
5. Open `http://localhost:3000`

## WispByte deployment
This project is already compatible with WispByte because it uses a standard Node.js entry point and a `package.json` start script.

1. Push this project to GitHub.
2. Create a WispByte account and create a new app/project from the repository.
3. Choose the Node.js runtime.
4. Set the start command to:
   - `npm start`
5. Add these environment variables in WispByte:
   - `BOT_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID`
   - `PORT=3000`
   - `REMINDER_TIME_ZONE=Europe/Bucharest`
   - `REMINDER_LOOKAHEAD_MINUTES=5`

## Live hosting (free)
The project is also ready for Render, but WispByte is the better fit if you want a free 24/7 option for this bot.

## Notes
- The panel saves settings to `data/config.json`
- The reminder loop checks every 30 seconds
- The bot needs a valid Discord bot token to actually send reminders
- For this version, the bot uses the minimal `Guilds` intent, which is the safest choice for a reminder bot
