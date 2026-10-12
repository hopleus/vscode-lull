import * as path from 'path';

export function relativePosix(root: string, target: string, flavor: path.PlatformPath = path): string {
	return flavor.relative(root, target).split(flavor.sep).join('/');
}

export function isInside(rel: string): boolean {
	return rel !== '' && rel !== '..' && !rel.startsWith('../') && !/^[a-zA-Z]:/.test(rel);
}
