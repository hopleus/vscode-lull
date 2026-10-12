export function patternFor(relPath: string): string {
	return `**/${relPath}/**`;
}

export function relPathFrom(pattern: string, enabled: boolean): string | undefined {
	if (!enabled) {
		return undefined;
	}
	const match = /^\*\*\/(.+)\/\*\*$/.exec(pattern);
	if (!match || /[*?{}[\]]/.test(match[1])) {
		return undefined;
	}
	return match[1];
}
