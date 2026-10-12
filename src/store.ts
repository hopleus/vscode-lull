import * as vscode from 'vscode';
import { patternFor, relPathFrom } from './patterns';

const STATE_KEY = 'lull.excluded';

export class Store implements vscode.Disposable {
	private readonly _onDidChange = new vscode.EventEmitter<void>();
	readonly onDidChange = this._onDidChange.event;

	constructor(private readonly memento: vscode.Memento) { }

	dispose(): void {
		this._onDidChange.dispose();
	}

	private owned(folder: vscode.WorkspaceFolder): string[] {
		return this.memento.get<Record<string, string[]>>(STATE_KEY, {})[folder.uri.toString()] ?? [];
	}

	private async setOwned(folder: vscode.WorkspaceFolder, patterns: string[]): Promise<void> {
		const all = { ...this.memento.get<Record<string, string[]>>(STATE_KEY, {}) };
		all[folder.uri.toString()] = patterns;
		await this.memento.update(STATE_KEY, all);
	}

	private async writeExclude(folder: vscode.WorkspaceFolder, mutate: (current: Record<string, boolean>) => void): Promise<void> {
		const config = vscode.workspace.getConfiguration('files', folder.uri);
		const inspected = config.inspect<Record<string, boolean>>('watcherExclude');
		const target = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 1
			? vscode.ConfigurationTarget.WorkspaceFolder
			: vscode.ConfigurationTarget.Workspace;
		const next = { ...(target === vscode.ConfigurationTarget.WorkspaceFolder ? inspected?.workspaceFolderValue : inspected?.workspaceValue) };
		mutate(next);
		const value = Object.keys(next).length ? next : undefined;
		try {
			await config.update('watcherExclude', value, target);
		} catch (err) {
			if (target !== vscode.ConfigurationTarget.WorkspaceFolder) {
				throw err;
			}
			await config.update('watcherExclude', value, vscode.ConfigurationTarget.Workspace);
		}
	}

	async add(folder: vscode.WorkspaceFolder, relPaths: readonly string[]): Promise<void> {
		const patterns = relPaths.map(patternFor);
		const owned = new Set(this.owned(folder));
		await this.writeExclude(folder, current => {
			for (const p of patterns) {
				current[p] = true;
				owned.add(p);
			}
		});
		await this.setOwned(folder, [...owned]);
		this._onDidChange.fire();
	}

	async remove(folder: vscode.WorkspaceFolder, relPaths: readonly string[]): Promise<void> {
		const patterns = relPaths.map(patternFor);
		const owned = new Set(this.owned(folder));
		await this.writeExclude(folder, current => {
			for (const p of patterns) {
				delete current[p];
				owned.delete(p);
			}
		});
		await this.setOwned(folder, [...owned]);
		this._onDidChange.fire();
	}

	async removeAll(folder: vscode.WorkspaceFolder): Promise<void> {
		const owned = this.owned(folder);
		await this.writeExclude(folder, current => {
			for (const p of owned) {
				delete current[p];
			}
		});
		await this.setOwned(folder, []);
		this._onDidChange.fire();
	}

	excludedRelPaths(folder: vscode.WorkspaceFolder): string[] {
		const value = vscode.workspace.getConfiguration('files', folder.uri).get<Record<string, boolean>>('watcherExclude', {});
		const result: string[] = [];
		for (const [pattern, on] of Object.entries(value)) {
			const rel = relPathFrom(pattern, on);
			if (rel) {
				result.push(rel);
			}
		}
		return result;
	}

	ownedRelPaths(folder: vscode.WorkspaceFolder): string[] {
		return this.owned(folder).map(p => p.slice(3, -3));
	}
}
