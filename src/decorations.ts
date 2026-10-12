import * as path from 'path';
import * as vscode from 'vscode';
import { Store } from './store';

export class LullDecorations implements vscode.FileDecorationProvider, vscode.Disposable {
	private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
	readonly onDidChangeFileDecorations = this._onDidChange.event;
	private paths = new Set<string>();

	constructor(private readonly store: Store) { }

	dispose(): void {
		this._onDidChange.dispose();
	}

	refresh(): string[] {
		const next = new Set<string>();
		for (const folder of vscode.workspace.workspaceFolders ?? []) {
			for (const rel of this.store.excludedRelPaths(folder)) {
				next.add(path.join(folder.uri.fsPath, rel));
			}
		}
		this.paths = next;
		this._onDidChange.fire(undefined);
		return [...next];
	}

	provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
		if (uri.scheme !== 'file' || !this.paths.has(uri.fsPath)) {
			return undefined;
		}
		return {
			badge: 'zz',
			tooltip: 'Excluded from the file watcher by Lull',
			color: new vscode.ThemeColor('lull.lulledForeground')
		};
	}
}
