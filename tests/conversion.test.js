const assert = require('node:assert/strict');
const { applyBackgroundTreatment, buildAdaptivePalette, interpolateShades, mapPaletteToReference, selectConnectedBackground, subtleSolidShades } = require('../conversion.js');
const dmcPalette = require('../dmc-colors.js');

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

assert.equal(dmcPalette.length, 447, 'The diamond-drill reference must contain 447 DMC colors.');
assert.equal(new Set(dmcPalette.map(color => color.code)).size, 447, 'DMC codes must be unique.');
assert.deepEqual(dmcPalette.find(color => color.code === '310').rgb, [0, 0, 0]);
assert.deepEqual(dmcPalette.find(color => color.code === 'B5200').rgb, [255, 255, 255]);
const referenceMapping = mapPaletteToReference([[1, 1, 1], [254, 254, 254]], dmcPalette);
assert.deepEqual(referenceMapping.map(color => color.code), ['310', 'B5200']);

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

assert.deepEqual(
  interpolateShades('#000000', '#ffffff', 3),
  [[0, 0, 0], [128, 128, 128], [255, 255, 255]],
  'Manual shades should interpolate evenly between the chosen colors.',
);

const connectedPixels = pixels([
  [240, 100, 60], [245, 120, 70], [250, 140, 80],
  [20, 120, 40], [22, 125, 42], [24, 130, 44],
]);
const connectedMask = selectConnectedBackground(connectedPixels, 3, 2, 0, 0, 30);
assert.deepEqual([...connectedMask], [1, 1, 1, 0, 0, 0], 'Selection should stay in the connected background region.');

const edgeProtectedPixels = pixels([
  [240, 130, 90], [242, 132, 92], [244, 134, 94], [246, 136, 96], [248, 138, 98],
  [240, 130, 90], [235, 125, 87], [175, 85, 60], [100, 45, 35], [70, 30, 25],
  [240, 130, 90], [242, 132, 92], [244, 134, 94], [246, 136, 96], [248, 138, 98],
]);
const edgeProtectedMask = selectConnectedBackground(edgeProtectedPixels, 5, 3, 0, 0, 60);
assert.equal(edgeProtectedMask[9], 0, 'High tolerance must not leak through anti-aliased artwork edges.');
assert.equal(edgeProtectedMask[14], 1, 'Low-contrast background gradients should remain connected around an edge.');

const solidPixels = pixels([[200, 80, 40], [210, 90, 50], [20, 120, 40]]);
applyBackgroundTreatment(solidPixels, new Uint8Array([1, 1, 0]), {
  mode: 'solid', solidColor: '#336699', solidStyle: 'flat', shadeCount: 4,
});
assert.deepEqual([...solidPixels.slice(0, 8)], [51, 102, 153, 255, 51, 102, 153, 255]);
assert.deepEqual([...solidPixels.slice(8, 12)], [20, 120, 40, 255], 'Unselected subject pixels must not change.');

assert.deepEqual(subtleSolidShades('#804020'), [[119, 60, 30], [128, 64, 32], [137, 77, 48]]);
const depthPixels = pixels([[20, 20, 20], [128, 128, 128], [240, 240, 240]]);
applyBackgroundTreatment(depthPixels, new Uint8Array([1, 1, 1]), {
  mode: 'solid', solidColor: '#804020', solidStyle: 'subtle', shadeCount: 4,
});
assert.deepEqual([...depthPixels.filter((_, index) => index % 4 !== 3)], [119, 60, 30, 128, 64, 32, 137, 77, 48]);

console.log('adaptive color conversion tests passed');
