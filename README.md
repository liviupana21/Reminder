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

## Notes
- The panel saves settings to `data/config.json`
- The reminder loop checks every 30 seconds
- The bot needs a valid Discord bot token to actually send reminders
