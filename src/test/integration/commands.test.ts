import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as vscode from 'vscode';

const root = vscode.workspace.workspaceFolders![0].uri.fsPath;

function dir(name: string): vscode.Uri {
	return vscode.Uri.file(path.join(root, name));
}

function workspaceValue(): Record<string, boolean> {
	const inspected = vscode.workspace.getConfiguration('files').inspect<Record<string, boolean>>('watcherExclude');
	return inspected?.workspaceValue ?? {};
}

suite('lull commands', () => {
	setup(async () => {
		await vscode.workspace.getConfiguration('files').update('watcherExclude', { '**/foreign/**': true }, vscode.ConfigurationTarget.Workspace);
		await vscode.extensions.getExtension('hopleus.vscode-lull')!.activate();
	});

	test('exclude adds the folder and keeps foreign entries', async () => {
		await vscode.commands.executeCommand('lull.exclude', dir('plain'));
		assert.deepEqual(workspaceValue(), { '**/foreign/**': true, '**/plain/**': true });
	});

	test('restore removes only the restored folder', async () => {
		await vscode.commands.executeCommand('lull.exclude', dir('plain'), [dir('plain'), dir('other')]);
		await vscode.commands.executeCommand('lull.restore', dir('plain'));
		assert.deepEqual(workspaceValue(), { '**/foreign/**': true, '**/other/**': true });
	});

	test('multi-selection excludes every folder', async () => {
		await vscode.commands.executeCommand('lull.exclude', dir('plain'), [dir('plain'), dir('other')]);
		assert.deepEqual(workspaceValue(), { '**/foreign/**': true, '**/plain/**': true, '**/other/**': true });
	});

	test('restoreAll removes only entries added by lull', async () => {
		await vscode.workspace.getConfiguration('files').update(
			'watcherExclude',
			{ '**/foreign/**': true, '**/manual/**': true },
			vscode.ConfigurationTarget.Workspace
		);
		await vscode.commands.executeCommand('lull.exclude', dir('plain'));
		await vscode.commands.executeCommand('lull.exclude', dir('other'));
		await vscode.commands.executeCommand('lull.restoreAll');
		assert.deepEqual(workspaceValue(), { '**/foreign/**': true, '**/manual/**': true });
	});

	test('excluding the workspace root is a no-op', async () => {
		await vscode.commands.executeCommand('lull.exclude', vscode.Uri.file(root));
		assert.deepEqual(workspaceValue(), { '**/foreign/**': true });
	});

	test('restoring the last owned entry keeps the setting valid', async () => {
		await vscode.workspace.getConfiguration('files').update('watcherExclude', undefined, vscode.ConfigurationTarget.Workspace);
		await vscode.commands.executeCommand('lull.exclude', dir('plain'));
		await vscode.commands.executeCommand('lull.restore', dir('plain'));
		assert.deepEqual(workspaceValue(), {});
	});
});
