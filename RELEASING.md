# Local npm release

This repository publishes the core and UI packages as one paired release. The release helper is local and does not require a GitHub Actions workflow.

Npm does not allow reusing an existing package name/version, even after unpublishing it. The helper checks the registry first, skips versions that already exist, and publishes only missing versions. If code changes, update the `version` in both package manifests, commit the change, and run the release again.

## First-time setup

```sh
npm login --registry https://registry.npmjs.org/
npm whoami --registry https://registry.npmjs.org/
```

Use `NPM_REGISTRY` for a compatible private registry. Use `NPM_TAG` when a non-`latest` distribution tag is intentional.

## Commands

```sh
# Query registry state; never uploads
pnpm release:check
# or: just release-check

# Run checks and inspect both tarballs; never uploads
pnpm release:dry-run
# or: just release-dry-run

# Run checks, verify login, and publish missing versions in core -> UI order
pnpm release
# or: just release
```

The publish command requires a clean, committed worktree. It never changes package versions, creates commits, or pushes Git branches. If the first package succeeds and the second fails, rerun the same command after fixing the problem; the already-published version is skipped.

The helper intentionally keeps this two-package release policy small. For a larger monorepo with independent release notes and automated version bumps, [Changesets](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md) is the usual next step; its publish command also checks which versions are already on npm.

See npm's [publish documentation](https://docs.npmjs.com/cli/commands/npm-publish/) for the immutable name/version rule and [login documentation](https://docs.npmjs.com/cli/v11/commands/npm-login/) for local authentication.
