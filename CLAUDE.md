---
# Important: Any change to this file must increase version number
version: 2
# v2: GitHub issue tracking added (one issue per task, para.yml `issue:` field).
# Adapted from the Simple Enough mono-repo PARA rules (v7).
# Changes: <area> layer removed; Tana / mono-repo / Contango specifics removed.
# This repo is self-contained — it is the single source of truth for every layer.
---

# PARA

## Vocabulary

We use a reduced PARA, with three work layers and three storage layers.

Work layers form a hierarchy: `<project>` → `<task>` → `<todo>`.
Storage layers are `Inbox/` (un-triaged input), `Resources/` (domain references), `Archive/` (done / deprecated).

There is no `<area>` layer in this repo. The repo *is* the scope.

## Layered work model

- `<project>` — a **chunk of work with an end**. A POC, v0, v1, milestone, deliverable. Groups the `<task>`s that deliver the chunk. Optional layer — a small standalone `<task>` may sit directly in `PARA/Tasks/` with no project parent. **At most one project is active at a time** (see "Project focus").
- `<task>` — the unit of work. One folder under `PARA/Tasks/`. Always has an owner project or is explicitly standalone.
- `<todo>` — fast-moving, low-level checklist items inside a task. Lives only in that task's `00.todo.md`. Never promoted to its own folder.

## Source of truth per layer

| Layer | Existence | Description | Location |
|---|---|---|---|
| `<project>` | this repo | `00.project.md` | `PARA/Projects/<NN>-<ShortName>/` |
| `<task>` | this repo | `00.requirements.md` | `PARA/Tasks/<NN>-<ShortName>/` |
| `<todo>` | this repo | inline, one line each | `PARA/Tasks/<NN>-<ShortName>/00.todo.md` |

Every piece of information has exactly **one home**. Never duplicate. When the same fact appears in two files, one of them is wrong — delete it and reference the other.

## Naming

- `<project_folder_name>` = `<NN>-<ShortName>`. Example: `01-GcpFoundation`.
- `<task_folder_name>` = `<NN>-<ShortName>`. Example: `03-RemoteStateBucket`.
- `<ShortName>` is `CamelCase`, no spaces, no separators.
- Projects and tasks each have their **own** independent numbering sequence.

### Numeric prefix is mandatory (rule, no grandfathering)

- **Every project and task folder MUST start with a zero-padded 2-digit `<NN>` prefix.** This is what makes `ls PARA/Tasks/` sort meaningfully — without it the order signal is lost.
- **Assigning a number**: take `(highest existing prefix in that folder) + 1`. **Do not reuse gaps** — a gap usually means a folder was archived or promoted, and reusing the number creates ambiguity in cross-references that survive in older docs.
- A folder without a prefix is a bug to fix on sight.

### Folder name = canonical identity

The `<NN>-<ShortName>` string **is** the identity of the project or task. It is what other files reference.

- **Zero-drift invariant.** Any rename or structural move MUST land everywhere in the same session: the folder itself, the owning project's `00.tasks.md`, every `para.yml` that points at it, and any doc that references it by name. A half-applied rename is a bug. There is no grace period.
- Renames are `git mv` when the folder is tracked, plain `mv` otherwise. Never a delete-and-recreate — that loses history.
- Before finishing a session that renamed anything, `grep -r "<old-name>" .` and confirm zero hits.

## Project focus

Exactly one project is active at a time, to keep cognitive load low.

- The active project is recorded in `PARA/Projects/CURRENT.md` — a single line naming the active project folder, plus the date it became active.
- Every other project stays in `PARA/Projects/` as **next** or **later**: visible, but not pulling attention. That state is a line in its own `00.project.md`.
- **Tasks under the active project are the default work pool.** Tasks belonging to another project sit waiting unless explicitly escalated. They can still be picked up when the default pool is blocked.
- Re-evaluate the focus slot when the active project is delivered, or when it stalls. The decision is one of: **keep** / **pause** / **switch** / **close**. Record it in the project's `00.project.md`.

## Core files

### Project — `PARA/Projects/<NN>-<ShortName>/`

- `00.project.md` — what this is, why it exists, the goal, and the **end condition** that makes it done. A project without a stated end condition is an area, and areas do not exist here.
- `00.tasks.md` — one line per task in this project, in delivery order, each pointing at its task folder.

### Task — `PARA/Tasks/<NN>-<ShortName>/`

- `para.yml` — pointer file: `project:` (owning project folder, or `standalone`), `status:` (`todo` / `doing` / `done`), `created:` (ISO date), `issue:` (GitHub issue number, or `tbd` until created).
- `00.context.md` — references to files, docs, and external URLs an agent should read before working this task.
- `00.requirements.md` — what success looks like: acceptance criteria, constraints, definition of done.
- `00.todo.md` — priority-ordered checklist, `- [ ]` / `- [x]`.
- `00.rejected-ideas.md` — ideas considered and rejected. One line each: the idea + the short rationale. This file is what stops a later session from re-proposing something already ruled out.

Rules for core files:

- **One line per entry**, or one line that points to a numbered file. Nothing longer. These are built to be scanned in seconds.
- Create all five when the task folder is created. An empty core file with a header is correct; a missing one is not.

## Additional files (`01.*`, `02.*`, …)

- Anything that would exceed one line in a core file goes in a numbered file: `01-topic-name.md`, `02-topic-name.md`, …
- The core file keeps the one-liner and references the numbered file (e.g. `Backend design: 01-backend-design.md`).
- Any plan produced by an agent is saved into the task as a numbered file.
- **Plans must contain a progress tracker, updated in parallel with implementation, not at the end.**

## Agent working protocol

This section is the operative one. It applies to **every** task in this repo.

**Before starting work:**

1. Read `PARA/Projects/CURRENT.md` to find the active project.
2. Scan `PARA/Resources/skills/` for a repo-local skill whose description matches the request. If one matches, read its `SKILL.md` and follow it.
3. Identify the task this work belongs to. If none exists, **create the task folder first** — with all five core files and a `para.yml` — before writing any implementation code. If the task's `para.yml` says `issue: tbd`, create the GitHub issue now and record its number.
4. Read the task's `00.context.md`, `00.requirements.md`, and `00.rejected-ideas.md`.

**While working:**

5. Tick `00.todo.md` items as they complete, and add new todos as they surface. Not at the end of the session — as you go.
6. When an idea is considered and dropped, add a line to `00.rejected-ideas.md` immediately. The rationale matters more than the idea.
7. Keep the plan's progress tracker current in the same edit as the work it tracks.

**Before ending a session:**

8. Update `para.yml` `status:`.
9. Confirm every core file reflects reality. A stale `00.todo.md` is worse than no todo file, because it is trusted.
10. If the session's pattern looks reusable, propose extracting it as `PARA/Resources/skills/<name>/SKILL.md` and link it from the task's `00.todo.md`.

**Never** leave implementation work untracked. If code was written, a task folder documents why.

## GitHub issue tracking

Progress is tracked in GitHub issues; the repo stays the source of truth. The issue is a
**mirror for visibility**, never a second home for information.

- **One issue per `<task>`.** Issue title = the task folder name, verbatim (e.g. `01-InfraReview`).
  The issue number goes in the task's `para.yml` `issue:` field.
- **Issue body** = two lines: a link to the task folder, and the one-line goal from
  `00.requirements.md`. Nothing else — requirements, context, and rejected ideas live in the repo.
- **Subtasks** = GitHub task-list checkboxes in the issue body, mirroring `00.todo.md` line for
  line. The zero-drift invariant applies: tick or add a todo in `00.todo.md` and in the issue in
  the same session. On any conflict, `00.todo.md` wins.
- **Status mapping**: `status: todo` → open issue; `status: doing` → open + `doing` label;
  `status: done` → issue closed. Closing the issue is part of the same session that sets
  `status: done`.
- **Session log**: at the end of each working session, leave one comment on the issue — what
  moved, what's next, what's blocked. One comment per session, not a running commentary.
- A task without an issue is `issue: tbd` — the first session that works the task creates the
  issue (step 3 of the working protocol) and replaces `tbd` with the number.
- Projects do not get issues; `00.tasks.md` already tracks them. Only tasks map to issues.

## Lifecycle

- **Task done** — all `00.todo.md` items ticked and `00.requirements.md` acceptance criteria met. Set `para.yml` `status: done`. Tick its line in the owning project's `00.tasks.md`. Close the task's GitHub issue.
- **Task belongs elsewhere** — update `para.yml` `project:` and both projects' `00.tasks.md`. No folder move required.
- **Project done** — every task done and the end condition in `00.project.md` met. Move the project folder and all its task folders to `PARA/Archive/`, preserving names. Clear `PARA/Projects/CURRENT.md` or point it at the next project.
- **Project paused** — record "paused since YYYY-MM-DD" plus the reason in `00.project.md`, and remove it from `CURRENT.md`. The folder stays put.
- **Task abandoned** — move to `PARA/Archive/` with a final line in `00.rejected-ideas.md` explaining why. Do not delete; the rationale is the value. Close the GitHub issue with a comment pointing at that line.

## Storage folders

- `PARA/Inbox/` — un-triaged input. Empty it quickly.
- `PARA/Resources/` — domain references not tied to a current task.
- `PARA/Resources/skills/` — repo-local skills.
- `PARA/Archive/` — done projects, done tasks, abandoned work.
