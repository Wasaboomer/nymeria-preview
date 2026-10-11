# NYMERIA — DEV operational rules

- Source repository: Wasaboomer/nymeria-preview; DEV branch: dev/kaelith-modular-character.
- DEV preview repository: Wasaboomer/nymeria-dev-preview; public preview: https://wasaboomer.github.io/nymeria-dev-preview/.
- Never modify or deploy the source main branch or the stable site unless explicitly authorized.
- Implement only approved changes. Run appropriate tests before committing. Do not claim unverified browser, workflow or deployment success.
- On push to the DEV branch, the NYMERIA DEV Tests workflow runs tests and dispatches the preview workflow only after a successful test job. Preview deployment independently validates the current source HEAD and test job.
- For explicitly no-deploy changes, include the exact marker [skip dev deploy] in the HEAD commit message. This suppresses the automatic dispatch and the preview workflow also rejects that HEAD. An audit or read-only request must not create a commit.
- Never expose secrets, PATs or credentials. DEV_PREVIEW_DISPATCH_TOKEN is an Actions repository secret in the source repository.
- A successful push is not evidence of a successful Pages deployment. Verify Actions results and dev-preview-version.txt when accessible; otherwise report the limitation.
- Do not change gameplay, save format, progression, combat, Avatar Lab, or Mage/Elementalist unless explicitly requested.

- Changes to CI workflows must be reviewed for test gating, branch restrictions and stale-commit protection.


## Frozen visual contract — Torre Silente
- The user approved and froze the exact latest Torre Silente mobile mockup on 2026-10-11.
- Before changing locality presentation, read docs/torre-silente-visual-freeze-v1.md.
- Do not redesign, reinterpret, regenerate, or replace the approved visual without explicit user permission.
- Separate images, text, UI panels and actions into real responsive elements; do not use the whole screenshot as a clickable backdrop.
- Report after each implementation: work completed, verification performed, next step and a copyable prompt.

## Efficient DEV cycle (approved 2026-10-11)
- Batch related edits locally before pushing. Do not use GitHub commits as individual visual trial-and-error steps.
- For Torre Silente, run `npm run test:torre:fast` in the development workspace (after `npm ci` and `npx playwright install chromium`) to inspect mobile screenshots at 320/375/390/430 in `test-results/torre-silente-v1/` before committing.
- When no local workspace is available, manually dispatch `NYMERIA DEV Tests` with `test_scope=torre-fast` to run the focused visual suite; manual runs never deploy.
- Pushes still run the complete existing regression suite. A preview deployment is only permitted after its successful full test gate and explicit user authorization; `[skip dev deploy]` prevents publishing.
- A green functional test is not a substitute for reviewing visual screenshots against the frozen reference. Do not claim visual approval without such review.
- If Pages deployment fails for infrastructure reasons, retry only its failed job rather than changing game code or rerunning a full suite.
