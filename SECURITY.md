# Security Policy

## Supported version

FAL Workbench is currently an early local preview. Security fixes are applied to the latest revision only. Older snapshots and forks are not maintained by this project.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public Issue, Discussion, Pull Request, screenshot, or log attachment.

Open a private GitHub Security Advisory for the repository. Include enough information to reproduce and assess the problem:

- affected revision or release;
- operating system, Node.js version, and browser;
- exact reproduction steps;
- expected and observed behavior;
- potential impact;
- minimal logs or screenshots with all secrets removed.

If private advisories are unavailable, contact the repository maintainer through a private channel listed on the maintainer's GitHub profile. Do not send an actual fal.ai API Key as part of a report.

You should receive an acknowledgement when the report is reviewed. Public disclosure should wait until a fix or mitigation is available and the reporter and maintainer have agreed on timing.

## Secrets and sensitive data

Never commit, paste, or attach any of the following:

- fal.ai API Keys or other access tokens;
- `.runtime/`, `.env`, saved key files, proxy setting files, cookies, or browser-profile data;
- generated files or uploads that contain private source material;
- task requests, responses, prompts, signed URLs, or output URLs that contain confidential data;
- local paths, usernames, browser storage exports, or logs that reveal information unrelated to the report.

A key saved through the UI is stored in `.runtime/fal-key`, and persisted proxy settings are stored in `.runtime/proxy-settings.json`. These are local plaintext files, not an operating-system credential vault. Restrict access to the project directory and avoid placing it in a synced or shared folder. Disconnecting through the UI removes the saved key, but it does not remove a key supplied through the `FAL_KEY` process environment.

Task history and most browser preferences are stored in site-local `localStorage`; the notification-toggle preference is stored in a same-site cookie. History may include request and response data, private prompts, endpoint identifiers, and output URLs. Avoid using the Workbench in a shared browser profile. Clearing the site's browser data removes these browser-side records, but it does not delete `.runtime/` or `images/` from the project directory.

If a key is exposed, revoke it in fal.ai immediately. Removing it from the latest commit is not enough because Git history, forks, caches, and notifications may retain it.

## Security boundaries

FAL Workbench is designed as a single-user local service and binds to `127.0.0.1` by default. Its local API does not provide user accounts, per-request authorization, tenant isolation, TLS termination, or hardened public-deployment controls. The loopback binding prevents ordinary direct connections from other machines, but it does not protect the service from untrusted software running on the same computer or from an untrusted browser profile.

Do not expose the service directly to a LAN or the public internet without adding and reviewing authentication, transport security, origin controls, rate limits, request-size limits, and operating-system isolation.

The same-origin output-download endpoint serves managed archive files first and can fall back to a server-side fetch of a task's remote output URL. Keep this endpoint limited to task outputs. Changes must preserve URL-protocol validation, redirect limits, download timeouts, and the checks that confine managed archive paths to `images/`; do not turn it into a general-purpose URL proxy.

The Credits indicator calls a fal.ai billing endpoint that requires an Admin-scoped API Key. A regular key can still perform model operations within its own permissions while the balance remains unavailable. Use an Admin-scoped key only when the balance display is needed, because exposing it has a larger account impact than exposing a narrower generation key.

The application executes the platform-specific `tools/genmedia` binary and sends prompts, model requests, and uploaded assets to fal.ai. Obtain the binary from its official distribution channel, review the applicable third-party terms, and do not assume local UI operation means model inputs remain on the computer. The project cannot secure or audit modified binaries from unknown sources.

## Dependency and update guidance

- Keep Node.js and npm dependencies on supported versions.
- Review dependency changes before merging them.
- Do not commit locally downloaded executables, runtime state, or generated artifacts.
- Treat proxy credentials, browser storage, task exports, and diagnostic data as sensitive.
- Re-test loopback-only binding, saved-key deletion, proxy-password redaction, managed archive deletion, and remote-download validation after relevant server changes.
- Re-test billing authorization failures with a non-Admin key and confirm that they do not block generation, uploads, or task polling.
- Review changes to `start-demo.bat` and `stop-demo.bat` for PID handling and unintended process termination.
