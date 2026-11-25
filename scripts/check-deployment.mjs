/**
 * Live deployment checks for S2-T09 (TC-S2-053, TC-S2-054, TC-S2-056,
 * TC-S2-058 connectivity, TC-S2-030 on the published bundle).
 *
 *   npm run deploy:check -- <backend-url> <frontend-origin>
 *   npm run deploy:check -- https://libraryflow-api.onrender.com https://libraryflow.netlify.app
 *
 * Needs no credentials and reads no .env. It only sends anonymous requests, so
 * anyone on the team can run it. Prints PASS/FAIL per check; exit code 1 when
 * any check fails. A Render free instance may take about a minute to wake up,
 * so the first health request retries for up to WAKE_TIMEOUT_MS.
 */
import { pathToFileURL } from 'node:url';

export const WAKE_TIMEOUT_MS = 90_000;
export const UNTRUSTED_ORIGIN = 'https://deploy-check.invalid';

// Same patterns as TC-S2-030/055: server secret names and secret values.
const SECRET_NAME_PATTERN = /SUPABASE_SERVICE_ROLE_KEY|FIREBASE_PRIVATE_KEY|DELETION_WORKER_SECRET/;
const SECRET_VALUE_PATTERN =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./;

function normalizeUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a full URL such as https://example.com (got "${value ?? ''}").`);
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error(`${label} must use https.`);
  }
  return url.origin;
}

async function fetchWithWake(fetchImpl, url, sleep, now) {
  const deadline = now() + WAKE_TIMEOUT_MS;
  let lastError = 'no response';
  while (now() < deadline) {
    try {
      const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
      if (response.status !== 502 && response.status !== 503) return response;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(5_000);
  }
  throw new Error(`Backend did not answer within ${WAKE_TIMEOUT_MS / 1000} s (${lastError}).`);
}

/** Same-origin script and modulepreload URLs referenced by index.html. */
export function findScriptUrls(html, frontendOrigin) {
  const urls = new Set();
  const patterns = [
    /<script[^>]+src=["']([^"']+)["']/gi,
    /<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/gi,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']modulepreload["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const url = new URL(match[1], `${frontendOrigin}/`);
      if (url.origin === frontendOrigin) urls.add(url.href);
    }
  }
  return [...urls];
}

/** Same-origin JavaScript chunks imported by a bundle (Vite `assets/*.js`). */
export function findChunkUrls(source, scriptUrl) {
  const urls = new Set();
  for (const match of source.matchAll(/["'`]((?:\.{0,2}\/)?(?:assets\/)?[\w.-]+\.js)["'`]/g)) {
    // Vite writes chunk names both as "./name.js" and as base-relative "assets/name.js".
    const url = new URL(match[1], scriptUrl);
    url.pathname = url.pathname.replace(/\/assets\/assets\//, '/assets/');
    if (url.origin === new URL(scriptUrl).origin && url.pathname.includes('/assets/')) urls.add(url.href);
  }
  return [...urls];
}

export async function checkDeployment(
  backendUrl,
  frontendOrigin,
  { fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = Date.now } = {},
) {
  const backend = normalizeUrl(backendUrl, 'Backend URL');
  const frontend = normalizeUrl(frontendOrigin, 'Frontend origin');
  const checks = [];
  const record = (id, name, passed, detail) => checks.push({ id, name, passed, detail });

  try {
    // TC-S2-053: health without authentication.
    const health = await fetchWithWake(fetchImpl, `${backend}/health`, sleep, now);
    const body = await health.json().catch(() => null);
    record('TC-S2-053', 'GET /health returns 200 HealthResponse without authentication',
      health.status === 200 && body?.status === 'ok' && body?.service === 'library-flow-api',
      `HTTP ${health.status}; body ${JSON.stringify(body)}`);

    // TC-S2-054: CORS allows the frontend origin exactly.
    const allowed = await fetchImpl(`${backend}/health`, { headers: { Origin: frontend } });
    await allowed.arrayBuffer().catch(() => undefined);
    const allowedHeader = allowed.headers.get('access-control-allow-origin');
    record('TC-S2-054', 'CORS allows the configured frontend origin', allowedHeader === frontend,
      `Access-Control-Allow-Origin: ${allowedHeader ?? '(none)'}`);

    // TC-S2-054: preflight from the frontend origin.
    const preflight = await fetchImpl(`${backend}/api/v1/books`, {
      method: 'OPTIONS',
      headers: {
        Origin: frontend,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    await preflight.arrayBuffer().catch(() => undefined);
    const preflightHeader = preflight.headers.get('access-control-allow-origin');
    record('TC-S2-054', 'Preflight from the frontend origin succeeds',
      preflight.status < 300 && preflightHeader === frontend,
      `HTTP ${preflight.status}; Access-Control-Allow-Origin: ${preflightHeader ?? '(none)'}`);

    // TC-S2-054: other origins receive no allow header.
    const denied = await fetchImpl(`${backend}/health`, { headers: { Origin: UNTRUSTED_ORIGIN } });
    await denied.arrayBuffer().catch(() => undefined);
    const deniedHeader = denied.headers.get('access-control-allow-origin');
    record('TC-S2-054', 'CORS gives no allow header to an untrusted origin', deniedHeader === null,
      `Access-Control-Allow-Origin: ${deniedHeader ?? '(none)'}`);

    // Protected route requires authentication.
    const protectedResponse = await fetchImpl(`${backend}/api/v1/books/deploy-check/file/download-url`);
    const protectedBody = await protectedResponse.json().catch(() => null);
    record('TC-S2-053', 'Protected route rejects anonymous requests',
      protectedResponse.status === 401 && protectedBody?.error?.code === 'AUTH_REQUIRED',
      `HTTP ${protectedResponse.status}; code ${protectedBody?.error?.code ?? '(none)'}`);

    // TC-S2-058: frontend is published.
    const page = await fetchImpl(`${frontend}/`);
    const html = await page.text();
    record('TC-S2-058', 'Frontend origin serves the application', page.ok && /<div id="root"/i.test(html),
      `HTTP ${page.status}`);

    // TC-S2-030 / TC-S2-056: published bundle carries no server secrets.
    const pending = findScriptUrls(html, frontend);
    const scripts = [];
    const leaks = [];
    while (pending.length > 0 && scripts.length < 50) {
      const scriptUrl = pending.shift();
      if (scripts.includes(scriptUrl)) continue;
      scripts.push(scriptUrl);
      const script = await fetchImpl(scriptUrl);
      const source = await script.text();
      if (SECRET_NAME_PATTERN.test(source) || SECRET_VALUE_PATTERN.test(source)) {
        leaks.push(new URL(scriptUrl).pathname);
      }
      for (const chunk of findChunkUrls(source, scriptUrl)) {
        if (!scripts.includes(chunk) && !pending.includes(chunk)) pending.push(chunk);
      }
    }
    record('TC-S2-056', 'Published frontend bundle contains no server secrets',
      scripts.length > 0 && leaks.length === 0,
      scripts.length === 0 ? 'no scripts found in index.html' : `${scripts.length} scripts scanned; leaks: ${leaks.join(', ') || 'none'}`);
  } catch (error) {
    record('setup', 'Deployment checks ran to completion', false, error instanceof Error ? error.message : String(error));
  }

  return { backend, frontend, checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [backendUrl, frontendOrigin] = process.argv.slice(2);
  if (!backendUrl || !frontendOrigin) {
    console.error('Usage: npm run deploy:check -- <backend-url> <frontend-origin>');
    process.exitCode = 1;
  } else {
    checkDeployment(backendUrl, frontendOrigin)
      .then(({ backend, frontend, checks }) => {
        console.log(`Deployment check (${new Date().toISOString()})`);
        console.log(`  backend:  ${backend}`);
        console.log(`  frontend: ${frontend}`);
        for (const check of checks) {
          console.log(`${check.passed ? 'PASS' : 'FAIL'}  ${check.id}  ${check.name} (${check.detail})`);
        }
        const failed = checks.filter((check) => !check.passed).length;
        console.log(failed === 0 ? `All ${checks.length} checks passed.` : `${failed} of ${checks.length} checks failed.`);
        if (failed > 0) process.exitCode = 1;
      })
      .catch((error) => {
        console.error(`Deployment check failed: ${error.message}`);
        process.exitCode = 1;
      });
  }
}
