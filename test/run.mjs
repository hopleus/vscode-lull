import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import process from 'node:process';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'out-test', 'integration');

execFileSync('node', ['esbuild.mjs'], { cwd: root, stdio: 'inherit' });
rmSync(outDir, { recursive: true, force: true });
await build({
	entryPoints: {
		commands: join(root, 'src/test/integration/commands.test.ts'),
		auto: join(root, 'src/test/integration/auto.test.ts'),
		multiroot: join(root, 'src/test/integration/multiroot.test.ts'),
	},
	outdir: outDir,
	outExtension: { '.js': '.test.js' },
	bundle: true,
	platform: 'node',
	format: 'cjs',
	external: ['vscode'],
	logLevel: 'warning',
});

function fixture(settings) {
	const dir = realpathSync(mkdtempSync(join(tmpdir(), 'lull-ws-')));
	execFileSync('git', ['init', '-q'], { cwd: dir });
	writeFileSync(join(dir, '.gitignore'), 'heavy/\nsmall/\n');
	for (const [name, count] of [['heavy', 120], ['small', 3], ['plain', 2], ['other', 2], ['manual', 1]]) {
		mkdirSync(join(dir, name));
		for (let i = 0; i < count; i++) {
			writeFileSync(join(dir, name, `f${i}`), '');
		}
	}
	mkdirSync(join(dir, '.vscode'));
	writeFileSync(join(dir, '.vscode', 'settings.json'), JSON.stringify(settings, null, '\t'));
	return dir;
}

function multiFixture() {
	const dir = realpathSync(mkdtempSync(join(tmpdir(), 'lull-multi-')));
	for (const name of ['a', 'b']) {
		mkdirSync(join(dir, name, 'cache'), { recursive: true });
		writeFileSync(join(dir, name, 'cache', 'f'), '');
	}
	const file = join(dir, 'multi.code-workspace');
	writeFileSync(file, JSON.stringify({
		folders: [{ path: 'a' }, { path: 'b' }],
		settings: { 'lull.mode': 'off' },
	}));
	return { dir, file };
}

const exe = await downloadAndUnzipVSCode({
	version: process.env.LULL_VSCODE_VERSION ?? 'stable',
	cachePath: process.env.LULL_VSCODE_CACHE ?? join(root, '.vscode-test'),
});

const scenarios = [
	{
		file: 'commands.test.js',
		settings: { 'lull.mode': 'off', 'files.watcherExclude': { '**/foreign/**': true } },
	},
	{
		file: 'auto.test.js',
		settings: { 'lull.mode': 'auto', 'lull.threshold': 100 },
	},
];

scenarios.push({ file: 'multiroot.test.js', multi: true });

for (const scenario of scenarios) {
	const multi = scenario.multi ? multiFixture() : undefined;
	const workspace = multi ? multi.file : fixture(scenario.settings);
	const profile = realpathSync(mkdtempSync(join(tmpdir(), 'lull-profile-')));
	try {
		await runTests({
			vscodeExecutablePath: exe,
			extensionDevelopmentPath: root,
			extensionTestsPath: join(root, 'test', 'runner.cjs'),
			extensionTestsEnv: { LULL_TEST_FILES: JSON.stringify([join(outDir, scenario.file)]) },
			launchArgs: ['--disable-extensions', '--user-data-dir', join(profile, 'user-data'), '--disable-workspace-trust', workspace],
		});
	} finally {
		rmSync(multi ? multi.dir : workspace, { recursive: true, force: true });
		rmSync(profile, { recursive: true, force: true });
	}
}
