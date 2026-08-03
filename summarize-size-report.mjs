import { readFile } from 'node:fs/promises';

const report = JSON.parse(await readFile(new URL('./schema-image-size-report.json', import.meta.url), 'utf8'));
const all = [...report.customImageSizeModels, ...report.enumOnlyImageSizeModels, ...report.otherSizeModels];
const fieldCounts = new Map();
for (const model of all) {
  for (const field of model.sizeFields || []) fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
}
const interesting = all
  .filter((model) => /width|height|dimensions|size|resolution|aspect|megapixel/i.test((model.sizeFields || []).join(' ')))
  .map((model) => ({
    endpointId: model.endpointId,
    title: model.title,
    live: model.live,
    source: model.schemaSource,
    fields: model.sizeFields,
    imageSize: model.imageSize ? {
      custom: model.imageSize.acceptsCustomDimensions,
      presets: model.imageSize.presets,
      width: model.imageSize.width,
      height: model.imageSize.height
    } : null
  }));
console.log(JSON.stringify({
  summary: report.summary,
  fieldCounts: Object.fromEntries([...fieldCounts.entries()].sort((a, b) => b[1] - a[1])),
  interesting
}, null, 2));
