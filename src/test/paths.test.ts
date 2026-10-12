import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'path';
import { isInside, relativePosix } from '../paths';

test('relativePosix joins windows segments with a slash', () => {
	assert.equal(relativePosix('C:\\work\\api', 'C:\\work\\api\\app\\var', path.win32), 'app/var');
});

test('relativePosix works with posix paths', () => {
	assert.equal(relativePosix('/work/api', '/work/api/.containers', path.posix), '.containers');
});

test('isInside accepts nested paths only', () => {
	assert.equal(isInside('app/var'), true);
	assert.equal(isInside(''), false);
	assert.equal(isInside('..'), false);
	assert.equal(isInside('../other'), false);
});

test('isInside rejects a different windows drive', () => {
	const rel = relativePosix('C:\\work\\api', 'D:\\data', path.win32);
	assert.equal(isInside(rel), false);
});
