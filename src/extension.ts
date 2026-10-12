import * as path from 'path';
import * as vscode from 'vscode';
import { LullDecorations } from './decorations';
import { isInside, relativePosix } from './paths';
import { scan } from './scanner';
import { Store } from './store';

function folderFor(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
	return vscode.workspace.getWorkspaceFolder(uri);
}

function targets(arg: vscode.Uri | undefined, all: vscode.Uri[] | undefined): vscode.Uri[] {
	if (all && all.length) {
		return all;
	}
	if (arg) {
		return [arg];
	}
	const active = vscode.window.activeTextEditor?.document.uri;
	return active ? [vscode.Uri.file(path.dirname(active.fsPath))] : [];
}

async function groupByFolder(uris: vscode.Uri[]): Promise<Map<vscode.WorkspaceFolder, string[]>> {
	const groups = new Map<vscode.WorkspaceFolder, string[]>();
	for (const uri of uris) {
		const folder = folderFor(uri);
		if (!folder) {
			continue;
		}
		const rel = relativePosix(folder.uri.fsPath, uri.fsPath);
		if (!isInside(rel)) {
			continue;
		}
		groups.set(folder, [...(groups.get(folder) ?? []), rel]);
	}
	return groups;
}

export function activate(context: vscode.ExtensionContext): void {
	const store = new Store(context.workspaceState);
	const decorations = new LullDecorations(store);

	const sync = (): void => {
		const paths = decorations.refresh();
		void vscode.commands.executeCommand('setContext', 'lull.excluded', paths);
	};

	context.subscriptions.push(
		store,
		decorations,
		vscode.window.registerFileDecorationProvider(decorations),
		store.onDidChange(sync),
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('files.watcherExclude')) {
				sync();
			}
		}),
		vscode.workspace.onDidChangeWorkspaceFolders(sync),
		vscode.commands.registerCommand('lull.exclude', async (arg?: vscode.Uri, all?: vscode.Uri[]) => {
			for (const [folder, rels] of await groupByFolder(targets(arg, all))) {
				await store.add(folder, rels);
			}
		}),
		vscode.commands.registerCommand('lull.restore', async (arg?: vscode.Uri, all?: vscode.Uri[]) => {
			for (const [folder, rels] of await groupByFolder(targets(arg, all))) {
				await store.remove(folder, rels);
			}
		}),
		vscode.commands.registerCommand('lull.restoreAll', async () => {
			for (const folder of vscode.workspace.workspaceFolders ?? []) {
				await store.removeAll(folder);
			}
		}),
		vscode.commands.registerCommand('lull.scan', () => runScan(store, 'suggest', true))
	);

	sync();

	const mode = vscode.workspace.getConfiguration('lull').get<string>('mode', 'suggest');
	if (mode !== 'off') {
		void runScan(store, mode === 'auto' ? 'auto' : 'suggest', false);
	}
}

async function runScan(store: Store, mode: 'suggest' | 'auto', manual: boolean): Promise<void> {
	const config = vscode.workspace.getConfiguration('lull');
	const threshold = config.get<number>('threshold', 5000);
	const never = config.get<string[]>('neverExclude', []);

	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		let found;
		try {
			found = await scan(folder.uri.fsPath, threshold, never);
		} catch (err) {
			if (manual) {
				void vscode.window.showWarningMessage(`Lull: scan failed in ${folder.name}: ${(err as Error).message}`);
			}
			continue;
		}
		const already = new Set(store.excludedRelPaths(folder));
		const fresh = found.filter(c => !already.has(c.relPath));
		if (!fresh.length) {
			if (manual) {
				void vscode.window.showInformationMessage(`Lull: no heavy ignored folders in ${folder.name}`);
			}
			continue;
		}
		if (mode === 'auto' && !manual) {
			const added = fresh.map(c => c.relPath);
			await store.add(folder, added);
			void vscode.window.showInformationMessage(
				`Lull: excluded ${added.length} folder(s) from the file watcher in ${folder.name} (${added.join(', ')})`,
				'Undo'
			).then(answer => answer === 'Undo' ? store.remove(folder, added) : undefined);
			continue;
		}
		if (!manual) {
			const answer = await vscode.window.showInformationMessage(
				`Lull: ${fresh.length} heavy ignored folder(s) in ${folder.name} are watched by VS Code (${fresh.map(c => c.relPath).join(', ')})`,
				'Review',
				'Dismiss'
			);
			if (answer !== 'Review') {
				continue;
			}
		}
		const picked = await vscode.window.showQuickPick(
			fresh.map(c => ({ label: c.relPath, description: `${c.files}+ files`, picked: true })),
			{ canPickMany: true, title: `Lull: exclude from the file watcher (${folder.name})`, placeHolder: 'Select folders to exclude' }
		);
		if (picked && picked.length) {
			await store.add(folder, picked.map(p => p.label));
		}
	}
}

export function deactivate(): void { }
