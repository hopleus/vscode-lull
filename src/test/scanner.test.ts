import { test, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { scan } from '../scanner';

let root: string;

function fill(rel: string, count: number): void {
	const dir = path.join(root, rel);
	mkdirSync(dir, { recursive: true });
	for (let i = 0; i < count; i++) {
		writeFileSync(path.join(dir, `f${i}`), '');
	}
}

before(() => {
	root = mkdtempSync(path.join(tmpdir(), 'lull-'));
	execFileSync('git', ['init', '-q'], { cwd: root });
	writeFileSync(path.join(root, '.gitignore'), '.containers/\napp/var/\nsmall/\nnode_modules/\ncache/\n');
	fill('.containers/db/nested', 30);
	fill('.containers/rustfs', 30);
	fill('app/var', 25);
	writeFileSync(path.join(root, 'app', 'kept.php'), '');
	fill('small', 3);
	fill('node_modules/pkg', 100);
	fill('cache/node_modules', 100);
	fill('src', 100);
});

after(() => rmSync(root, { recursive: true, force: true }));

test('finds ignored folders over the threshold, counting nested files', async () => {
	const found = await scan(root, 20, ['node_modules']);
	assert.deepEqual(found.map(c => c.relPath).sort(), ['.containers', 'app/var']);
});

test('skips ignored folders under the threshold', async () => {
	const found = await scan(root, 20, ['node_modules']);
	assert.ok(!found.some(c => c.relPath === 'small'));
});

test('never returns tracked or untracked non-ignored folders', async () => {
	const found = await scan(root, 20, ['node_modules']);
	assert.ok(!found.some(c => c.relPath === 'src'));
});

test('respects neverExclude by name at any depth', async () => {
	const found = await scan(root, 20, ['node_modules']);
	assert.ok(!found.some(c => c.relPath.split('/').includes('node_modules')));
	const all = await scan(root, 20, []);
	assert.ok(all.some(c => c.relPath === 'node_modules'));
});

test('skips a folder that contains a protected folder', async () => {
	const found = await scan(root, 20, ['node_modules']);
	assert.ok(!found.some(c => c.relPath === 'cache'));
});

test('stops counting at the threshold', async () => {
	const found = await scan(root, 20, ['node_modules']);
	for (const c of found) {
		assert.equal(c.files, 20);
	}
});

test('rejects outside a git repository', async () => {
	const plain = mkdtempSync(path.join(tmpdir(), 'lull-plain-'));
	try {
		await assert.rejects(scan(plain, 20, []));
	} finally {
		rmSync(plain, { recursive: true, force: true });
	}
});

test('aborts when git exceeds the timeout', async () => {
	await assert.rejects(scan(root, 20, [], 1));
});
