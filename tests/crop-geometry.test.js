const assert = require('node:assert/strict');
const { calculateCropRegion } = require('../geometry.js');

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

console.log('crop geometry tests passed');
