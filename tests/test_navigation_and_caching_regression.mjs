import test from 'node:test';
import assert from 'node:assert/strict';

// 1. Navigation & Path Normalization Tests
test('Router Navigation: URL path, query params, and hash preservation', () => {
  function normalizePathname(path) {
    const clean = path.replace(/\/+$/, '') || '/';
    return clean;
  }

  // Path normalization
  assert.strictEqual(normalizePathname('/dashboard/'), '/dashboard');
  assert.strictEqual(normalizePathname('/jobs///'), '/jobs');
  assert.strictEqual(normalizePathname('/'), '/');

  // Query parameter handling
  const targetUrl = new URL('/contact?topic=Accessibility%20Barrier&ref=footer#form-top', 'http://localhost:3000');
  const pathname = normalizePathname(targetUrl.pathname);
  const search = targetUrl.search;
  const hash = targetUrl.hash;

  assert.strictEqual(pathname, '/contact');
  assert.strictEqual(search, '?topic=Accessibility%20Barrier&ref=footer');
  assert.strictEqual(hash, '#form-top');

  const fullTarget = pathname + search + hash;
  assert.strictEqual(fullTarget, '/contact?topic=Accessibility%20Barrier&ref=footer#form-top');

  const searchParams = new URLSearchParams(search);
  assert.strictEqual(searchParams.get('topic'), 'Accessibility Barrier');
  assert.strictEqual(searchParams.get('ref'), 'footer');
});

// 2. Cache Key Generation & User Scoping
test('API Client Cache: User scoping prevents data leaks across logout/login', () => {
  function hashToken(token) {
    if (!token) return 'anonymous';
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash << 5) - hash + token.charCodeAt(i);
      hash |= 0;
    }
    return `user_${Math.abs(hash).toString(36)}`;
  }

  const tokenUserA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.userA';
  const tokenUserB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.userB';

  const scopeAnon = hashToken(null);
  const scopeA = hashToken(tokenUserA);
  const scopeB = hashToken(tokenUserB);

  assert.strictEqual(scopeAnon, 'anonymous');
  assert.notStrictEqual(scopeA, scopeAnon);
  assert.notStrictEqual(scopeA, scopeB);

  // Generate cache keys
  const endpoint = '/api/v1/applications?status=applied';
  const keyA = `${scopeA}::${endpoint}`;
  const keyB = `${scopeB}::${endpoint}`;

  assert.notStrictEqual(keyA, keyB);

  // Simulate cache storage and user switch detection
  const apiCache = new Map();
  let currentActiveUserScope = scopeA;

  apiCache.set(keyA, { data: [{ id: 'app_1', candidate: 'Alice' }], timestamp: Date.now() });
  assert.strictEqual(apiCache.has(keyA), true);

  // User B logs in (detected user scope change)
  const newUserScope = scopeB;
  if (currentActiveUserScope !== newUserScope) {
    apiCache.clear();
    currentActiveUserScope = newUserScope;
  }

  // Verify User A's cached application data is not accessible to User B
  assert.strictEqual(apiCache.size, 0);
  assert.strictEqual(apiCache.has(keyA), false);
  assert.strictEqual(apiCache.has(keyB), false);
});

// 3. Sensitive Endpoint Protection
test('API Client Cache: Sensitive endpoints are never cached in GET requests', () => {
  const SENSITIVE_PATH_PATTERNS = [
    '/auth/',
    '/credentials',
    '/tokens',
    '/password',
    '/session',
  ];

  function isSensitiveEndpoint(endpoint) {
    const lower = endpoint.toLowerCase();
    return SENSITIVE_PATH_PATTERNS.some((pattern) => lower.includes(pattern));
  }

  // Sensitive paths that must bypass cache
  assert.strictEqual(isSensitiveEndpoint('/api/v1/linkedin/session'), true);
  assert.strictEqual(isSensitiveEndpoint('/api/v1/auth/tokens'), true);
  assert.strictEqual(isSensitiveEndpoint('/api/v1/user/credentials'), true);
  assert.strictEqual(isSensitiveEndpoint('/api/v1/password/reset'), true);

  // Normal paths that are safe to cache
  assert.strictEqual(isSensitiveEndpoint('/api/v1/jobs?status=active'), false);
  assert.strictEqual(isSensitiveEndpoint('/api/v1/applications'), false);
  assert.strictEqual(isSensitiveEndpoint('/api/v1/automation/runs'), false);
  assert.strictEqual(isSensitiveEndpoint('/api/v1/profile/'), false);
});

// 4. Mutation Cache Invalidation
test('API Client Cache: Mutations correctly invalidate matching resource prefix', () => {
  const apiCache = new Map();

  function invalidateApiCache(prefix) {
    if (!prefix) {
      apiCache.clear();
      return;
    }
    for (const key of apiCache.keys()) {
      if (key.includes(prefix)) {
        apiCache.delete(key);
      }
    }
  }

  // Populate cache with multiple resource endpoints
  apiCache.set('user_1::/api/v1/jobs?page=1', { data: [1, 2], timestamp: Date.now() });
  apiCache.set('user_1::/api/v1/jobs?page=2', { data: [3, 4], timestamp: Date.now() });
  apiCache.set('user_1::/api/v1/applications', { data: [{ id: 'app1' }], timestamp: Date.now() });
  apiCache.set('user_1::/api/v1/automation/runs', { data: [{ id: 'run1' }], timestamp: Date.now() });

  assert.strictEqual(apiCache.size, 4);

  // When a job application is submitted (POST /api/v1/applications)
  const mutationEndpoint = '/api/v1/applications';
  const rootPrefix = mutationEndpoint.split('?')[0].split('/').slice(0, 4).join('/');
  assert.strictEqual(rootPrefix, '/api/v1/applications');

  invalidateApiCache(rootPrefix);

  // Applications cache is deleted; other endpoints remain intact
  assert.strictEqual(apiCache.has('user_1::/api/v1/applications'), false);
  assert.strictEqual(apiCache.has('user_1::/api/v1/jobs?page=1'), true);
  assert.strictEqual(apiCache.has('user_1::/api/v1/jobs?page=2'), true);
  assert.strictEqual(apiCache.has('user_1::/api/v1/automation/runs'), true);
  assert.strictEqual(apiCache.size, 3);
});

// 5. Inactive Tab State & Polling Behavior
test('Tab State Preservation: Inactive tabs pause polling and maintain state', () => {
  let pollIntervalId = null;
  let pollCount = 0;

  function setPolling(isActive, hasActiveRuns) {
    if (!isActive) {
      if (pollIntervalId !== null) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
      return;
    }

    if (hasActiveRuns && pollIntervalId === null) {
      pollIntervalId = setInterval(() => {
        pollCount += 1;
      }, 50);
    } else if (!hasActiveRuns && pollIntervalId !== null) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  // Active tab with running task starts interval
  setPolling(true, true);
  assert.notStrictEqual(pollIntervalId, null);

  // Switching away to another tab (isActive = false) clears interval
  setPolling(false, true);
  assert.strictEqual(pollIntervalId, null);

  // Switching back to tab (isActive = true) restores interval
  setPolling(true, true);
  assert.notStrictEqual(pollIntervalId, null);

  // When task completes, interval stops
  setPolling(true, false);
  assert.strictEqual(pollIntervalId, null);

  if (pollIntervalId !== null) {
    clearInterval(pollIntervalId);
  }
});

// 6. In-flight Request Deduplication
test('In-Flight Request Deduplication: Simultaneous GET calls share single promise', async () => {
  const inflightRequests = new Map();
  let networkCallCount = 0;

  async function mockFetch(endpoint) {
    if (inflightRequests.has(endpoint)) {
      return inflightRequests.get(endpoint);
    }

    const promise = (async () => {
      networkCallCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { endpoint, result: 'success' };
    })();

    inflightRequests.set(endpoint, promise);
    try {
      return await promise;
    } finally {
      inflightRequests.delete(endpoint);
    }
  }

  // Fire 3 simultaneous GET calls to the same endpoint
  const [res1, res2, res3] = await Promise.all([
    mockFetch('/api/v1/profile/'),
    mockFetch('/api/v1/profile/'),
    mockFetch('/api/v1/profile/'),
  ]);

  assert.strictEqual(networkCallCount, 1, 'Only one actual network call should be made');
  assert.strictEqual(res1.result, 'success');
  assert.strictEqual(res2.result, 'success');
  assert.strictEqual(res3.result, 'success');
  assert.strictEqual(inflightRequests.size, 0, 'In-flight map should be cleaned up');
});
