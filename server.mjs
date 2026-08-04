import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { ProxyAgent } from 'proxy-agent';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(ROOT, 'public');
const RUNTIME_DIR = join(ROOT, '.runtime');
const UPLOAD_DIR = join(RUNTIME_DIR, 'uploads');
const TASK_ARCHIVE_DIR = join(RUNTIME_DIR, 'task-archives');
const IMAGES_DIR = join(ROOT, 'images');
const PROXY_SETTINGS_FILE = join(RUNTIME_DIR, 'proxy-settings.json');
const FAL_KEY_FILE = join(RUNTIME_DIR, 'fal-key');
const GENMEDIA = join(ROOT, 'tools', process.platform === 'win32' ? 'genmedia.exe' : 'genmedia');
const PORT = Number(process.env.PORT || 14726);
const MAX_BODY = 100 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 90 * 1024 * 1024;
const MAX_REDIRECTS = 5;

const DEFAULT_PROXY_SETTINGS = Object.freeze({
  enabled: false,
  protocol: 'http',
  host: '127.0.0.1',
  port: 10808,
  authEnabled: false,
  username: '',
  password: ''
});

const runtime = {
  sessionKey: null,
  proxy: { ...DEFAULT_PROXY_SETTINGS },
  archiveLocks: new Map()
};

const DEMO_MODELS = [
  {
    endpoint_id: 'fal-ai/flux/dev',
    title: 'FLUX.1 [dev]',
    category: 'text-to-image',
    description: 'High quality text-to-image generation.',
    status: 'active',
    model_url: 'https://fal.ai/models/fal-ai/flux/dev'
  },
  {
    endpoint_id: 'fal-ai/flux/schnell',
    title: 'FLUX.1 [schnell]',
    category: 'text-to-image',
    description: 'Fast text-to-image generation.',
    status: 'active',
    model_url: 'https://fal.ai/models/fal-ai/flux/schnell'
  },
  {
    endpoint_id: 'fal-ai/nano-banana-pro',
    title: 'Nano Banana Pro',
    category: 'image-to-image',
    description: 'Image generation and editing with reference images.',
    status: 'active',
    model_url: 'https://fal.ai/models/fal-ai/nano-banana-pro'
  },
  {
    endpoint_id: 'fal-ai/wan/v2.2-a14b/text-to-video',
    title: 'Wan 2.2 A14B',
    category: 'text-to-video',
    description: 'Text-to-video generation endpoint.',
    status: 'active',
    model_url: 'https://fal.ai/models/fal-ai/wan/v2.2-a14b/text-to-video'
  },
  {
    endpoint_id: 'fal-ai/veo3.1',
    title: 'Veo 3.1',
    category: 'text-to-video',
    description: 'Video generation with audio support.',
    status: 'active',
    model_url: 'https://fal.ai/models/fal-ai/veo3.1'
  },
  {
    endpoint_id: 'fal-ai/hunyuan3d-v21',
    title: 'Hunyuan3D v2.1',
    category: 'image-to-3d',
    description: 'Image-to-3D asset generation endpoint.',
    status: 'active',
    model_url: 'https://fal.ai/models/fal-ai/hunyuan3d-v21'
  }
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json'
};

function keyFromRuntime() {
  return runtime.sessionKey || process.env.FAL_KEY || null;
}

function authSource() {
  if (runtime.sessionKey) return 'saved';
  if (process.env.FAL_KEY) return 'environment';
  return 'none';
}

async function loadSavedKey() {
  try {
    const key = String(await readFile(FAL_KEY_FILE, 'utf8')).trim();
    runtime.sessionKey = key || null;
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`Ignoring saved fal.ai key: ${error.message}`);
    runtime.sessionKey = null;
  }
}

async function saveKey(key) {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(FAL_KEY_FILE, `${key}\n`, { encoding: 'utf8', mode: 0o600 });
  runtime.sessionKey = key;
}

async function deleteSavedKey() {
  runtime.sessionKey = null;
  await rm(FAL_KEY_FILE, { force: true });
}

function validateProxySettings(input = {}) {
  const protocol = String(input.protocol || '').toLowerCase();
  if (!['http', 'https', 'socks5'].includes(protocol)) {
    throw Object.assign(new Error('Proxy protocol must be HTTP, HTTPS, or SOCKS5.'), { code: 'INVALID_PROXY_PROTOCOL' });
  }

  const host = String(input.host || '').trim();
  if (!host || host.includes(' ') || host.includes('/') || host.includes(':') || host.includes('@')) {
    throw Object.assign(new Error('Proxy host must be a hostname or IP address without a protocol or port.'), { code: 'INVALID_PROXY_HOST' });
  }

  const port = Number(input.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw Object.assign(new Error('Proxy port must be an integer between 1 and 65535.'), { code: 'INVALID_PROXY_PORT' });
  }

  const authEnabled = Boolean(input.authEnabled);
  const username = authEnabled ? String(input.username || '') : '';
  const password = authEnabled ? String(input.password || '') : '';
  if (authEnabled && (!username || !password)) {
    throw Object.assign(new Error('Proxy username and password are required when authentication is enabled.'), { code: 'INVALID_PROXY_AUTH' });
  }

  return {
    enabled: Boolean(input.enabled),
    protocol,
    host,
    port,
    authEnabled,
    username,
    password
  };
}

function proxyInputWithPassword(input, previous = runtime.proxy) {
  const body = input || {};
  return {
    ...body,
    password: body.authEnabled && body.password === '' && previous.authEnabled
      ? previous.password
      : body.password
  };
}

function publicProxySettings(settings = runtime.proxy) {
  return {
    enabled: settings.enabled,
    protocol: settings.protocol,
    host: settings.host,
    port: settings.port,
    authEnabled: settings.authEnabled,
    username: settings.username,
    hasPassword: Boolean(settings.password)
  };
}

function proxyUrl(settings = runtime.proxy) {
  const auth = settings.authEnabled
    ? `${encodeURIComponent(settings.username)}:${encodeURIComponent(settings.password)}@`
    : '';
  return `${settings.protocol}://${auth}${settings.host}:${settings.port}`;
}

function proxyEnvironment() {
  if (!runtime.proxy.enabled) return {};
  const url = proxyUrl();
  return {
    HTTP_PROXY: url,
    HTTPS_PROXY: url,
    ALL_PROXY: url,
    http_proxy: url,
    https_proxy: url,
    all_proxy: url,
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost'
  };
}

function createProxyAgent(settings = runtime.proxy) {
  if (!settings.enabled) return null;
  return new ProxyAgent({ getProxyForUrl: () => proxyUrl(settings) });
}

async function loadProxySettings() {
  try {
    const parsed = JSON.parse(await readFile(PROXY_SETTINGS_FILE, 'utf8'));
    runtime.proxy = validateProxySettings(parsed);
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`Ignoring invalid proxy settings: ${error.message}`);
    runtime.proxy = { ...DEFAULT_PROXY_SETTINGS };
  }
}

async function saveProxySettings(settings) {
  await mkdir(RUNTIME_DIR, { recursive: true });
  const temporary = `${PROXY_SETTINGS_FILE}.tmp`;
  await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, PROXY_SETTINGS_FILE);
  runtime.proxy = settings;
}

async function resetProxySettings() {
  runtime.proxy = { ...DEFAULT_PROXY_SETTINGS };
  await rm(PROXY_SETTINGS_FILE, { force: true });
}

async function testProxyConnection(targetUrl, candidateSettings) {
  const settings = validateProxySettings(candidateSettings || runtime.proxy);

  let target;
  try {
    target = new URL(String(targetUrl || 'https://api.fal.ai/v1/models?limit=1'));
  } catch {
    throw Object.assign(new Error('Test URL must be a valid HTTP or HTTPS URL.'), { code: 'INVALID_TEST_URL' });
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw Object.assign(new Error('Test URL must use HTTP or HTTPS.'), { code: 'INVALID_TEST_URL' });
  }

  const agent = createProxyAgent(settings);
  const request = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const startedAt = Date.now();
  try {
    const result = await new Promise((resolvePromise, rejectPromise) => {
      const req = request(target, { method: 'HEAD', agent, timeout: 15_000 }, (response) => {
        response.resume();
        resolvePromise({ statusCode: response.statusCode || 0 });
      });
      req.on('timeout', () => req.destroy(Object.assign(new Error('Proxy connection test timed out.'), { code: 'PROXY_TEST_TIMEOUT' })));
      req.on('error', rejectPromise);
      req.end();
    });
    return {
      ok: true,
      target: target.href,
      viaProxy: Boolean(agent),
      statusCode: result.statusCode,
      durationMs: Date.now() - startedAt
    };
  } finally {
    agent?.destroy();
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}

function errorPayload(code, message, extra = {}) {
  return { ok: false, error: { code, message }, ...extra };
}

async function readBuffer(req, limit = MAX_BODY) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      throw Object.assign(new Error('Request body is too large.'), { code: 'BODY_TOO_LARGE' });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readBody(req) {
  return (await readBuffer(req)).toString('utf8');
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { code: 'INVALID_JSON' });
  }
}

function parseJsonOutput(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // The CLI can emit status lines before its JSON payload.
    }
  }
  const starts = [text.indexOf('{'), text.indexOf('[')].filter((value) => value >= 0).sort((left, right) => left - right);
  if (!starts.length) return null;
  try {
    return JSON.parse(text.slice(starts[0]));
  } catch {
    return null;
  }
}

function runGenmedia(args, options = {}) {
  const timeout = options.timeout || 120_000;
  return new Promise((resolvePromise, rejectPromise) => {
    const env = {
      ...process.env,
      ...proxyEnvironment(),
      GENMEDIA_NO_ANALYTICS: '1',
      GENMEDIA_NO_UPDATE: '1',
      GENMEDIA_SESSION_ID: 'fal-playground-demo'
    };
    const key = keyFromRuntime();
    if (key) env.FAL_KEY = key;

    const child = spawn(GENMEDIA, args, {
      cwd: ROOT,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      rejectPromise(Object.assign(new Error('genmedia timed out.'), { code: 'CLI_TIMEOUT' }));
    }, timeout);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      rejectPromise(Object.assign(error, { code: 'CLI_START_FAILED' }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const parsed = parseJsonOutput(stdout) ?? parseJsonOutput(stderr);
      if (code === 0) {
        resolvePromise({ code, data: parsed, stdout, stderr });
        return;
      }
      const message = parsed?.error || stderr.trim() || stdout.trim() || `genmedia exited with code ${code}`;
      rejectPromise(Object.assign(new Error(String(message)), {
        code: 'CLI_FAILED',
        exitCode: code,
        details: parsed
      }));
    });
  });
}

async function fetchFalJson(url, options = {}) {
  const target = new URL(url);
  const request = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  const requestBody = options.body === undefined
    ? null
    : typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body);
  if (requestBody !== null && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (requestBody !== null) headers['Content-Length'] = String(Buffer.byteLength(requestBody));
  const key = keyFromRuntime();
  if (key) headers.Authorization = `Key ${key}`;
  const agent = createProxyAgent();

  try {
    return await new Promise((resolvePromise, rejectPromise) => {
      const req = request(target, {
        method: options.method || 'GET',
        headers,
        ...(agent ? { agent } : {})
      }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data;
          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            data = { raw: text };
          }
          if ((response.statusCode || 500) >= 400) {
            const message = data?.error || data?.message || `fal.ai returned HTTP ${response.statusCode}`;
            rejectPromise(Object.assign(new Error(String(message)), {
              code: 'FAL_HTTP_ERROR',
              status: response.statusCode,
              details: data
            }));
            return;
          }
          resolvePromise(data);
        });
      });
      req.setTimeout(options.timeout || 25_000, () => {
        req.destroy(Object.assign(new Error('fal.ai request timed out.'), { code: 'FAL_TIMEOUT' }));
      });
      req.on('error', rejectPromise);
      if (requestBody !== null) req.write(requestBody);
      req.end();
    });
  } finally {
    agent?.destroy();
  }
}

async function accountBalance() {
  if (!keyFromRuntime()) {
    throw Object.assign(new Error('Connect a fal.ai API key before checking the balance.'), { code: 'AUTH_REQUIRED' });
  }
  let data;
  try {
    data = await fetchFalJson('https://api.fal.ai/v1/account/billing?expand=credits');
  } catch (error) {
    if (error.code === 'FAL_HTTP_ERROR' && error.status === 403) {
      throw Object.assign(new Error('当前 fal.ai API Key 没有读取账户余额的权限，请改用 Admin API Key。'), {
        code: 'FAL_HTTP_ERROR',
        status: 403,
        details: error.details
      });
    }
    throw error;
  }
  const balance = Number(data?.credits?.current_balance);
  if (!Number.isFinite(balance)) {
    throw Object.assign(new Error('fal.ai did not return a valid credit balance.'), { code: 'INVALID_BALANCE_RESPONSE' });
  }
  return {
    ok: true,
    balance,
    currency: String(data?.credits?.currency || 'USD').toUpperCase()
  };
}

function modelListFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.models)) return data.models;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeModel(model) {
  const endpoint = model.endpoint_id || model.endpointId || model.id || model.model_id || '';
  const metadata = model.metadata || {};
  const rawCategory = model.category || metadata.category;
  const category = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;
  return {
    ...model,
    endpoint_id: endpoint,
    title: model.title || model.display_name || metadata.display_name || model.name || endpoint,
    description: model.description || metadata.description || model.summary || '',
    category: category || model.modality || model.type || 'other',
    status: model.status || metadata.status || 'active',
    model_url: model.page_url || metadata.page_url || `https://fal.ai/models/${endpoint}`,
    run_url: model.model_url || metadata.model_url || `https://fal.run/${endpoint}`,
    thumbnail_url: model.thumbnail_url || metadata.thumbnail_url || null
  };
}

function buildModelsUrl(query) {
  const params = new URLSearchParams();
  params.set('limit', String(Math.min(Math.max(Number(query.limit) || 24, 1), 100)));
  params.set('status', query.status || 'active');
  if (query.q) params.set('q', query.q);
  if (query.category && query.category !== 'all') params.set('category', query.category);
  if (query.cursor) params.set('cursor', query.cursor);
  return `https://api.fal.ai/v1/models?${params.toString()}`;
}

function demoModels(query) {
  const q = String(query.q || '').toLowerCase();
  const category = query.category || 'all';
  return DEMO_MODELS.filter((model) => {
    const text = `${model.endpoint_id} ${model.title} ${model.description}`.toLowerCase();
    return (!q || text.includes(q)) && (category === 'all' || model.category === category);
  });
}

async function listModels(query) {
  const key = keyFromRuntime();
  if (key) {
    try {
      const args = ['models'];
      if (query.q) args.push(query.q);
      if (query.category && query.category !== 'all') args.push(`--category=${query.category}`);
      if (query.status) args.push(`--status=${query.status}`);
      args.push(`--limit=${Math.min(Math.max(Number(query.limit) || 24, 1), 100)}`);
      if (query.cursor) args.push(`--cursor=${query.cursor}`);
      args.push('--json');
      const result = await runGenmedia(args, { timeout: 45_000 });
      const models = modelListFrom(result.data).map(normalizeModel).filter((model) => model.endpoint_id);
      if (models.length) {
        return {
          ok: true,
          live: true,
          source: 'genmedia',
          models,
          nextCursor: result.data?.next_cursor || result.data?.nextCursor || null,
          hasMore: Boolean(result.data?.has_more || result.data?.hasMore || result.data?.next_cursor)
        };
      }
    } catch {
      // REST fallback below.
    }
  }

  try {
    const data = await fetchFalJson(buildModelsUrl(query));
    return {
      ok: true,
      live: true,
      source: 'fal-rest',
      models: modelListFrom(data).map(normalizeModel).filter((model) => model.endpoint_id),
      nextCursor: data.next_cursor || data.nextCursor || null,
      hasMore: Boolean(data.has_more || data.hasMore || data.next_cursor)
    };
  } catch (error) {
    return {
      ok: true,
      live: false,
      demo: true,
      source: 'local-demo',
      needsKey: !key,
      notice: key ? `Live model catalog unavailable: ${error.message}` : 'Configure a fal.ai key to load the live catalog.',
      models: demoModels(query),
      nextCursor: null,
      hasMore: false
    };
  }
}

function demoSchema(endpointId) {
  const lower = endpointId.toLowerCase();
  const isVideo = lower.includes('video') || lower.includes('veo') || lower.includes('wan');
  const isEdit = lower.includes('edit') || lower.includes('banana') || lower.includes('image-to-image');
  const is3d = lower.includes('3d');
  const properties = {
    prompt: {
      type: 'string',
      title: 'Prompt',
      description: 'Describe the intended result.',
      minLength: 1
    }
  };
  if (isEdit) {
    properties.image_url = {
      type: 'string',
      title: 'Reference image',
      format: 'uri',
      description: 'A public image URL or an uploaded fal asset URL.'
    };
  }
  if (isVideo) {
    properties.duration = { type: 'number', title: 'Duration', default: 5, minimum: 1, maximum: 15 };
    properties.aspect_ratio = { type: 'string', title: 'Aspect ratio', enum: ['16:9', '9:16', '1:1'], default: '16:9' };
  }
  if (is3d) properties.output_format = { type: 'string', title: 'Output format', enum: ['glb', 'obj', 'fbx'], default: 'glb' };
  return {
    openapi: '3.0.0',
    info: { title: `Demo schema for ${endpointId}`, version: 'local-demo' },
    paths: {
      '/run': {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: { type: 'object', properties, required: ['prompt'] }
              }
            }
          }
        }
      }
    },
    'x-local-demo': true
  };
}

function isUsableOpenApi(schema) {
  if (!schema || typeof schema !== 'object') return false;
  if (!(schema.openapi || schema.swagger)) return false;
  if (!schema.paths || typeof schema.paths !== 'object') return false;
  return Object.values(schema.paths).some((pathItem) => {
    const operation = pathItem?.post || pathItem?.put || pathItem?.patch;
    return Boolean(operation?.requestBody?.content && Object.keys(operation.requestBody.content).length);
  });
}

function extractOpenApi(data) {
  if (!data) return null;
  if (data.openapi || data.swagger) return data;
  if (data.openapi_schema) return data.openapi_schema;
  if (data.schema?.openapi || data.schema?.swagger) return data.schema;
  const model = modelListFrom(data)[0];
  if (model?.openapi) return model.openapi;
  if (model?.schema?.openapi || model?.schema?.swagger) return model.schema;
  return data.schema || data.openapi || null;
}

async function getSchema(endpointId) {
  const key = keyFromRuntime();
  if (key) {
    try {
      const result = await runGenmedia(['schema', endpointId, '--format', 'openapi', '--json'], { timeout: 45_000 });
      const schema = extractOpenApi(result.data) || result.data;
      if (isUsableOpenApi(schema)) return { ok: true, live: true, source: 'genmedia', endpointId, schema };
    } catch {
      // REST fallback below.
    }
  }
  try {
    const data = await fetchFalJson(`https://api.fal.ai/v1/models?endpoint_id=${encodeURIComponent(endpointId)}&expand=openapi-3.0`);
    const schema = extractOpenApi(data);
    if (schema) return { ok: true, live: true, source: 'fal-rest', endpointId, schema };
  } catch (error) {
    return {
      ok: true,
      live: false,
      demo: true,
      needsKey: !key,
      source: 'local-demo',
      endpointId,
      notice: key ? `Live schema unavailable: ${error.message}` : 'This is an editable demo schema. Connect a fal.ai key to inspect the live endpoint schema.',
      schema: demoSchema(endpointId)
    };
  }
  return { ok: true, live: false, demo: true, endpointId, source: 'local-demo', schema: demoSchema(endpointId) };
}

function validateInputs(inputs) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    throw Object.assign(new Error('inputs must be a JSON object.'), { code: 'INVALID_INPUTS' });
  }
  for (const key of Object.keys(inputs)) {
    const valid = [...key].every((character) => {
      const code = character.charCodeAt(0);
      return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || ['_', '.', '-'].includes(character);
    });
    if (!valid) throw Object.assign(new Error(`Unsupported input name: ${key}`), { code: 'INVALID_INPUT_NAME' });
  }
}

function normalizeTaskId(value) {
  const taskId = String(value || '').trim();
  const validLength = taskId.length >= 8 && taskId.length <= 128;
  const validCharacters = [...taskId].every((character) => {
    const code = character.charCodeAt(0);
    return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || character === '_' || character === '-';
  });
  if (!validLength || !validCharacters) {
    throw Object.assign(new Error('A valid local task ID is required.'), { code: 'INVALID_TASK_ID' });
  }
  return taskId;
}

function queueRequestBase(endpointId, requestId) {
  return `https://queue.fal.run/${endpointId}/requests/${encodeURIComponent(requestId)}`;
}

function trustedQueueUrl(value, fallback) {
  const target = new URL(String(value || fallback), 'https://queue.fal.run');
  if (target.protocol !== 'https:' || target.hostname !== 'queue.fal.run') {
    throw Object.assign(new Error('fal.ai returned an unsupported queue URL.'), { code: 'INVALID_QUEUE_URL' });
  }
  return target.href;
}

function queueTaskResult(endpointId, result, fallback = {}) {
  const requestId = String(result?.request_id || result?.requestId || fallback.requestId || '');
  if (!requestId) {
    throw Object.assign(new Error('fal.ai queue submission did not return a request ID.'), { code: 'QUEUE_RESPONSE_INVALID' });
  }
  const requestBase = queueRequestBase(endpointId, requestId);
  return {
    ...result,
    endpoint_id: endpointId,
    request_id: requestId,
    status: result?.status || fallback.status || 'IN_QUEUE',
    status_url: trustedQueueUrl(result?.status_url || fallback.statusUrl, `${requestBase}/status`),
    response_url: trustedQueueUrl(result?.response_url || fallback.responseUrl, requestBase),
    cancel_url: trustedQueueUrl(result?.cancel_url || fallback.cancelUrl, `${requestBase}/cancel`)
  };
}

function falTaskFailureMessage(error) {
  const details = error?.details;
  if (typeof details?.error === 'string' && details.error) return details.error;
  if (typeof details?.error?.message === 'string' && details.error.message) return details.error.message;
  if (typeof details?.message === 'string' && details.message) return details.message;
  if (Array.isArray(details?.detail)) {
    const messages = details.detail
      .map((item) => typeof item === 'string' ? item : item?.msg || item?.message)
      .filter(Boolean);
    if (messages.length) return messages.join('; ');
  }
  return error?.message || 'fal.ai reported that the generation task failed.';
}

function falTaskFailureResult(endpointId, requestId, queue, error, status = {}) {
  return queueTaskResult(endpointId, {
    ...status,
    status: 'FAILED',
    request_id: requestId,
    error: {
      code: 'FAL_TASK_FAILED',
      message: falTaskFailureMessage(error),
      details: error?.details
    }
  }, queue);
}

async function submitQueueTask(endpointId, inputs) {
  const result = await fetchFalJson(`https://queue.fal.run/${endpointId}`, {
    method: 'POST',
    body: inputs,
    timeout: 60_000
  });
  return queueTaskResult(endpointId, result);
}

function extensionFromUrl(value) {
  try {
    const extension = extname(new URL(value).pathname).toLowerCase();
    if (extension.length >= 2 && extension.length <= 9) return extension;
  } catch {
    // The URL is validated before download.
  }
  return '';
}

function outputKindFromPath(path) {
  const lower = String(path || '').toLowerCase();
  if (lower.includes('image') || lower.includes('photo') || lower.includes('mask')) return 'image';
  if (lower.includes('video') || lower.includes('movie')) return 'video';
  if (lower.includes('audio') || lower.includes('speech') || lower.includes('voice')) return 'audio';
  if (lower.includes('file') || lower.includes('model') || lower.includes('mesh') || lower.includes('asset') || lower.includes('output') || lower.includes('result')) return 'file';
  return '';
}

function extensionKind(extension) {
  const image = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'];
  const video = ['.mp4', '.webm', '.mov', '.m4v'];
  const audio = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
  const file = ['.glb', '.gltf', '.obj', '.fbx', '.zip', '.pdf'];
  if (image.includes(extension)) return 'image';
  if (video.includes(extension)) return 'video';
  if (audio.includes(extension)) return 'audio';
  if (file.includes(extension)) return 'file';
  return '';
}

function collectOutputAssets(value, path = '', results = [], seen = new Set()) {
  if (value === null || value === undefined) return results;
  if (typeof value === 'object') {
    if (seen.has(value)) return results;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => collectOutputAssets(item, `${path}[${index}]`, results, seen));
    } else {
      Object.entries(value).forEach(([key, item]) => collectOutputAssets(item, path ? `${path}.${key}` : key, results, seen));
    }
    return results;
  }
  if (typeof value !== 'string' || !(value.startsWith('https://') || value.startsWith('http://'))) return results;
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith('status_url') || lowerPath.endsWith('response_url') || lowerPath.endsWith('cancel_url')) return results;
  const extension = extensionFromUrl(value);
  const kind = outputKindFromPath(path) || extensionKind(extension);
  if (kind && !results.some((item) => item.url === value)) results.push({ url: value, path, extension, kind });
  return results;
}

function sanitizeSegment(value, fallback) {
  const illegal = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);
  let output = '';
  for (const character of String(value || '').normalize('NFKC')) {
    const code = character.charCodeAt(0);
    if (code < 32 || illegal.has(character)) output += '-';
    else if (character === ' ') output += '-';
    else output += character;
  }
  while (output.includes('--')) output = output.replaceAll('--', '-');
  output = output.replaceAll('..', '.');
  output = output.replace(/^[-. ]+|[-. ]+$/g, '').slice(0, 120);
  return output || fallback;
}

function modelFolderName(endpointId) {
  return String(endpointId).split('/').map((segment) => sanitizeSegment(segment, 'model')).join('__');
}

function extensionFromContentType(contentType, fallbackKind) {
  const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  const table = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'model/gltf-binary': '.glb',
    'model/gltf+json': '.gltf',
    'application/pdf': '.pdf',
    'application/zip': '.zip'
  };
  if (table[mime]) return table[mime];
  return { image: '.png', video: '.mp4', audio: '.mp3', file: '.bin' }[fallbackKind] || '.bin';
}

function requestBinary(urlValue, options = {}, redirectCount = 0) {
  const target = new URL(urlValue);
  if (!['http:', 'https:'].includes(target.protocol)) {
    return Promise.reject(Object.assign(new Error('Unsupported output URL protocol.'), { code: 'ARCHIVE_URL_INVALID' }));
  }
  const request = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const agent = createProxyAgent();
  return new Promise((resolvePromise, rejectPromise) => {
    const req = request(target, { method: 'GET', ...(agent ? { agent } : {}) }, (response) => {
      const statusCode = response.statusCode || 500;
      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        response.resume();
        agent?.destroy();
        if (redirectCount >= MAX_REDIRECTS) {
          rejectPromise(Object.assign(new Error('Too many output download redirects.'), { code: 'ARCHIVE_REDIRECT_LIMIT' }));
          return;
        }
        const redirected = new URL(response.headers.location, target).href;
        requestBinary(redirected, options, redirectCount + 1).then(resolvePromise, rejectPromise);
        return;
      }
      if (statusCode >= 400) {
        response.resume();
        agent?.destroy();
        rejectPromise(Object.assign(new Error(`Output download returned HTTP ${statusCode}.`), { code: 'ARCHIVE_DOWNLOAD_FAILED' }));
        return;
      }
      resolvePromise({ response, agent, contentType: response.headers['content-type'] || '' });
    });
    req.setTimeout(options.timeout || 120_000, () => {
      req.destroy(Object.assign(new Error('Output archive download timed out.'), { code: 'ARCHIVE_DOWNLOAD_TIMEOUT' }));
    });
    req.on('error', (error) => {
      agent?.destroy();
      rejectPromise(error);
    });
    req.end();
  });
}

async function downloadArchiveAsset(asset, destinationStem) {
  const { response, agent, contentType } = await requestBinary(asset.url);
  const extension = asset.extension || extensionFromContentType(contentType, asset.kind);
  const destination = `${destinationStem}${extension}`;
  try {
    await new Promise((resolvePromise, rejectPromise) => {
      const output = createWriteStream(destination, { flags: 'wx' });
      response.pipe(output);
      response.on('error', rejectPromise);
      output.on('finish', resolvePromise);
      output.on('error', rejectPromise);
    });
    return destination;
  } catch (error) {
    await rm(destination, { force: true }).catch(() => {});
    throw error;
  } finally {
    agent?.destroy();
  }
}

function manifestPath(taskId) {
  return join(TASK_ARCHIVE_DIR, `${taskId}.json`);
}

async function readArchiveManifest(taskId) {
  try {
    const value = JSON.parse(await readFile(manifestPath(taskId), 'utf8'));
    return value && typeof value === 'object' ? value : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    await rm(manifestPath(taskId), { force: true }).catch(() => {});
    return null;
  }
}

async function archivedAssetForDownload(taskIdValue, assetIndexValue) {
  const taskId = normalizeTaskId(taskIdValue);
  const assetIndex = Number(assetIndexValue);
  if (!Number.isInteger(assetIndex) || assetIndex < 0) {
    throw Object.assign(new Error('A valid output index is required.'), { code: 'INVALID_ASSET_INDEX' });
  }
  if (runtime.archiveLocks.has(taskId)) await runtime.archiveLocks.get(taskId);
  const manifest = await readArchiveManifest(taskId);
  const file = manifest?.files?.find((item) => Number(item.index) === assetIndex);
  if (!file) return null;
  const target = resolveManagedArchivePath(file.relativePath);
  if (!target) return null;
  try {
    const info = await stat(target);
    if (!info.isFile()) return null;
    return {
      target,
      size: info.size,
      fileName: basename(file.fileName || target),
      contentType: MIME_TYPES[extname(target).toLowerCase()] || 'application/octet-stream'
    };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function downloadFileName(value, fallback = 'fal-output.bin') {
  const sanitized = sanitizeSegment(basename(String(value || fallback)), fallback);
  const ascii = sanitized.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return ascii || fallback;
}

function writeDownloadHeaders(res, { contentType, fileName, contentLength }) {
  res.writeHead(200, {
    'Content-Type': contentType || 'application/octet-stream',
    'Content-Length': String(contentLength),
    'Content-Disposition': `attachment; filename="${downloadFileName(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName || 'fal-output.bin')}`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
}

async function streamArchivedAsset(asset, res) {
  writeDownloadHeaders(res, { contentType: asset.contentType, fileName: asset.fileName, contentLength: asset.size });
  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createReadStream(asset.target);
    stream.on('error', rejectPromise);
    stream.on('end', resolvePromise);
    res.on('close', resolvePromise);
    stream.pipe(res);
  });
}

async function proxyRemoteAsset(urlValue, requestedFileName, res) {
  const { response, agent, contentType } = await requestBinary(urlValue, { timeout: 300_000 });
  const contentLength = Number(response.headers['content-length']);
  const fileName = requestedFileName || basename(new URL(urlValue).pathname) || 'fal-output.bin';
  const headers = {
    'Content-Type': contentType || MIME_TYPES[extname(fileName).toLowerCase()] || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${downloadFileName(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  if (Number.isFinite(contentLength) && contentLength >= 0) headers['Content-Length'] = String(contentLength);
  res.writeHead(200, headers);
  try {
    await new Promise((resolvePromise, rejectPromise) => {
      response.on('error', rejectPromise);
      response.on('end', resolvePromise);
      res.on('close', resolvePromise);
      response.pipe(res);
    });
  } finally {
    agent?.destroy();
  }
}

async function downloadTaskAsset(req, res) {
  const body = await readJson(req);
  const taskId = normalizeTaskId(body.taskId);
  const assetIndex = Number(body.assetIndex);
  const archived = await archivedAssetForDownload(taskId, assetIndex);
  if (archived) {
    await streamArchivedAsset(archived, res);
    return;
  }
  const sourceUrl = String(body.url || '');
  let target;
  try {
    target = new URL(sourceUrl);
  } catch {
    throw Object.assign(new Error('The output is not available in the local archive and has no valid source URL.'), { code: 'INVALID_ASSET_URL' });
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw Object.assign(new Error('The output source URL must use HTTP or HTTPS.'), { code: 'INVALID_ASSET_URL' });
  }
  await proxyRemoteAsset(target.href, String(body.fileName || ''), res);
}

async function writeArchiveManifest(manifest) {
  await mkdir(TASK_ARCHIVE_DIR, { recursive: true });
  const destination = manifestPath(manifest.taskId);
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rename(temporary, destination);
}

async function archiveTaskOutputs(taskIdValue, endpointId, result) {
  const taskId = normalizeTaskId(taskIdValue);
  if (runtime.archiveLocks.has(taskId)) return runtime.archiveLocks.get(taskId);

  const operation = (async () => {
    const existing = await readArchiveManifest(taskId);
    if (existing?.completed) return existing;

    const assets = collectOutputAssets(result);
    const modelFolder = modelFolderName(endpointId);
    const destinationDirectory = join(IMAGES_DIR, modelFolder);
    await mkdir(destinationDirectory, { recursive: true });

    const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
    const files = [];
    const errors = [];
    for (const [index, asset] of assets.entries()) {
      try {
        const stem = join(destinationDirectory, `${timestamp}_${taskId.slice(0, 12)}_${String(index + 1).padStart(2, '0')}`);
        const destination = await downloadArchiveAsset(asset, stem);
        files.push({
          index,
          sourceUrl: asset.url,
          relativePath: relative(ROOT, destination).split('\\').join('/'),
          fileName: basename(destination)
        });
      } catch (error) {
        errors.push({ index, sourceUrl: asset.url, message: error.message });
      }
    }

    const manifest = {
      version: 1,
      taskId,
      endpointId,
      modelFolder,
      files,
      errors,
      completed: true,
      archivedAt: new Date().toISOString()
    };
    await writeArchiveManifest(manifest);
    return manifest;
  })();

  runtime.archiveLocks.set(taskId, operation);
  try {
    return await operation;
  } finally {
    runtime.archiveLocks.delete(taskId);
  }
}

function withArchiveMetadata(result, manifest) {
  return {
    ...result,
    local_archive: {
      root: 'images',
      modelFolder: manifest.modelFolder,
      files: manifest.files,
      errors: manifest.errors
    }
  };
}

async function finalizeTaskResult(taskId, endpointId, result) {
  if (!taskId) return result;
  const manifest = await archiveTaskOutputs(taskId, endpointId, result);
  return withArchiveMetadata(result, manifest);
}

function resolveManagedArchivePath(relativePath) {
  const target = resolve(ROOT, String(relativePath || ''));
  const rel = relative(IMAGES_DIR, target);
  if (!rel || rel.startsWith('..') || rel.includes('../') || rel.includes('..\\')) return null;
  return target;
}

async function removeTaskArchive(taskIdValue) {
  const taskId = normalizeTaskId(taskIdValue);
  if (runtime.archiveLocks.has(taskId)) await runtime.archiveLocks.get(taskId);
  const manifest = await readArchiveManifest(taskId);
  if (!manifest) return { ok: true, removed: 0, missing: true };

  let removed = 0;
  const failed = [];
  for (const item of manifest.files || []) {
    const target = resolveManagedArchivePath(item.relativePath);
    if (!target) continue;
    try {
      await rm(target, { force: true });
      removed += 1;
    } catch (error) {
      failed.push({ relativePath: item.relativePath, message: error.message });
    }
  }
  if (failed.length) {
    throw Object.assign(new Error(`Unable to remove ${failed.length} managed archive file(s).`), {
      code: 'ARCHIVE_DELETE_FAILED',
      details: failed
    });
  }
  await rm(manifestPath(taskId), { force: true });
  return { ok: true, removed, missing: false };
}

async function runModel(body) {
  if (!keyFromRuntime()) {
    throw Object.assign(new Error('Connect a fal.ai API key before submitting a task.'), { code: 'AUTH_REQUIRED' });
  }
  const endpointId = String(body.endpointId || '');
  if (!endpointId || !endpointId.includes('/')) {
    throw Object.assign(new Error('A valid endpoint ID is required.'), { code: 'INVALID_ENDPOINT' });
  }
  validateInputs(body.inputs || {});
  if (body.taskId) normalizeTaskId(body.taskId);

  return { ok: true, endpointId, result: await submitQueueTask(endpointId, body.inputs || {}) };
}

async function checkKey(key) {
  const previous = runtime.sessionKey;
  runtime.sessionKey = key;
  try {
    await fetchFalJson('https://api.fal.ai/v1/models?limit=1&status=active');
    return true;
  } catch (error) {
    runtime.sessionKey = previous;
    throw error;
  }
}

function uploadFileName(headerValue) {
  if (Array.isArray(headerValue)) headerValue = headerValue[0];
  try {
    return basename(decodeURIComponent(String(headerValue || 'upload.bin'))).slice(0, 180) || 'upload.bin';
  } catch {
    return 'upload.bin';
  }
}

function uploadedUrlFromRun(result) {
  const values = [
    result.data?.cdn_url,
    result.data?.url,
    result.data?.file_url,
    result.data?.asset_url,
    result.data?.data?.cdn_url,
    result.data?.data?.url,
    result.data?.file?.url,
    result.data?.data?.file?.url,
    typeof result.data === 'string' ? result.data : null
  ];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    try {
      const parsed = new URL(value.replaceAll('\\/', '/'));
      if (['http:', 'https:'].includes(parsed.protocol)) return parsed.href;
    } catch {
      // Ignore values that are not complete URLs.
    }
  }
  return null;
}

async function uploadAsset(req) {
  if (!keyFromRuntime()) {
    throw Object.assign(new Error('Connect a fal.ai API key before uploading assets.'), { code: 'AUTH_REQUIRED' });
  }

  const declaredLength = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLength) && (declaredLength < 1 || declaredLength > MAX_UPLOAD_SIZE)) {
    throw Object.assign(new Error('Upload must be between 1 byte and 90 MB.'), { code: 'UPLOAD_TOO_LARGE' });
  }

  const buffer = await readBuffer(req, MAX_UPLOAD_SIZE);
  if (!buffer.length) {
    throw Object.assign(new Error('Upload must contain at least 1 byte.'), { code: 'INVALID_UPLOAD' });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = uploadFileName(req.headers['x-file-name']);
  const fileExtension = extname(fileName).slice(0, 8) || '.bin';
  const temporary = join(UPLOAD_DIR, `${crypto.randomUUID()}${fileExtension}`);
  await writeFile(temporary, buffer);
  try {
    const result = await runGenmedia(['upload', temporary, '--json'], { timeout: 120_000 });
    const url = uploadedUrlFromRun(result);
    if (!url) {
      const diagnostic = String(result.stdout || result.stderr || '').trim().slice(0, 600);
      throw Object.assign(new Error(diagnostic
        ? `fal upload succeeded, but its output did not contain a usable CDN URL: ${diagnostic}`
        : 'fal upload succeeded without returning a usable CDN URL.'), { code: 'UPLOAD_RESPONSE_INVALID' });
    }
    return { ok: true, url, source: 'fal-upload' };
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

async function taskStatus(body) {
  if (!keyFromRuntime()) {
    throw Object.assign(new Error('Connect a fal.ai API key before checking task status.'), { code: 'AUTH_REQUIRED' });
  }
  const endpointId = String(body.endpointId || '');
  const requestId = String(body.requestId || body.request_id || '');
  if (!endpointId || !requestId) {
    throw Object.assign(new Error('Endpoint ID and request ID are required.'), { code: 'INVALID_STATUS_REQUEST' });
  }
  if (body.taskId) normalizeTaskId(body.taskId);

  const requestBase = queueRequestBase(endpointId, requestId);
  const queue = {
    requestId,
    statusUrl: trustedQueueUrl(body.statusUrl || body.status_url, `${requestBase}/status`),
    responseUrl: trustedQueueUrl(body.responseUrl || body.response_url, requestBase),
    cancelUrl: trustedQueueUrl(body.cancelUrl || body.cancel_url, `${requestBase}/cancel`)
  };

  if (body.action === 'cancel') {
    const cancellation = await fetchFalJson(queue.cancelUrl, { method: 'PUT', timeout: 60_000 });
    return {
      ok: true,
      endpointId,
      requestId,
      result: queueTaskResult(endpointId, { ...cancellation, status: 'CANCELLED', request_id: requestId }, queue)
    };
  }

  const status = queueTaskResult(endpointId, await fetchFalJson(queue.statusUrl, { timeout: 60_000 }), queue);
  if (String(status.status || '').toUpperCase() !== 'COMPLETED') {
    return { ok: true, endpointId, requestId, result: status };
  }

  let output;
  try {
    output = await fetchFalJson(status.response_url, { timeout: 60_000 });
  } catch (error) {
    if (error.code !== 'FAL_HTTP_ERROR') throw error;
    return {
      ok: true,
      endpointId,
      requestId,
      result: falTaskFailureResult(endpointId, requestId, queue, error, status)
    };
  }
  const completed = queueTaskResult(endpointId, { ...output, ...status, status: 'COMPLETED', request_id: requestId }, queue);
  const result = await finalizeTaskResult(body.taskId, endpointId, completed);
  return { ok: true, endpointId, requestId, result };
}

async function serveStatic(pathname, res) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const target = resolve(PUBLIC_DIR, `.${requested}`);
  const rel = relative(PUBLIC_DIR, target);
  if (rel.startsWith('..') || rel.includes('../') || rel.includes('..\\')) {
    sendJson(res, 403, errorPayload('FORBIDDEN', 'Invalid path.'));
    return;
  }
  try {
    const data = await readFile(target);
    const type = MIME_TYPES[extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  } catch {
    sendJson(res, 404, errorPayload('NOT_FOUND', 'Resource not found.'));
  }
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  try {
    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        service: 'fal-playground-demo',
        port: PORT,
        cli: 'genmedia',
        cliPath: GENMEDIA,
        hasKey: Boolean(keyFromRuntime()),
        keySource: authSource(),
        sessionOnly: false,
        archiveRoot: IMAGES_DIR
      });
      return;
    }

    if (pathname === '/api/auth' && req.method === 'POST') {
      const body = await readJson(req);
      const key = String(body.key || '').trim();
      if (!key) {
        await deleteSavedKey();
        sendJson(res, 200, { ok: true, hasKey: Boolean(process.env.FAL_KEY), keySource: authSource() });
        return;
      }
      await checkKey(key);
      await saveKey(key);
      sendJson(res, 200, { ok: true, hasKey: true, keySource: 'saved', sessionOnly: false });
      return;
    }

    if (pathname === '/api/balance' && req.method === 'GET') {
      sendJson(res, 200, await accountBalance());
      return;
    }

    if (pathname === '/api/proxy' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, proxy: publicProxySettings() });
      return;
    }

    if (pathname === '/api/proxy' && req.method === 'POST') {
      const body = await readJson(req);
      const settings = validateProxySettings(proxyInputWithPassword(body));
      await saveProxySettings(settings);
      sendJson(res, 200, { ok: true, proxy: publicProxySettings() });
      return;
    }

    if (pathname === '/api/proxy/reset' && req.method === 'POST') {
      await resetProxySettings();
      sendJson(res, 200, { ok: true, proxy: publicProxySettings() });
      return;
    }

    if (pathname === '/api/proxy/test' && req.method === 'POST') {
      const body = await readJson(req);
      const candidate = validateProxySettings(proxyInputWithPassword(body.settings));
      sendJson(res, 200, await testProxyConnection(body.url, candidate));
      return;
    }

    if (pathname === '/api/models' && req.method === 'GET') {
      sendJson(res, 200, await listModels(Object.fromEntries(url.searchParams.entries())));
      return;
    }

    if (pathname.startsWith('/api/schema/') && req.method === 'GET') {
      const endpointId = decodeURIComponent(pathname.slice('/api/schema/'.length));
      if (!endpointId) throw Object.assign(new Error('Endpoint ID is required.'), { code: 'INVALID_ENDPOINT' });
      sendJson(res, 200, await getSchema(endpointId));
      return;
    }

    if (pathname === '/api/run' && req.method === 'POST') {
      sendJson(res, 200, await runModel(await readJson(req)));
      return;
    }

    if (pathname === '/api/upload' && req.method === 'POST') {
      sendJson(res, 200, await uploadAsset(req));
      return;
    }

    if (pathname === '/api/task/status' && req.method === 'POST') {
      sendJson(res, 200, await taskStatus(await readJson(req)));
      return;
    }

    if (pathname === '/api/task/asset/download' && req.method === 'POST') {
      await downloadTaskAsset(req, res);
      return;
    }

    if (pathname === '/api/task/archive/delete' && req.method === 'POST') {
      const body = await readJson(req);
      sendJson(res, 200, await removeTaskArchive(body.taskId));
      return;
    }

    if (pathname.startsWith('/api/status/') && req.method === 'GET') {
      const parts = pathname.slice('/api/status/'.length).split('/').map(decodeURIComponent);
      if (parts.length < 2) throw Object.assign(new Error('Endpoint ID and request ID are required.'), { code: 'INVALID_STATUS_REQUEST' });
      const endpointId = parts.slice(0, -1).join('/');
      const requestId = parts.at(-1);
      sendJson(res, 200, await taskStatus({
        endpointId,
        requestId,
        taskId: url.searchParams.get('taskId'),
        action: url.searchParams.get('action')
      }));
      return;
    }

    if (pathname.startsWith('/api/')) {
      sendJson(res, 404, errorPayload('NOT_FOUND', 'API route not found.'));
      return;
    }

    await serveStatic(pathname, res);
  } catch (error) {
    const code = error.code || 'INTERNAL_ERROR';
    const status = code === 'AUTH_REQUIRED'
      ? 401
      : code === 'PROXY_DISABLED'
        ? 409
        : code === 'INVALID_JSON' || code.startsWith('INVALID_')
          ? 400
          : code === 'FAL_HTTP_ERROR'
            ? (error.status || 502)
            : 500;
    sendJson(res, status, errorPayload(code, error.message || 'Unexpected server error.', error.details ? { details: error.details } : {}));
  }
}

await mkdir(RUNTIME_DIR, { recursive: true });
await mkdir(IMAGES_DIR, { recursive: true });
await mkdir(TASK_ARCHIVE_DIR, { recursive: true });
await loadProxySettings();
await loadSavedKey();

const server = createServer(handle);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`fal playground demo listening at http://127.0.0.1:${PORT}`);
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
