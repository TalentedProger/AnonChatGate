# AguGram - Quick Start Guide

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **ngrok** - `npm install -g ngrok` or download from [ngrok.com](https://ngrok.com/)
3. **PostgreSQL database** (Neon recommended for development)
4. **Telegram Bot Token** - Get from [@BotFather](https://t.me/BotFather)

## Setup

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd AnonChatGate
npm install
```

### 2. Create `.env` file

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DATABASE_URL=postgresql://user:password@host/database
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
TELEGRAM_BOT_TOKEN=<your-bot-token-from-botfather>
WEBAPP_URL=<your-ngrok-url>
NODE_ENV=development
PORT=3000
```

### 3. Initialize database

```bash
npm run db:push
```

## Running Locally

### Step 1: Start ngrok (in separate terminal)

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc-xyz.ngrok-free.dev`)

### Step 2: Update WEBAPP_URL

Edit `.env` and set:
```env
WEBAPP_URL=https://abc-xyz.ngrok-free.dev
```

### Step 3: Start the server

```bash
npm run dev
```

### Step 4: Test in Telegram

1. Open your bot in Telegram
2. Send `/start`
3. Click "Open App" button

## Diagnostic Tools

### Check configuration

```powershell
.\diagnose.ps1
```

### Common issues

| Issue | Solution |
|-------|----------|
| `ENOTFOUND api.telegram.org` | Enable VPN or check internet connection |
| `EADDRINUSE: port 3000` | Stop other Node processes: `Get-Process node \| Stop-Process -Force` |
| `409 Conflict` | Another bot instance running - stop it first |
| App loading forever | Check ngrok is running and WEBAPP_URL matches |

## Project Structure

```
AnonChatGate/
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and schema
├── migrations/      # Database migrations
├── docs/            # Documentation
└── *.md             # Various documentation files
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run test` | Run tests |
| `npm run db:push` | Push schema to database |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT tokens (min 32 chars) |
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `WEBAPP_URL` | Yes | Public HTTPS URL (ngrok in dev) |
| `NODE_ENV` | No | `development` or `production` |
| `PORT` | No | Server port (default: 3000) |

## Troubleshooting

### Server won't start

1. Run `.\diagnose.ps1` to check configuration
2. Ensure no other Node processes are running
3. Verify `.env` file exists and has correct values

### Bot not responding

1. Check VPN is enabled (if in restricted region)
2. Verify `TELEGRAM_BOT_TOKEN` is correct
3. Make sure only one bot instance is running

### Mini App not loading

1. Verify ngrok is running
2. Check `WEBAPP_URL` matches current ngrok URL
3. Clear browser/Telegram cache
4. Try opening URL directly in browser first

## Support

- Check `docs/` folder for detailed documentation
- See `PROJECT_AUDIT_AND_TASKS.md` for known issues
- Review `LOCAL_DEV_GUIDE.md` for detailed setup instructions
