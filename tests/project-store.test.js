const assert = require('node:assert/strict');
const { normalizeProject } = require('../project-store.js');

const record = normalizeProject({ id: 'lion', name: ' Lion Pattern ', pattern: { cells: [0, 1] } });
assert.equal(record.id, 'lion');
assert.equal(record.name, 'Lion Pattern');
assert.equal(record.version, 1);
assert.ok(record.createdAt);
assert.ok(record.updatedAt);
assert.throws(() => normalizeProject({ id: 'missing-pattern', name: 'Invalid' }), /pattern/);

console.log('project store tests passed');
