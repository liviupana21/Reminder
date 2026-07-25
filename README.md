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
3. Fill in your Discord bot token
4. Start the app with `npm start`
5. Open `http://localhost:3000`

## Live hosting (free)
The project is ready to deploy to Render for free.

1. Push this project to GitHub.
2. Create a free Render account.
3. Click New > Web Service.
4. Connect your GitHub repository.
5. Render will detect the `render.yaml` file and deploy automatically.
6. Add these environment variables in Render:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `PORT=10000`

## Notes
- The panel saves settings to `data/config.json`
- The reminder loop checks every 30 seconds
- The bot needs a valid Discord bot token to actually send reminders
- For this version, the bot uses the minimal `Guilds` intent, which is the safest choice for a reminder bot
