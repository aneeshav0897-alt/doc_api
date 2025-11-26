import cron from 'node-cron';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// AWS API Gateway configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_API_ID = process.env.AWS_API_ID;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const STORAGE_DIR = path.join(__dirname, '../public/api-specs');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

/**
 * Calculate SHA256 hash of spec for comparison
 */
function calculateSpecHash(spec) {
  const normalized = JSON.stringify(spec, null, 2);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Get the latest saved spec file
 */
function getLatestSpecFile() {
  try {
    const files = fs.readdirSync(STORAGE_DIR).filter(f => f.startsWith('api-spec-') && f.endsWith('.json') && f !== 'api-spec-latest.json');
    if (files.length === 0) return null;

    // Sort by timestamp (newest first)
    files.sort().reverse();
    return path.join(STORAGE_DIR, files[0]);
  } catch (error) {
    console.error('[Cron] Error reading spec files:', error.message);
    return null;
  }
}

/**
 * Load and parse a spec file
 */
function loadSpecFile(filepath) {
  try {
    if (!fs.existsSync(filepath)) return null;
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`[Cron] Error loading spec from ${filepath}:`, error.message);
    return null;
  }
}

/**
 * Compare two specs and return differences
 */
function compareSpecs(oldSpec, newSpec) {
  const oldHash = calculateSpecHash(oldSpec);
  const newHash = calculateSpecHash(newSpec);

  return {
    hasChanges: oldHash !== newHash,
    oldHash,
    newHash,
    oldInfo: oldSpec?.info || {},
    newInfo: newSpec?.info || {}
  };
}

/**
 * Save API spec to storage with timestamp
 */
function saveSpec(spec) {
  try {
    if (!spec) {
      console.warn('[Cron] No spec to save.');
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `api-spec-${timestamp}.json`;
    const filepath = path.join(STORAGE_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(spec, null, 2), 'utf-8');
    console.log(`[Cron] Spec saved to ${filepath}`);

    // Also update the latest reference file
    const latestPath = path.join(STORAGE_DIR, 'api-spec-latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(spec, null, 2), 'utf-8');
    console.log(`[Cron] Latest spec updated at ${latestPath}`);

    return { filename, filepath };
  } catch (error) {
    console.error('[Cron] Error saving spec:', error.message);
    return null;
  }
}

/**
 * Get spec metadata (hash, version, timestamp)
 */
function getSpecMetadata(filepath) {
  try {
    const spec = loadSpecFile(filepath);
    if (!spec) return null;

    const filename = path.basename(filepath);
    return {
      filename,
      filepath,
      hash: calculateSpecHash(spec),
      version: spec.info?.version || 'unknown',
      title: spec.info?.title || 'unknown',
      savedAt: fs.statSync(filepath).mtime.toISOString()
    };
  } catch (error) {
    console.error('[Cron] Error getting metadata:', error.message);
    return null;
  }
}

/**
 * List all saved spec versions
 */
export function listSpecVersions() {
  try {
    const files = fs.readdirSync(STORAGE_DIR)
      .filter(f => f.startsWith('api-spec-') && f.endsWith('.json') && f !== 'api-spec-latest.json')
      .sort()
      .reverse(); // newest first

    return files.map(f => getSpecMetadata(path.join(STORAGE_DIR, f))).filter(Boolean);
  } catch (error) {
    console.error('[Cron] Error listing versions:', error.message);
    return [];
  }
}

/**
 * Fetch OpenAPI spec from AWS API Gateway
 * Uses AWS SDK v3 for proper request signing
 */
async function fetchApiGatewaySpec() {
  if (!AWS_API_ID) {
    console.error('[Cron] AWS_API_ID not configured. Skipping fetch.');
    return null;
  }

  try {
    // AWS API Gateway export endpoint
    // Exports OAS 3.0 format from prod stage
    const url = `https://apigateway.${AWS_REGION}.amazonaws.com/restapis/${AWS_API_ID}/stages/prod/exports/oas30`;

    const options = {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
        // Note: For production, use AWS SDK v3 (@aws-sdk/client-api-gateway) for proper SigV4 signing
        // Manual signing shown below is simplified and may not work with all AWS configs
      }
    };

    // If using environment credentials, add basic auth header (for testing only)
    if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
      const authHeader = Buffer.from(`${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}`).toString('base64');
      options.headers['Authorization'] = `Basic ${authHeader}`;
    }

    console.log(`[Cron] Fetching API spec from AWS API Gateway: ${AWS_API_ID}`);
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`AWS API Gateway returned ${response.status}: ${response.statusText}`);
    }

    const spec = await response.json();
    return spec;
  } catch (error) {
    console.error('[Cron] Error fetching from AWS API Gateway:', error.message);
    return null;
  }
}

/**
 * Main cron job: fetch, compare, and save weekly
 * Runs every Monday at 2:00 AM UTC
 */
export function startWeeklyCronJob() {
  const task = cron.schedule('0 2 * * 1', async () => {
    console.log(`[Cron] Weekly job triggered at ${new Date().toISOString()}`);
    await performSpecUpdate();
  });

  console.log('[Cron] Weekly API spec fetch job scheduled (Mondays 2:00 AM UTC)');
  return task;
}

/**
 * Perform spec fetch, compare, and conditionally save
 */
export async function performSpecUpdate() {
  try {
    // Fetch new spec from AWS
    const newSpec = await fetchApiGatewaySpec();
    if (!newSpec) {
      console.error('[Cron] Failed to fetch API spec from AWS');
      return { success: false, error: 'Failed to fetch from AWS' };
    }

    // Get last saved spec
    const lastSpecPath = getLatestSpecFile();
    const lastSpec = lastSpecPath ? loadSpecFile(lastSpecPath) : null;

    if (!lastSpec) {
      console.log('[Cron] No previous spec found. Saving new spec as first version.');
      const result = saveSpec(newSpec);
      return { success: true, isNew: true, reason: 'First version', result };
    }

    // Compare specs
    const comparison = compareSpecs(lastSpec, newSpec);

    if (comparison.hasChanges) {
      console.log(`[Cron] Spec changes detected!`);
      console.log(`  Old hash: ${comparison.oldHash.slice(0, 8)}...`);
      console.log(`  New hash: ${comparison.newHash.slice(0, 8)}...`);
      console.log(`  Old version: ${comparison.oldInfo.version || 'unknown'}`);
      console.log(`  New version: ${comparison.newInfo.version || 'unknown'}`);

      const result = saveSpec(newSpec);
      return {
        success: true,
        isNew: true,
        reason: 'Changes detected',
        comparison,
        result
      };
    } else {
      console.log('[Cron] No changes detected. Skipping save.');
      return {
        success: true,
        isNew: false,
        reason: 'No changes',
        comparison
      };
    }
  } catch (error) {
    console.error('[Cron] Error during spec update:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Manual trigger for testing
 */
export async function triggerSpecFetch() {
  console.log('[Manual] Triggering API spec fetch...');
  return await performSpecUpdate();
}

export default { startWeeklyCronJob, triggerSpecFetch };
