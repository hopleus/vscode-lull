import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

function folderValue(folder: vscode.WorkspaceFolder): Record<string, boolean> | undefined {
	return vscode.workspace.getConfiguration('files', folder.uri).inspect<Record<string, boolean>>('watcherExclude')?.workspaceFolderValue;
}

suite('lull multi-root', () => {
	test('writes the exclusion to the folder that owns the path', async () => {
		await vscode.extensions.getExtension('hopleus.vscode-lull')!.activate();
		const [a, b] = vscode.workspace.workspaceFolders!;
		await vscode.commands.executeCommand('lull.exclude', vscode.Uri.joinPath(b.uri, 'cache'));
		assert.deepEqual(folderValue(b), { '**/cache/**': true });
		assert.equal(folderValue(a), undefined);
	});

	test('restore removes it again', async () => {
		const [a, b] = vscode.workspace.workspaceFolders!;
		await vscode.commands.executeCommand('lull.restore', vscode.Uri.joinPath(b.uri, 'cache'));
		assert.equal(folderValue(b), undefined);
		assert.equal(folderValue(a), undefined);
	});
});
