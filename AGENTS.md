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
