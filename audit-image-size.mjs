
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.FAL_WORKBENCH_URL || 'http://127.0.0.1:14726';
const ROOT = dirname(fileURLToPath(import.meta.url));
const CATEGORIES = ['text-to-image', 'image-to-image'];
const REPORT_FILE = join(ROOT, 'schema-image-size-report.json');
const CONCURRENCY = 8;

function resolveSchemaRef(schema, root) {
  if (!schema || typeof schema !== 'object') return schema;
  if (schema.$ref?.startsWith('#/')) {
    return schema.$ref.slice(2).split('/').reduce((value, key) => value?.[key], root) || schema;
  }
  if (Array.isArray(schema.allOf)) {
    return schema.allOf.reduce((merged, entry) => {
      const resolved = resolveSchemaRef(entry, root) || {};
      return {
        ...merged,
        ...resolved,
        properties: { ...(merged.properties || {}), ...(resolved.properties || {}) },
        required: [...new Set([...(merged.required || []), ...(resolved.required || [])])]
      };
    }, {});
  }
  return schema;
}

function inputSchema(openapi) {
  for (const pathItem of Object.values(openapi?.paths || {})) {
    for (const method of ['post', 'put', 'patch']) {
      const content = pathItem?.[method]?.requestBody?.content || {};
      for (const media of Object.values(content)) {
        if (media?.schema) return resolveSchemaRef(media.schema, openapi);
      }
    }
  }
  return null;
}

function collectVariants(property, root, variants = [], seen = new Set()) {
  const resolved = resolveSchemaRef(property, root) || property;
  if (!resolved || typeof resolved !== 'object' || seen.has(resolved)) return variants;
  seen.add(resolved);
  variants.push(resolved);
  for (const key of ['anyOf', 'oneOf']) {
    for (const entry of resolved[key] || []) collectVariants(entry, root, variants, seen);
  }
  return variants;
}

function enumOptions(property, root) {
  const values = [];
  for (const variant of collectVariants(property, root)) {
    for (const value of variant.enum || []) {
      if (value !== null && !values.some((entry) => Object.is(entry, value))) values.push(value);
    }
  }
  return values;
}

function propertyDefault(property, root) {
  return collectVariants(property, root).find((variant) => variant.default !== undefined)?.default;
}

function numericConstraints(property, root) {
  const variants = collectVariants(property, root);
  const result = {};
  for (const name of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf']) {
    const value = variants.find((variant) => variant[name] !== undefined)?.[name];
    if (value !== undefined) result[name] = value;
  }
  const defaultValue = propertyDefault(property, root);
  if (defaultValue !== undefined) result.default = defaultValue;
  return result;
}

function inspectImageSize(property, root) {
  const variants = collectVariants(property, root);
  const objectVariant = variants.find((variant) => {
    const resolved = resolveSchemaRef(variant, root) || variant;
    return resolved.type === 'object' && resolved.properties?.width && resolved.properties?.height;
  });
  const objectSchema = objectVariant ? (resolveSchemaRef(objectVariant, root) || objectVariant) : null;
  return {
    title: property.title || null,
    description: property.description || null,
    default: propertyDefault(property, root) ?? null,
    presets: enumOptions(property, root),
    acceptsCustomDimensions: Boolean(objectSchema),
    width: objectSchema ? numericConstraints(objectSchema.properties.width, root) : null,
    height: objectSchema ? numericConstraints(objectSchema.properties.height, root) : null
  };
}

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  }
  return payload;
}

async function listCategory(category) {
  const models = [];
  const cursors = new Set();
  let cursor = null;
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ category, limit: '100', status: 'active' });
    if (cursor) params.set('cursor', cursor);
    const payload = await getJson(`/api/models?${params}`);
    for (const model of payload.models || []) {
      if (model.endpoint_id) models.push(model);
    }
    const next = payload.nextCursor || null;
    if (!payload.hasMore || !next || cursors.has(next)) break;
    cursors.add(next);
    cursor = next;
  }
  return models;
}

async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const catalogLists = await Promise.all(CATEGORIES.map(listCategory));
const catalog = [...new Map(catalogLists.flat().map((model) => [model.endpoint_id, model])).values()];

const models = await mapConcurrent(catalog, CONCURRENCY, async (model) => {
  try {
    const payload = await getJson(`/api/schema/${encodeURIComponent(model.endpoint_id)}`);
    const schema = inputSchema(payload.schema);
    const properties = schema?.properties || {};
    const sizeFields = Object.keys(properties).filter((name) => (
      /^(?:image_)?(?:size|width|height|resolution|aspect_ratio|dimensions|megapixels)$/i.test(name)
      || /_(?:size|width|height|resolution|aspect_ratio|dimensions|megapixels)$/i.test(name)
    ));
    return {
      endpointId: model.endpoint_id,
      title: model.title || model.endpoint_id,
      category: model.category,
      schemaSource: payload.source,
      live: payload.live,
      sizeFields,
      imageSize: properties.image_size ? inspectImageSize(properties.image_size, payload.schema) : null
    };
  } catch (error) {
    return {
      endpointId: model.endpoint_id,
      title: model.title || model.endpoint_id,
      category: model.category,
      error: error.message
    };
  }
});

const liveModels = models.filter((model) => model.live);
const imageSizeModels = liveModels.filter((model) => model.imageSize);
const customImageSizeModels = imageSizeModels.filter((model) => model.imageSize.acceptsCustomDimensions);
const enumOnlyImageSizeModels = imageSizeModels.filter((model) => !model.imageSize.acceptsCustomDimensions);
const otherSizeModels = liveModels.filter((model) => !model.imageSize && model.sizeFields?.length);
const demoFallbackModels = models.filter((model) => model.live === false);
const failures = models.filter((model) => model.error);

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  categories: CATEGORIES,
  summary: {
    catalogModels: catalog.length,
    schemasRead: models.length - failures.length,
    schemaFailures: failures.length,
    imageSizeModels: imageSizeModels.length,
    customImageSizeModels: customImageSizeModels.length,
    enumOnlyImageSizeModels: enumOnlyImageSizeModels.length,
    otherSizeModels: otherSizeModels.length,
    demoFallbackModels: demoFallbackModels.length
  },
  customImageSizeModels,
  enumOnlyImageSizeModels,
  otherSizeModels,
  demoFallbackModels,
  failures
};

await writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  report: REPORT_FILE,
  ...report.summary,
  customImageSizeEndpoints: customImageSizeModels.map((model) => model.endpointId),
  failures: failures.map((model) => ({ endpointId: model.endpointId, error: model.error }))
}, null, 2));
