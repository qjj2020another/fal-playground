import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('./public/app.js', import.meta.url), 'utf8');
const end = source.indexOf('init();');
assert.ok(end > 0, 'Unable to isolate app initialization.');

function stubElement() {
  return {
    addEventListener() {},
    append() {},
    classList: { add() {}, remove() {}, toggle() {} },
    querySelector() { return stubElement(); },
    querySelectorAll() { return []; },
    setAttribute() {},
    style: {},
    textContent: '',
    value: ''
  };
}

const context = {
  console,
  CSS: { escape: (value) => String(value) },
  crypto: { randomUUID: () => 'test-id' },
  document: {
    createElement: stubElement,
    querySelector: stubElement,
    querySelectorAll: () => []
  },
  localStorage: { getItem: () => null, setItem() {} },
  navigator: { clipboard: { writeText: async () => {} } },
  setTimeout,
  clearTimeout,
  window: { setTimeout, clearTimeout }
};
vm.createContext(context);
vm.runInContext(`${source.slice(0, end)}\nthis.__setTestState = (patch) => Object.assign(state, patch);\nthis.__helpers = { customImageSizeConfig, renderCustomImageSizeControl, usesGptImage2CustomSizeRules, validateCustomImageSize };`, context);

const setTestState = context.__setTestState;
const { customImageSizeConfig, renderCustomImageSizeControl, usesGptImage2CustomSizeRules, validateCustomImageSize } = context.__helpers;

const root = {
  components: {
    schemas: {
      ImageSize: {
        type: 'object',
        properties: {
          width: { type: 'integer', default: 512, exclusiveMinimum: 0, maximum: 14142 },
          height: { type: 'integer', default: 512, exclusiveMinimum: 0, maximum: 14142 }
        }
      }
    }
  }
};
const imageSizeProperty = {
  anyOf: [
    { $ref: '#/components/schemas/ImageSize' },
    { type: 'string', enum: ['square_hd', 'landscape_4_3'] }
  ],
  default: 'landscape_4_3',
  title: 'Image Size'
};

setTestState({ schema: root, inputs: { image_size: 'landscape_4_3' }, selectedModel: { endpoint_id: 'fal-ai/flux/dev' } });
const genericConfig = customImageSizeConfig('image_size', imageSizeProperty);
assert.ok(genericConfig, 'A schema object union should expose a custom image-size control.');
assert.equal(genericConfig.usesGptImage2Rules, false);
assert.equal(genericConfig.width.max, 14142);
assert.equal(genericConfig.width.step, 1);
const genericMarkup = renderCustomImageSizeControl('image_size', imageSizeProperty, genericConfig, false);
assert.match(genericMarkup, /data-gpt-image-2-rules="false"/);
assert.match(genericMarkup, /max="14142"/);
assert.match(genericMarkup, /步进 1/);
assert.equal(validateCustomImageSize(1023, 777, {
  minWidth: 1,
  maxWidth: 14142,
  widthStep: 1,
  minHeight: 1,
  maxHeight: 14142,
  heightStep: 1,
  usesGptImage2Rules: false
}), '');

assert.equal(usesGptImage2CustomSizeRules('openai/gpt-image-2/edit fal-ai/gpt-image-2/edit'), true);
assert.equal(usesGptImage2CustomSizeRules('fal-ai/gpt-image-2'), true);
assert.equal(usesGptImage2CustomSizeRules('fal-ai/gpt-image-1.5'), false);

setTestState({ schema: root, inputs: { image_size: { width: 1024, height: 1024 } }, selectedModel: { endpoint_id: 'openai/gpt-image-2/edit' } });
const gptConfig = customImageSizeConfig('image_size', imageSizeProperty);
assert.ok(gptConfig);
assert.equal(gptConfig.usesGptImage2Rules, true);
const gptMarkup = renderCustomImageSizeControl('image_size', imageSizeProperty, gptConfig, false);
assert.match(gptMarkup, /data-gpt-image-2-rules="true"/);
assert.match(gptMarkup, /16 px 的倍数/);
assert.equal(validateCustomImageSize(1024, 1024, {
  minWidth: 1,
  maxWidth: 14142,
  widthStep: 1,
  minHeight: 1,
  maxHeight: 14142,
  heightStep: 1,
  usesGptImage2Rules: true
}), '');
assert.match(validateCustomImageSize(1023, 1024, {
  minWidth: 1,
  maxWidth: 14142,
  widthStep: 1,
  minHeight: 1,
  maxHeight: 14142,
  heightStep: 1,
  usesGptImage2Rules: true
}), /16 px/);

const enumOnlyProperty = {
  type: 'string',
  enum: ['1024x1024', '1536x1024', '1024x1536'],
  default: '1024x1024'
};
assert.equal(customImageSizeConfig('image_size', enumOnlyProperty), null);
assert.equal(customImageSizeConfig('resolution', imageSizeProperty), null);

console.log(JSON.stringify({
  genericSchemaDimensions: 'ok',
  gptImage2Rules: 'ok',
  enumOnlyFallback: 'ok'
}, null, 2));
