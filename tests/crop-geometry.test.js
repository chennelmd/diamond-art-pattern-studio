const assert = require('node:assert/strict');
const { calculateCropRegion, calculateLabelInterval, calculatePrintLayout, calculateSizeTiers } = require('../geometry.js');

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.0001, `${actual} should equal ${expected}`);
}

const squareToPortrait = calculateCropRegion(1000, 1000, 3 / 4, 1, 0.5, 0.5);
close(squareToPortrait.width, 750);
close(squareToPortrait.height, 1000);
close(squareToPortrait.x, 125);
close(squareToPortrait.y, 0);

const landscapeToPortrait = calculateCropRegion(1600, 900, 3 / 4, 1, 1, 0.5);
close(landscapeToPortrait.width, 675);
close(landscapeToPortrait.height, 900);
close(landscapeToPortrait.x, 925);

const zoomed = calculateCropRegion(1000, 1000, 1, 2, 0.5, 0.5);
close(zoomed.width, 500);
close(zoomed.height, 500);
close(zoomed.x, 250);
close(zoomed.y, 250);

const printLayout = calculatePrintLayout(30, 40, 2.5, { dpi: 300 });
assert.equal(printLayout.columns, 120);
assert.equal(printLayout.rows, 160);
close(printLayout.exactWidthIn, 300 / 25.4);
close(printLayout.exactHeightIn, 400 / 25.4);
assert.equal(printLayout.recommendedWidthIn, 12);
assert.equal(printLayout.recommendedHeightIn, 16);
assert.equal(printLayout.canvasWidthPx, 3600);
assert.equal(printLayout.canvasHeightPx, 4800);
assert.equal(printLayout.compatible, true);
close(printLayout.marginXIn, (12 - 300 / 25.4) / 2);

const incompatible = calculatePrintLayout(30, 40, 2.5, { printWidthIn: 11, printHeightIn: 16 });
assert.equal(incompatible.compatible, false);
assert.ok(incompatible.marginXIn < 0);

const decimalInches = calculatePrintLayout(42.5, 42.5, 2.5);
assert.equal(decimalInches.columns, 170);
assert.equal(decimalInches.rows, 170);
close(decimalInches.exactWidthIn, 425 / 25.4);
assert.equal(decimalInches.recommendedWidthIn, 17, 'A 16.73-inch diamond area needs a 17-inch print file.');
assert.equal(decimalInches.recommendedHeightIn, 17);

const rounded = calculatePrintLayout(30, 40, 2.8, { roundingMode: 'floor', dpi: 150 });
assert.equal(rounded.columns, 107);
assert.equal(rounded.rows, 142);
assert.equal(rounded.activeWidthPx, Math.round(107 * 2.8 / 25.4 * 150));
assert.throws(() => calculatePrintLayout(30, 40, 0), /positive/);

const squareTiers = calculateSizeTiers(170, 1, 2.5);
assert.deepEqual(squareTiers.map(tier => [tier.columns, tier.rows]), [[150, 150], [170, 170], [190, 190]]);
assert.deepEqual(squareTiers.map(tier => tier.widthCm), [37.5, 42.5, 47.5]);

const largeDrillTiers = calculateSizeTiers(170, 1, 2.8);
assert.deepEqual(largeDrillTiers.map(tier => Number(tier.widthCm.toFixed(1))), [42, 47.6, 53.2]);

const portraitTiers = calculateSizeTiers(100, 3 / 4, 2.5);
assert.deepEqual(portraitTiers.map(tier => [tier.columns, tier.rows]), [[80, 107], [100, 134], [120, 160]]);
assert.throws(() => calculateSizeTiers(170, 1, 0), /positive/);

assert.equal(calculateLabelInterval(4), 10);
assert.equal(calculateLabelInterval(12), 2);
assert.equal(calculateLabelInterval(30), 1);
assert.throws(() => calculateLabelInterval(0), /positive/);

console.log('crop geometry tests passed');
