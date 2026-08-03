import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:14726';

async function request(path, options) {
  const response = await fetch(`${base}${path}`, options);
  const payload = await response.json();
  return { response, payload };
}

const health = await request('/api/health');
assert.equal(health.response.status, 200);
assert.equal(health.payload.ok, true);
assert.equal(health.payload.port, 14726);
assert.equal(typeof health.payload.hasKey, 'boolean');

const models = await request('/api/models?limit=10');
assert.equal(models.response.status, 200);
assert.equal(models.payload.ok, true);
assert.ok(Array.isArray(models.payload.models));
assert.ok(models.payload.models.length > 0);
assert.ok(models.payload.models.every((model) => model.endpoint_id));

const schema = await request('/api/schema/fal-ai%2Fflux%2Fdev');
assert.equal(schema.response.status, 200);
assert.equal(schema.payload.ok, true);
assert.equal(schema.payload.endpointId, 'fal-ai/flux/dev');
assert.ok(schema.payload.schema);

const run = await request('/api/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ endpointId: health.payload.hasKey ? 'invalid-endpoint' : 'fal-ai/flux/dev', inputs: { prompt: 'test' } })
});
if (health.payload.hasKey) {
  assert.equal(run.response.status, 400);
  assert.equal(run.payload.error.code, 'INVALID_ENDPOINT');
} else {
  assert.equal(run.response.status, 401);
  assert.equal(run.payload.error.code, 'AUTH_REQUIRED');
}

const page = await fetch(`${base}/`);
const html = await page.text();
assert.equal(page.status, 200);
assert.match(html, /FAL Workbench/);
assert.match(html, /model-search/);

console.log(JSON.stringify({
  health: 'ok',
  catalog: { source: models.payload.source, live: models.payload.live, count: models.payload.models.length },
  schema: { source: schema.payload.source, live: schema.payload.live, endpointId: schema.payload.endpointId },
  authGate: run.payload.error.code,
  page: 'ok'
}, null, 2));
