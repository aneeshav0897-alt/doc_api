import express from 'express';
import { startWeeklyCronJob, triggerSpecFetch, listSpecVersions } from './cron-jobs.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Start cron job on server startup
startWeeklyCronJob();

// Manual trigger endpoint (for testing)
app.post('/api/trigger-spec-fetch', async (req, res) => {
  try {
    const result = await triggerSpecFetch();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List all spec versions with metadata
app.get('/api/spec-versions', (req, res) => {
  try {
    const versions = listSpecVersions();
    res.json({ success: true, versions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Cron job server running' });
});

app.listen(PORT, () => {
  console.log(`[Server] Cron job server running on port ${PORT}`);
  console.log(`[Server] Trigger fetch: POST http://localhost:${PORT}/api/trigger-spec-fetch`);
  console.log(`[Server] List versions: GET http://localhost:${PORT}/api/spec-versions`);
  console.log(`[Server] Health check: GET http://localhost:${PORT}/api/health`);
});
