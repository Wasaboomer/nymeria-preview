# Phase 3D — Bram delivery recovery

DEV base: `44aa98f98dbef25beaa36e4dfbb8937a5dbe5edf`.
Capacity remains inactive in gameplay. No new ledger, journal, reward, migration or UI.

## Actual protocol

1. Read a safe progression snapshot; require an active `sq-bram-preparation`.
2. ProfessionUI enters the common material writer, then the profession lease and
   progression lock; refresh progression before checking Bram's location, quest,
   travel and encounter restrictions.
3. ProfessionEngine rereads the profession ledger. In one `setItem`, subtract one
   `frontier-brace` and persist `deliveries['sq-bram-preparation']` containing the
   original material and amount. A receipt already present does not consume again.
4. Release the operation locks. QuestEngine separately transacts progression using
   the common writer and progression lock. Reread progression, check context and
   read the safe profession receipt; dispatch the existing delivery objective.
5. The quest becomes completed; its ordinary claim grants the original reward in
   a single progression write. Existing pending-reward handling includes the iron
   conversion when the ring is already owned. Claim is separate from delivery.

The common browser lifetime lease excludes participating writers from other tabs;
local queues serialize requests. There is no lock held while waiting to reacquire
that same lock. On page suspension/closure ownership is released; retries reread.
No Web Locks means safe refusal, not an unsafe localStorage fallback.

## Corrected defects

- A receipt retry previously attempted another profession write despite changing
  nothing. Quota/write refusal on that redundant write prevented progression
  recovery. An unchanged, canonically identical draft now returns without writing
  or invoking material admission. Actual changes still pass admission and save.
- The initial delivery check previously trusted cached progression. An unreadable
  progression record could permit profession reservation before the later write
  refused it. Delivery now requires a fresh safe snapshot first. The browser's
  existing coordinated refresh remains the second check before reservation.

## Failure boundaries and guarantees

- Before first write: no consumption or receipt on a refused profession write.
- Between writes: brace is reserved, durable receipt retained, quest still active.
  Reload/retry at Bram completes the objective without another consumption.
- Second write refusal: same recoverable state; no claim or reward yet.
- After completion: delivery cannot repeat; claim/retry cannot grant twice.
- Corrupt, future-version or unrecognized records are preserved and writes refused.
  If data becomes unsafe between stages, reservation remains recorded; restore a
  valid record before recovery. Never guess or erase a receipt.
- With injected test-only capacity admission, consumption at a full bag succeeds;
  an undeliverable duplicate-loot material reward remains pending and retryable.

These are two recoverable writes, **not an atomic transaction across ledgers**.
The reserved material is unavailable between stages, intentionally. Recovery
requires revisiting Bram and retrying; it is not automatic on app startup.
Guarantees cover participating writers and atomic single-key localStorage writes,
not manual edits, unsupported clients, concurrent external scripts, storage loss,
or browser eviction. Node tests must inject coordination; the default factory
queue alone does not provide cross-tab exclusion. Physical Safari suspension and
crash behavior still need device validation.

## Validation

`tests/bram-recovery-engine.cjs`: interruption/reload boundaries, no-op receipt
retry with denied write, both write failures, insufficient resources, unsafe
records/read refusal, coordinated concurrent factories, simulated full bag,
pending duplicate conversion and once-only retry.

`tests/bram-recovery-browser.cjs`: actual common Web Locks coordination at
320/375/390/430 px, second-write failure, reload, receipt retry with denied
profession write, double request, two-page claim, lease handoff and no-Web-Locks
safe refusal. Included in the global browser runner.

The historical `bram-delivery-browser.cjs` reaches delivery/claim but later waits
for the removed `[data-world-view="journal"]` control; the same failure was reproduced with the original HEAD
modules. This obsolete navigation assertion was left unchanged.

## Final consolidation validation

- Global `npm test` with `NYMERIA_TEST_URL=http://127.0.0.1:8018` and system
  Chromium: **68 suites passed, 0 failed** (35 engine, 33 browser).
- Six legacy profiles, 90 configurations x 1,000 seeds: all 90,000 complete
  deterministic snapshots identical. Web build passed.
- Historical test `tests/bram-delivery-browser.cjs`, outside the global runner:
  both working tree and original `44aa98f` runtime modules fail at line 13 on
  `locator.tap`, waiting for `[data-world-view="journal"]` for 30 seconds.
  Delivery and claim before that point succeed in both runs. Original files
  served for comparison were verified byte-identical to `git show HEAD:<file>`;
  all other runtime/UI files are unchanged. This is a preexisting missing
  navigation control expected by the historical test, not a delivery regression.
  Neither UI nor historical assertions were changed.
- Physical Safari/iPhone interruption behavior remains unverified.
