import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

function workspaceValue(): Record<string, boolean> {
	const inspected = vscode.workspace.getConfiguration('files').inspect<Record<string, boolean>>('watcherExclude');
	return inspected?.workspaceValue ?? {};
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) {
			throw new Error('timed out');
		}
		await new Promise(r => setTimeout(r, 200));
	}
}

suite('lull auto mode', () => {
	test('excludes heavy ignored folders on startup and leaves small ones', async () => {
		await vscode.extensions.getExtension('hopleus.vscode-lull')!.activate();
		await waitFor(() => '**/heavy/**' in workspaceValue(), 30000);
		assert.deepEqual(workspaceValue(), { '**/heavy/**': true });
	});
});
