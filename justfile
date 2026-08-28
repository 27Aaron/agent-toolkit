set shell := ["zsh", "-cu"]

check:
    pnpm check

release-check:
    pnpm release:check

release-dry-run:
    pnpm release:dry-run

release:
    pnpm release
