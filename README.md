# Adaptive UI Research Portal

This project provides a full-stack telemetry and adaptation research tool.

## Prerequisites
- Node.js LTS
- Firebase CLI installed globally
- Firebase Project configured with Auth (Anonymous), Firestore, and Cloud Functions enabled

## Setup
1. Clone the repository.
2. In `web`, run `npm install`.
3. In `functions`, run `npm install`.
4. Update `web/.env.local` with your Firebase config:
```
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
...
```

## Running
### Frontend
```
cd web
npm run dev
```

### Emulators
```
firebase emulators:start
```

### Deployment
```
firebase deploy
```

## Tuning Configuration
- The IFI weights are located in `web/src/utils/config.ts` (client) and `functions/src/index.ts` (server).
- Game timings, batch sizes, and thresholds are in `web/src/utils/config.ts`.
