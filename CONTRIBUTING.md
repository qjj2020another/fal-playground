# Contributing to FAL Workbench

Thanks for helping improve FAL Workbench. The project is a local, schema-driven interface for fal.ai, so changes should preserve broad model compatibility instead of adding assumptions that only work for one endpoint.

## Before opening an Issue

Search existing Issues first. For a bug report, include:

- operating system and version;
- Node.js and browser versions;
- affected fal.ai endpoint ID;
- whether the problem occurs in visual mode, JSON mode, or both;
- exact reproduction steps;
- expected and observed behavior;
- a sanitized request shape or Schema excerpt when relevant.

Remove API Keys, signed URLs, proxy credentials, private prompts, local usernames, and confidential media before posting. Report security problems through the process in [SECURITY.md](SECURITY.md), not through a public Issue.

## Development setup

```powershell
git clone https://github.com/<your-account>/<your-repository>.git
cd <your-repository>
npm install
```

Replace `<your-account>` and `<your-repository>` with the actual GitHub account and repository name.

Place the platform-appropriate `genmedia` v0.7.0 executable in `tools/`:

```text
tools/genmedia.exe    # Windows
tools/genmedia        # macOS / Linux
```

Do not commit that executable. Obtain it from its official distribution channel.

Start the local service:

```powershell
npm start
```

Open <http://127.0.0.1:14726>.

## Change guidelines

- Keep the service local-only unless a proposal also supplies a complete security design for remote access.
- Preserve schema-driven behavior. Endpoint-specific handling should be narrow, justified, and covered by a concrete failing Schema or request example.
- Keep API Keys, proxy credentials, uploads, generated media, task archives, and browser data out of commits.
- Treat `.runtime/`, `images/`, site-local `localStorage`, and per-model in-memory drafts as separate state domains. A change in one domain must not silently clear, migrate, or delete another.
- Preserve the catalog-order contract: regular loaded models may participate in saved drag ordering; the preferred model and Retry or Copy Request temporary model remain pinned outside that order; leaving a temporary model restores it to its prior position or removes an injected-only entry.
- Preserve per-model prompts, attachments, and request values across model switches and task completion. Clear Inputs may reset only the selected model to its current Schema defaults after applying the documented confirmation preference.
- Keep single-task and multi-task presentation distinct. Historical expansion stays inside History, concurrent jobs expose independent state, and the main panel returns to its empty state after a multi-task batch settles.
- Keep main-result dismissal separate from cancellation, history deletion, and archive deletion.
- Confine managed deletion to files recorded for that task under `images/`. Same-origin Save As should prefer the local archive and use the validated remote fallback only when the archive is unavailable.
- Preserve image lightbox behavior without coupling it to Open Original or Save As, and preserve video poster or decoded-frame fallbacks in History.
- Keep browser notifications opt-in and emit at most one native notification per terminal task state. In-page toasts must remain available independently.
- Keep the Credits indicator read-only. Billing authorization failures must not block generation, uploads, or task polling, and negative balances must remain valid display values.
- Avoid unrelated formatting changes or broad refactors in focused fixes.
- Keep user-visible text clear about what runs locally, what is stored locally, and what is sent to fal.ai.
- Do not add telemetry without prior discussion, explicit consent, and documentation.
- Do not bundle third-party binaries unless their redistribution terms and repository-size impact have been reviewed.

## Tests

Run the project checks before submitting a Pull Request:

```powershell
npm test
```

The automated command checks the server and client scripts, runs the API smoke test, and exercises the image-size normalization rules. It does not currently cover every browser interaction. For UI changes, verify the affected workflow manually in a current Chrome or Edge release.

Use the relevant parts of this regression checklist:

- load additional catalog pages, drag regular models, reload the page, and confirm the saved order;
- set, replace, and reset the preferred model; verify its startup selection and pinning before its ordinary catalog page loads;
- restore a Retry or Copy Request model, verify temporary pin priority, and confirm its correct position or removal after selecting another model;
- switch between models and finish tasks without losing per-model drafts, then verify Clear Inputs restores only the selected model's Schema defaults;
- run one task and a concurrent batch, expand History entries in place, and confirm the main result panel returns to its empty state after the batch settles;
- verify terminal toasts and opt-in native notifications occur once per task and open the correct task;
- dismiss a main result without changing task state, History, or archives;
- open images from the main panel and History in the lightbox, then separately test Open Original and Save As;
- verify archive creation, local-first same-origin download, remote fallback, and managed deletion without touching separately exported files;
- test saved-key disconnect, environment-key behavior, proxy save and reset, regular-key billing failure, Admin-key balance display, and negative Credits;
- on Windows, start and stop the independent service with the paired batch files and confirm no unrelated process is terminated.

Include screenshots only when they clarify a visual change, and remove private task content before uploading them.

A Pull Request should explain:

- the problem being solved;
- the implementation approach;
- the files, state domains, and behaviors affected;
- the automated and manual checks performed;
- known limitations or follow-up work.

## Commit hygiene

Keep commits scoped and readable. Do not commit:

- `.runtime/` or `.env` files;
- `node_modules/`;
- `images/` or `test-artifacts/`;
- logs, PID files, coverage output, editor state, or operating-system metadata;
- `tools/genmedia` binaries;
- ad hoc Schema captures and local audit reports unless they are intentionally added as stable test fixtures.

## Compatibility

Windows is currently the primary development environment. Contributions that improve macOS, Linux, or browser compatibility are welcome, but they should not break the documented Windows launch and stop controls.

## Licensing

The repository does not yet include an open-source license. Until a license is added, contributors retain copyright in their contributions and should understand that accepting a Pull Request does not by itself resolve the repository's broader reuse terms. A license should be selected before promoting the project as generally reusable open-source software.
