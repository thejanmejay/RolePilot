#!/usr/bin/env node
// Demo Proxy Server
// Uses Claude CLI's OAuth token from macOS Keychain - no API key needed.
// The client enters "DEMO_KEY" in the extension, all requests route here.
//
// Usage: node server.js

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');

const PORT = 3456;

// ---- Resolve API Key ----
// Priority: ANTHROPIC_API_KEY env var > Claude CLI OAuth token (fallback)

function getAuth(quiet = false) {
  // 1. Check for a real API key first
  if (process.env.ANTHROPIC_API_KEY) {
    if (!quiet) console.log('[Auth] Using ANTHROPIC_API_KEY from environment');
    return { type: 'api-key', token: process.env.ANTHROPIC_API_KEY };
  }

  // 2. Fallback: try Claude CLI OAuth token
  try {
    const raw = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      { encoding: 'utf8' }
    ).trim();

    const creds = JSON.parse(raw);
    const oauth = creds.claudeAiOauth;

    if (!oauth?.accessToken) {
      if (!quiet) {
        console.warn('[Auth] Claude CLI is not logged in yet (empty accessToken in Keychain).');
        console.warn('[Auth] Run "claude auth login" in a terminal or set ANTHROPIC_API_KEY.');
      }
      return null;
    }

    if (oauth.expiresAt && Date.now() > oauth.expiresAt) {
      if (!quiet) console.warn('[Warning] OAuth token may be expired. Run "claude" in terminal to refresh.');
    }

    if (!quiet) {
      console.log('[Auth] Using Claude CLI OAuth token from macOS Keychain');
      console.log(`[Auth] Org: ${creds.organizationUuid || 'default'}`);
      console.log(`[Auth] Tier: ${oauth.rateLimitTier || 'unknown'}`);
      console.log(`[Auth] Expires: ${new Date(oauth.expiresAt).toLocaleString()}`);
    }

    return { type: 'oauth', token: oauth.accessToken };
  } catch (err) {
    if (!quiet) {
      console.warn('[Auth] No ANTHROPIC_API_KEY set and could not read Claude CLI credentials.');
      console.warn('[Auth] Set ANTHROPIC_API_KEY or run "claude auth login".');
    }
    return null;
  }
}

let auth = getAuth(false);

// ---- Start Server ----

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access');
  res.setHeader('Access-Control-Expose-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/v1/messages') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. Use POST /v1/messages' }));
    return;
  }

  // Read body
  let body = '';
  for await (const chunk of req) body += chunk;

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  auth = getAuth(true);
  if (!auth) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        message: 'No Anthropic credentials configured. Run "claude auth login" in terminal or set ANTHROPIC_API_KEY.'
      }
    }));
    return;
  }

  const isStreaming = payload.stream === true;
  console.log(`[${ts()}] ${isStreaming ? 'Stream' : 'Request'} -> model: ${payload.model}, msgs: ${payload.messages?.length}`);

  // Forward to Anthropic API with OAuth token
  const postData = JSON.stringify(payload);

  const options = {
    hostname: 'api.anthropic.com',
    port: 443,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth.type === 'api-key'
        ? { 'x-api-key': auth.token }
        : { 'Authorization': `Bearer ${auth.token}`, 'anthropic-beta': 'oauth-2025-04-20' }),
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    const headers = {
      'Content-Type': proxyRes.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*'
    };

    if (isStreaming) {
      headers['Cache-Control'] = 'no-cache';
      headers['Connection'] = 'keep-alive';
    }

    res.writeHead(proxyRes.statusCode, headers);

    if (proxyRes.statusCode !== 200) {
      console.log(`[${ts()}] API returned ${proxyRes.statusCode}`);
      // Log error body for debugging
      let errBody = '';
      proxyRes.on('data', (chunk) => {
        errBody += chunk.toString();
        res.write(chunk);
      });
      proxyRes.on('end', () => {
        console.log(`[${ts()}] Error: ${errBody.slice(0, 200)}`);
        res.end();
      });
      return;
    }

    // Pipe success response
    let tokenCount = 0;
    proxyRes.on('data', (chunk) => {
      res.write(chunk);
      // Count streaming events for logging
      const str = chunk.toString();
      const matches = str.match(/content_block_delta/g);
      if (matches) tokenCount += matches.length;
    });

    proxyRes.on('end', () => {
      res.end();
      console.log(`[${ts()}] Done (${tokenCount} chunks streamed)`);
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[${ts()}] Proxy error: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `Proxy error: ${err.message}` } }));
  });

  proxyReq.write(postData);
  proxyReq.end();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[Error] Port ${PORT} is already in use.`);
    console.error(`Run: lsof -ti:${PORT} | xargs kill -9`);
    console.error('Then try again.\n');
  } else {
    console.error('[Error]', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  const authLabel = auth
    ? (auth.type === 'api-key' ? 'ANTHROPIC_API_KEY' : 'Claude CLI OAuth')
    : 'Waiting for login (run "claude auth login" or set ANTHROPIC_API_KEY)';
  console.log('');
  console.log('===========================================');
  console.log('  ApplyPie - Demo Proxy Server');
  console.log(`  http://localhost:${PORT}`);
  console.log('');
  console.log(`  Using: ${authLabel}`);
  console.log('  Extension key: DEMO_KEY');
  console.log('===========================================');
  console.log('');
});

function ts() {
  return new Date().toLocaleTimeString();
}
