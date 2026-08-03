import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.FAL_WORKBENCH_URL || 'http://127.0.0.1:14726';
const endpoints = [
  'fal-ai/nano-banana-2/edit',
  'fal-ai/nano-banana-pro/edit',
  'openai/gpt-image-2/edit',
];

function resolveRef(schema, root) {
  if (!schema || typeof schema !== 'object') return schema;
  if (schema.$ref?.startsWith('#/')) {
    return schema.$ref.slice(2).split('/').reduce((value, key) => value?.[key], root) || schema;
  }
  if (schema.allOf) {
    return schema.allOf.reduce((merged, entry) => {
      const resolved = resolveRef(entry, root) || {};
      return {
        ...merged,
        ...resolved,
        properties: { ...(merged.properties || {}), ...(resolved.properties || {}) },
        required: [...new Set([...(merged.required || []), ...(resolved.required || [])])],
      };
    }, {});
  }
  return schema;
}

function inputSchema(openapi) {
  for (const path of Object.values(openapi?.paths || {})) {
    for (const method of ['post', 'put', 'patch']) {
      const media = path?.[method]?.requestBody?.content?.['application/json'];
      if (media?.schema) return resolveRef(media.schema, openapi);
    }
  }
  return null;
}

const report = {};
for (const endpoint of endpoints) {
  const response = await fetch(`${BASE_URL}/api/schema/${encodeURIComponent(endpoint)}`);
  const payload = await response.json();
  const schema = inputSchema(payload.schema || {});
  report[endpoint] = {
    status: response.status,
    source: payload.source,
    live: payload.live,
    required: schema?.required || [],
    properties: Object.fromEntries(Object.entries(schema?.properties || {}).map(([name, property]) => [name, property])),
  };
  await writeFile(
    join(ROOT, `schema-${endpoint.replaceAll('/', '-')}.json`),
    `${JSON.stringify(payload, null, 2)}\n`
  );
}

await writeFile(join(ROOT, 'schema-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(report).map(([endpoint, item]) => [endpoint, {
  status: item.status,
  source: item.source,
  live: item.live,
  fields: Object.keys(item.properties),
  keyFields: Object.fromEntries(
    ['prompt', 'system_prompt', 'image_url', 'image_urls', 'image_size', 'resolution', 'aspect_ratio', 'thinking_level']
      .filter((name) => item.properties[name])
      .map((name) => [name, item.properties[name]])
  ),
}])), null, 2));
