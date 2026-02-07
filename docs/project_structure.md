# Project Structure - AnonChatGate

## Directory Layout

```
AnonChatGate/
├── client/                 # Frontend application
│   ├── src/               # Source code
│   │   ├── main.tsx       # Application entry point
│   │   ├── App.tsx        # Main App component
│   │   ├── index.css      # Main styles (Tailwind + custom)
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions
│   ├── index.html         # HTML template
│   └── index.css          # Root-level styles
├── server/                # Backend application
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API routes
│   ├── vite.ts            # Vite middleware setup
│   ├── websocket.ts       # WebSocket handling
│   ├── auth.ts            # Authentication logic
│   ├── storage.ts         # Database operations
│   ├── db.ts              # Database connection
│   ├── logger.ts          # Logging utilities
│   └── telegram-bot.ts    # Telegram bot integration
├── shared/                # Shared code between client/server
│   └── schema.ts          # Database schema & types
├── Docs/                  # Project documentation
│   ├── Bug_tracking.md    # Bug tracking & fixes
│   └── project_structure.md # This file
├── migrations/            # Database migrations
├── uploads/               # User uploaded files
├── .env                   # Environment variables
├── package.json           # Dependencies
├── vite.config.ts         # Vite configuration
└── tsconfig.json          # TypeScript configuration
```

## Key Configuration Files

### vite.config.ts
- Configures Vite bundler for the client application
- Sets up path aliases: `@/`, `@shared/`, `@assets/`
- Defines root as `client/` directory
- **IMPORTANT**: Uses `fileURLToPath(import.meta.url)` pattern for path resolution

### server/index.ts
- Main server entry point
- Initializes Express server
- Sets up Telegram bot
- Configures rate limiting and security
- Default port: 3000 (configurable via PORT env var)

### server/vite.ts
- Integrates Vite dev server with Express in development
- Serves static files in production
- **IMPORTANT**: Uses `fileURLToPath(import.meta.url)` pattern for path resolution

## Running the Project

### Development Mode
```powershell
npm run dev
```
This starts both:
- Express server on port 3000
- Vite dev server (integrated via middleware)

### Production Build
```powershell
npm run build  # Build client and server
npm start      # Start production server
```

## Important Notes

### Path Resolution
- Always use `fileURLToPath(import.meta.url)` for ES modules
- Never use `import.meta.dirname` (not universally supported)
- Pattern:
  ```typescript
  import { fileURLToPath } from "url";
  import path from "path";
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  ```

### Port Configuration
- Default: 3000 (development)
- Production: Use PORT environment variable
- Ngrok should point to the configured port

### File Structure Rules
- Client code must be in `client/` directory
- Server code must be in `server/` directory
- Shared types/schemas go in `shared/` directory
- Never import server code into client (security risk)
