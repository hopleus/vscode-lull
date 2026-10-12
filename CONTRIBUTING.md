# Contributing

## Setup

```sh
npm install
npm run build        # bundle the extension into out/
npm run typecheck    # tsc, no emit
npm run lint         # ESLint
npm run test:unit    # node:test
npm run test:integration   # downloads VS Code, runs the extension in it
```

Press F5 to start the Extension Development Host.

## Layout

- `src/extension.ts` – activation, commands, scan flow
- `src/scanner.ts` – `git ls-files` scan of ignored folders, file counting
- `src/store.ts` – reads and writes `files.watcherExclude`, remembers entries added by Lull
- `src/decorations.ts` – badge and color in Explorer
- `src/patterns.ts`, `src/paths.ts` – pure helpers, tested without VS Code
- `src/test` – unit tests, `src/test/integration` – tests running inside VS Code

## Releasing

Everything lives in `main`. Changes go in through pull requests, and releases are built from tags on `main`.

1. Bump `version` in `package.json` and add an entry to `CHANGELOG.md`.
2. Merge the change into `main`.
3. Tag the merge commit and push the tag:

   ```sh
   git tag v<version>
   git push origin v<version>
   ```

The `Release` workflow checks that the tag matches `package.json` and points to a commit on `main`, runs the tests, builds a single `.vsix` and attaches it to a GitHub release.

Publishing to the Marketplace is manual: `npx vsce login hopleus` and `npx vsce publish --no-dependencies`, or upload the `.vsix` from the release on the [publisher management page](https://marketplace.visualstudio.com/manage).
