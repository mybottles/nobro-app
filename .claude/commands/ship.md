---
description: Commit pending work, merge current branch into main, push (deploys via GitHub Pages), prune worktree/branch.
---

Run the **ship** flow for nobro.app.

## Pre-flight

- Run `git status`. If there are uncommitted changes, draft a clear commit message (focus on the *why*), show it to the user for approval, and commit on the **current** branch.
- If running inside a Claude worktree (path under `.claude/worktrees/<name>/`), all subsequent git operations must run against the origin repo at `/Users/murat/sites/projects/idman` — use `git -C /Users/murat/sites/projects/idman …` or `cd` to it once at the start (the source worktree will be removed in step 5, so you must not be sitting in it).

## Ship steps

1. `git checkout main`
2. `git merge --ff-only <source-branch>` — fast-forward only. If not possible, stop and surface the divergence to the user; do not auto-rebase.
3. **Confirm with the user before pushing.** Push to `main` is the GitHub Pages deploy; this is a shared-state action and needs explicit approval each time.
4. `git push origin main`
5. Prune:
   - `git worktree remove --force .claude/worktrees/<name>` for the source worktree, plus any other Claude worktrees whose branches are now merged.
   - `git branch -d claude/<name>` for each merged branch.
6. Final report: `git worktree list`, last 3 commits on main, and the live URL `https://mybottles.github.io/nobro-app/`. Note that GitHub Pages takes ~30s to publish.

## Don't

- Skip pre-commit hooks (`--no-verify`) or amend already-pushed commits.
- Force-push to main.
- Remove a worktree whose branch has unmerged work — verify each branch is merged into main before deletion.
