import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { patternFor, relPathFrom } from '../patterns';

test('patternFor wraps a relative path', () => {
	assert.equal(patternFor('.containers'), '**/.containers/**');
	assert.equal(patternFor('app/var'), '**/app/var/**');
});

test('relPathFrom round-trips plain patterns', () => {
	assert.equal(relPathFrom(patternFor('app/var'), true), 'app/var');
});

test('relPathFrom ignores disabled entries', () => {
	assert.equal(relPathFrom('**/cache/**', false), undefined);
});

test('relPathFrom ignores foreign glob patterns', () => {
	assert.equal(relPathFrom('**/.git/objects/**', true), '.git/objects');
	assert.equal(relPathFrom('**/*.log/**', true), undefined);
	assert.equal(relPathFrom('**/{a,b}/**', true), undefined);
	assert.equal(relPathFrom('**/node_modules/*/**', true), undefined);
	assert.equal(relPathFrom('some/path', true), undefined);
});
