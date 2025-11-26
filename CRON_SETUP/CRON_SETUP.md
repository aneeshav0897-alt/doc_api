# AWS API Gateway Cron Job Integration

This project now includes a weekly cron job that fetches the latest OpenAPI spec from AWS API Gateway, **compares it with the last saved version**, and **only saves it if there are changes**.

## Setup

### 1. Install dependencies
```bash
npm install express node-cron node-fetch nodemon
```

### 2. Configure AWS credentials

Set the following environment variables:

```bash
export AWS_REGION=us-east-1              # Your AWS region
export AWS_API_ID=your-api-id            # Your API Gateway REST API ID
export AWS_ACCESS_KEY_ID=your-key-id     # AWS access key
export AWS_SECRET_ACCESS_KEY=your-secret # AWS secret key
```

Or create a `.env` file in the project root:
```
AWS_REGION=us-east-1
AWS_API_ID=your-api-id
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret
```

### 3. Start the cron server

```bash
npm run server        # Production
npm run server:dev    # Development (with auto-reload)
```

The server runs on `http://localhost:3000` by default.

## Features

- **Weekly Schedule**: Runs every Monday at 2:00 AM UTC
- **Smart Comparison**: Compares fetched spec with last saved version using SHA256 hash
- **Conditional Save**: Only saves if changes are detected
- **Auto-versioning**: Saves with timestamps (e.g., `api-spec-2025-11-26T02-00-00-000Z.json`)
- **Latest Reference**: Updates `api-spec-latest.json` with the most recent spec
- **Manual Trigger**: POST to `/api/trigger-spec-fetch` to manually fetch on-demand
- **Version Listing**: GET `/api/spec-versions` to list all saved versions with metadata
- **Health Check**: GET `/api/health` to verify the server is running

## File Structure

```
server/
  ├── index.js          # Express server & cron setup
  └── cron-jobs.js      # Cron job logic (fetch, compare, save)
public/
  └── api-specs/        # Storage for versioned specs (auto-created)
    ├── api-spec-2025-11-26T02-00-00-000Z.json
    ├── api-spec-2025-11-27T02-00-00-000Z.json
    └── api-spec-latest.json              # Latest version reference
```

## API Endpoints

### Manual Trigger (Fetch and Compare)
```
POST /api/trigger-spec-fetch
```

**Response (with changes):**
```json
{
  "success": true,
  "isNew": true,
  "reason": "Changes detected",
  "comparison": {
    "hasChanges": true,
    "oldHash": "abc123...",
    "newHash": "def456...",
    "oldInfo": { "version": "1.0.0" },
    "newInfo": { "version": "1.1.0" }
  },
  "result": {
    "filename": "api-spec-2025-11-26T02-00-00-000Z.json",
    "filepath": "/path/to/public/api-specs/api-spec-2025-11-26T02-00-00-000Z.json"
  }
}
```

**Response (no changes):**
```json
{
  "success": true,
  "isNew": false,
  "reason": "No changes",
  "comparison": {
    "hasChanges": false,
    "oldHash": "abc123...",
    "newHash": "abc123...",
    "oldInfo": { "version": "1.0.0" },
    "newInfo": { "version": "1.0.0" }
  }
}
```

### List All Versions
```
GET /api/spec-versions
```

**Response:**
```json
{
  "success": true,
  "versions": [
    {
      "filename": "api-spec-2025-11-27T02-00-00-000Z.json",
      "filepath": "/path/to/public/api-specs/api-spec-2025-11-27T02-00-00-000Z.json",
      "hash": "def456...",
      "version": "1.1.0",
      "title": "My API",
      "savedAt": "2025-11-27T02:00:00.000Z"
    },
    {
      "filename": "api-spec-2025-11-26T02-00-00-000Z.json",
      "filepath": "/path/to/public/api-specs/api-spec-2025-11-26T02-00-00-000Z.json",
      "hash": "abc123...",
      "version": "1.0.0",
      "title": "My API",
      "savedAt": "2025-11-26T02:00:00.000Z"
    }
  ]
}
```

### Health Check
```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "message": "Cron job server running"
}
```

## How Comparison Works

1. **Fetch** the latest spec from AWS API Gateway
2. **Load** the last saved spec from `public/api-specs/`
3. **Calculate** SHA256 hash of both specs (normalized JSON)
4. **Compare** hashes:
   - If **identical**: No changes, skip saving
   - If **different**: Changes detected, save as new version with timestamp
5. **Update** `api-spec-latest.json` if new version was saved

This ensures only meaningful updates are persisted, avoiding duplicate storage of identical specs.

## Next Steps

1. Replace AWS credentials with your own or use AWS SDK v3 for automatic credential resolution
2. For production, use `@aws-sdk/client-api-gateway` and `@aws-sdk/credential-providers` for proper SigV4 signing
3. Configure the cron schedule in `server/cron-jobs.js` if needed
4. Deploy to production (e.g., AWS Lambda, EC2, or Heroku)
5. Monitor `/api/spec-versions` to track version history
