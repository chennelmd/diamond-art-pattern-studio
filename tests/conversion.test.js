const assert = require('node:assert/strict');
const { buildAdaptivePalette } = require('../conversion.js');

function pixels(colors) {
  return new Uint8ClampedArray(colors.flatMap(color => [...color, 255]));
}

const flatArtwork = pixels([
  [240, 20, 20], [240, 20, 20], [20, 40, 220], [20, 40, 220],
]);
assert.deepEqual(
  buildAdaptivePalette(flatArtwork, () => true, 8),
  [[240, 20, 20], [20, 40, 220]],
  'Exact illustration colors should remain unchanged when they fit the limit.',
);

const gradient = pixels(Array.from({ length: 256 }, (_, value) => [value, value, value]));
const reduced = buildAdaptivePalette(gradient, () => true, 8);
assert.equal(reduced.length, 8);
assert.ok(reduced[0][0] < reduced.at(-1)[0] || reduced[0][0] > reduced.at(-1)[0]);
assert.ok(new Set(reduced.map(color => color[0])).size === 8, 'A gradient should use the full adaptive palette.');

const repeated = buildAdaptivePalette(gradient, () => true, 8);
assert.deepEqual(repeated, reduced, 'Adaptive reduction must be deterministic.');

const dominantWhite = pixels([
  ...Array.from({ length: 900 }, () => [255, 255, 255]),
  ...Array.from({ length: 100 }, (_, value) => [value * 2, 40, 70]),
]);
const backgroundAware = buildAdaptivePalette(dominantWhite, () => true, 16);
assert.deepEqual(backgroundAware[0], [255, 255, 255], 'A dominant flat background should retain its exact color.');
assert.equal(
  backgroundAware.filter(color => color.every(channel => channel > 245)).length,
  1,
  'A dominant white background must consume only one palette slot.',
);
assert.ok(
  backgroundAware.filter(color => color.some(channel => channel < 180)).length >= 10,
  'Most palette slots should remain available to describe the subject.',
);

console.log('adaptive color conversion tests passed');
