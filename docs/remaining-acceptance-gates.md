# Remaining acceptance gates

This change is based on `3733707` on `v0/fix-convex-preview-initialization`. It fixes code-side failure handling and upgrade/configuration gaps; it does not grant external model access or claim a live acceptance run for the new branch.

## Implemented

- Pin Next.js / eslint-config-next to `16.4.2`, Better Auth to `1.6.33`, and its direct utility to `0.4.2`; retain adapter `0.12.5` within its declared Better Auth peer range.
- Pin Bun `1.4.3` and Node 22 LTS; verify root/web React and React DOM resolve to the same installed instances and pinned versions.
- Add optional nullable 2FA lockout schema fields, storage compatibility tests, and isolated HTTP/plugin threshold, denial, expiry, and reset regression coverage. See `auth-upgrade.md` for the type-only adapter patch and rollout notes.
- Classify nested Gateway access-tier errors into stable, safe responses. Logs contain fixed metadata only, not prompts, source contents, credentials, or arbitrary provider bodies. Failed requests retain cleanup behavior.
- Keep voice disabled unless all prerequisites are implemented and verified. The availability endpoint distinguishes exact-model absence, missing duration pricing, and native Live credential/acceptance gates. No model substitution.
- Restrict production framing to self; allow only self and known v0 origins in Preview/development. Include Preview-origin configuration in Turbo inputs.
- Add opt-in signed-in Playwright cases for desktop, reduced-motion desktop, and 375px mobile emulation. See `browser-acceptance.md`. Read commands still write minimal operation receipts.
- Add Linux CI for frozen installation, runtime checks, typechecks, lint, tests, and production build. No credentials or deployment step are configured in that workflow.

## Local verification

- Frozen Bun install: passed, with package lifecycle scripts disabled.
- Root and web TypeScript checks: passed.
- Runtime/shared React resolution check: passed.
- Unit/component/isolated backend suites: **409 tests across 42 files passed**.
- Lint: no errors; seven existing full-page authentication-navigation warnings are reported by the upgraded Next lint rules. Those reloads were not changed as part of this work.
- Playwright discovery: six cases listed. This is configuration validation, **not six executed browser acceptance cases**.
- This Mac rejects the native Rolldown and Tailwind Oxide libraries under its system signing policy. Tests ran using Rolldown's official WASM fallback, installed only in scratch storage. No security policy was changed. Native/Turbopack build acceptance must be checked separately; the new Linux CI runs the ordinary production build.

## External gates, not fixed by code

1. **Luna access:** the previously tested Preview request was denied by Gateway with “Free tier users do not have access.” An authorized administrator must resolve the credential entitlement/access tier, then rerun the exact `openai/gpt-6-luna` request. No billing, credits, model routing, or credentials were changed.
2. **Voice:** the exact `openai/gpt-live-1.1` was absent from the previously inspected public catalog. Listing alone will not enable voice. Duration pricing, authenticated native Live token issuance, transport, microphone/playback, cancellation, and cleanup require separate validation. The endpoint intentionally returns unavailable, including when model/pricing checks pass.
3. **Signed-in browser/mobile acceptance:** obtain approved existing state for an isolated Preview workspace and run the opt-in harness against the new deployment. Mobile emulation is not physical-device acceptance. Draft-confirmation and other write flows are not covered by this harness.
4. **Auth rollout:** deploy the additive schema through the reviewed release path and validate 2FA/account/session flows in staging before production rollout. No schema deployment or data migration was performed here.

No production users, data, settings, billing, credentials, or model choices were modified by this work.
