---
description: Create a git commit using Conventional Commits. Use when asked to commit, "/commit", or after completing a task.
---

# Git Commit

## Format

```
<type>[scope]: <description>

[optional body]
[optional footer]
```

## Types

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Docs only |
| `style` | Formatting, no logic change |
| `refactor` | Restructure, no feature/fix |
| `perf` | Performance |
| `test` | Test changes |
| `chore` | Maintenance, cleanup |
| `ci` | CI/config |

## Steps

```powershell
# 1. Check what changed (PowerShell: use ; not &&)
git status --short
git diff --staged

# 2. Stage files
git add <files>

# 3. Verify before committing
git diff --staged --name-only

# 4. Check formatting
pnpm format:check

# 5. Commit
git commit -m "<type>[scope]: <description>"
```

## Submodule Commits (`strika-ai-docs`)

Always two commits when docs change:

```powershell
# Step 1 — commit inside the submodule
git -C ".\strika-ai-docs" add -A
git -C ".\strika-ai-docs" commit -m "docs(frontend): <what changed>"

# Step 2 — update parent repo's pointer
git add strika-ai-docs
git commit -m "chore(docs): update strika-ai-docs submodule"
```

## Selective Staging (dirty working tree)

When only part of the changes belong in this commit:

```powershell
# By path or glob
git add -- ".agents/workflows/"
git add src/components/some-feature/

# Check exactly what's staged
git diff --staged --name-only
```

## Rules

- Present tense, imperative: "add" not "added"
- Description < 72 chars — no period at end
- One logical change per commit
- **Never** `--force` on main/master
- **Never** `--no-verify` unless explicitly asked
- **Never** commit `.env`, private keys, or credentials
- Reference issues: `Closes #123`
