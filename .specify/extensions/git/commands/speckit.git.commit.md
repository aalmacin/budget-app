---
description: "Auto-commit changes after a Spec Kit command completes"
---

# Auto-Commit Changes

Automatically stage and commit changes after a Spec Kit command completes,
using a concise but descriptive commit message derived from the actual diff.

## Behavior

This command is invoked as a hook after (or before) a core Spec Kit command. It:

1. Determines the event name from the hook context (e.g., `after_specify`,
   `before_plan`, `after_implement`).
2. Checks `.specify/extensions/git/git-config.yml` to confirm auto-commit is
   enabled for that event (or globally via `auto_commit.default`).
3. **Inspects the current change set** via `git status` and `git diff` to
   understand what actually changed.
4. **Composes a concise, change-specific commit message** that names the
   feature, file area, or concept changed — not a generic placeholder.
5. Invokes the auto-commit script with the event name and the composed
   message, which runs `git add .` + `git commit -m "<message>"`.

## Commit Message Standards (constitution-enforced)

Per the project constitution (Development Workflow & Quality Gates), every
commit produced by this command MUST:

- Lead with an imperative verb: **Add / Update / Fix / Remove / Refactor /
  Document / Rename / Move**.
- Name the specific feature, file area, or concept changed. Good:
  `Add login server action with rate-limit guard`. Bad: `Add changes`,
  `Update files`.
- Stay under ~70 characters on the first line.
- Include a body only when WHY is non-obvious or when listing multiple
  coordinated changes.
- NEVER use generic placeholders like `[Spec Kit] Auto-commit after X`, `WIP`,
  `update files`, `misc changes`, `progress`.

If the staged changes span unrelated concerns and cannot be summarized
honestly in one short line, split them into multiple commits.

## Execution

1. Read the current change set:
   - `git status --short` — list of touched paths.
   - `git diff --stat HEAD` — magnitude per file.
   - `git diff HEAD` (and `git diff --cached HEAD` if pre-staged) — inspect the
     most significant hunks to understand intent.
2. Compose the commit message following the standards above.
3. Determine the event name from the hook context that triggered this command.
4. Invoke the script with both arguments:
   - **Bash**: `.specify/extensions/git/scripts/bash/auto-commit.sh <event_name> "<message>"`
   - **PowerShell**: `.specify/extensions/git/scripts/powershell/auto-commit.ps1 <event_name> "<message>"`

The script honors the message argument with highest priority, falling back to
the per-event `message` in `git-config.yml` only if no argument is supplied,
and to the generic `[Spec Kit] Auto-commit ...` fallback only if neither
exists. **The constitution requires the message argument to be supplied
whenever there are non-trivial changes.**

## Configuration

In `.specify/extensions/git/git-config.yml`:

```yaml
auto_commit:
  default: false          # Global toggle — set true to enable for all commands
  after_specify:
    enabled: true         # Override per-command
    # `message:` is now optional and used only when the caller does not pass
    # a descriptive message. Prefer leaving it unset so the skill always
    # composes one from the diff.
  after_plan:
    enabled: false
```

## Graceful Degradation

- If Git is not available or the current directory is not a repository: skips with a warning.
- If no config file exists: skips (disabled by default).
- If no changes to commit: skips with a message.
- If the LLM cannot meaningfully summarize the change (e.g., empty diff): the
  script's fallback message applies, but this should be rare — investigate
  why the hook fired with no real change.
