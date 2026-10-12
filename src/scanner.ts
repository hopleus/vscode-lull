import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface Candidate {
	readonly relPath: string;
	readonly files: number;
}

function ignoredDirectories(root: string, signal: AbortSignal): Promise<string[]> {
	return new Promise((resolve, reject) => {
		const child = spawn('git', ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'], { cwd: root, signal });
		const chunks: Buffer[] = [];
		child.stdout.on('data', (c: Buffer) => chunks.push(c));
		child.on('error', reject);
		child.on('close', code => {
			if (code !== 0) {
				return reject(new Error(`git exited with ${code}`));
			}
			const entries = Buffer.concat(chunks).toString('utf8').split('\0').filter(e => e.endsWith('/'));
			resolve(entries.map(e => e.slice(0, -1)));
		});
	});
}

async function countFiles(dir: string, limit: number, never: ReadonlySet<string>): Promise<number | undefined> {
	let count = 0;
	const stack = [dir];
	while (stack.length && count < limit) {
		const current = stack.pop()!;
		let handle;
		try {
			handle = await fs.opendir(current);
		} catch {
			continue;
		}
		for await (const entry of handle) {
			if (entry.isDirectory()) {
				if (never.has(entry.name)) {
					return undefined;
				}
				stack.push(path.join(current, entry.name));
			} else {
				count++;
				if (count >= limit) {
					break;
				}
			}
		}
	}
	return count;
}

export async function scan(root: string, threshold: number, neverExclude: readonly string[], timeoutMs = 30000): Promise<Candidate[]> {
	const never = new Set(neverExclude);
	const dirs = (await ignoredDirectories(root, AbortSignal.timeout(timeoutMs))).filter(rel => !rel.split('/').some(part => never.has(part)));
	const result: Candidate[] = [];
	for (const rel of dirs) {
		const files = await countFiles(path.join(root, rel), threshold, never);
		if (files !== undefined && files >= threshold) {
			result.push({ relPath: rel, files });
		}
	}
	return result;
}
