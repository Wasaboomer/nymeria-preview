# NYMERIA — Mobile App Development (Sprint 2.2)

Read [permanent project vision](NYMERIA_PROJECT_VISION.md) before future changes.
This foundation is not a store release and introduces no gameplay or avatar redesign.

## Audit and architecture

The entry point is root index.html with ordered deferred classic scripts. The game
uses local JS/CSS, SVG/PNG character/environment assets and a local opt-in 3D library.
Navigation has five root destinations and contextual Back; active combat protects
exit. The fixed shell uses visualViewport, dvh and viewport-fit=cover; allowed panels
scroll internally. No GitHub Pages origin, remote UI or service worker is required.
Gameplay stores keep their existing versioned localStorage keys, normalization,
transaction writers and fallbacks for storage errors. Web Locks are feature-detected.
Avatar composition remains in visual-manifest.js / visual-renderer.js, reused by
Hero/Equipment/Combat; all character artwork and gameplay files remain unchanged.

Capacitor **8.5.3**, Node >=22 (CI Node 24), Java 21, Android SDK 36, iOS >=15.4.
appId **com.nymeria.game** is provisional; appName **NYMERIA**. Confirm the ID and
store ownership before signing/distribution. capacitor.config.json uses local www
and has no server.url. Do not change native origins casually: doing so can disconnect
existing localStorage. No network/storage/account plugin or backend was added.

`tools/build-mobile-web.cjs` copies the existing entry, root JS/CSS and assets/vendor
byte-for-byte into ignored www; it bundles only the native adapter. Tests/docs/Git
metadata, node_modules, logs and build outputs are excluded. Both platforms consume
the same package through cap sync. Optional visual proof assets remain available
locally without modifying their files. Generated native icons/splash are Capacitor
template placeholders, not approved final NYMERIA branding.

`native-bootstrap.js` is inert in a browser. Only a native Capacitor WebView loads
native-bridge.js. @capacitor/app is needed for Android Back and native lifecycle: dismiss the top dialog,
return through the existing navigation stack, request the existing combat-exit
confirmation, or minimize at the root. It never grants rewards, writes game state,
or abandons combat directly. Existing visibility handlers pause combat when hidden.
Native appStateChange also requests the existing Pause controls on background;
foreground never auto-resumes. No refresh/reset rewrites an active encounter.

iOS deployment starts at 15.4 because the existing compact UI uses CSS :has;
Android needs an updated system WebView (including CSS :has support).
Android declares portrait; iOS phone/iPad orientations are portrait and iPad requires
full-screen. Android large-screen OS policies may override orientation restrictions;
phones are the primary target. iOS contentInset=never leaves safe-area management
to existing CSS; Android retains Capacitor's default edge-to-edge handling. Actual
native insets, keyboard, background/resume and Back require device/emulator testing.

## Reproducible maintainer commands

```sh
npm ci
npm run sync:mobile
npm run test:mobile
# Terminal 1, optional local browser regression server:
python3 -m http.server 8018 --bind 127.0.0.1
# Terminal 2:
NYMERIA_TEST_URL=http://127.0.0.1:8018 npm test
# With SDK/JDK installed:
npm run android:debug
# On macOS with supported Xcode (26+), unsigned simulator compile:
npm run ios:check
```

Android build: android/app/build/outputs/apk/debug/app-debug.apk. No release keystore,
store credentials, certificates, paid service or store upload is configured.
Gradle wrapper distribution has its official SHA-256 checksum. iOS uses SPM with
Capacitor pinned to the same version; the App plugin is a local npm dependency.
Native projects are committed, copied web assets and build/cache outputs are ignored.

## GitHub Actions — iPhone-first daily use

- **NYMERIA DEV Tests**: npm ci, web packaging, 16 engine + 11 browser suites. Tests
  cover gameplay regressions plus browser/native-bootstrap isolation and local assets.
- **NYMERIA Mobile Builds**: only DEV push or manual dispatch on DEV; exact commit
  checkout, local web build, cap sync and foundation checks. Ubuntu builds Android
  debug; macOS-15 selects latest stable Xcode and compiles an unsigned simulator app.
- Both workflows have contents:read. No Pages deployment, release, store upload or
  write to main/the separate nymeria-dev-preview repository is performed.

From iPhone, open this repository → Actions → NYMERIA Mobile Builds → choose a run
for the desired SHA. It runs on every DEV push; Run workflow may be used on **DEV**.
After success, the run's Artifacts section offers `nymeria-android-debug-SHA` and
`nymeria-ios-simulator-unsigned-SHA` (14-day retention). Download the Android zip,
extract the APK and install it on an Android device after allowing that download
source. **An APK cannot run on iPhone.** Artifact links are valid only after a job
actually succeeds; a green web test is not proof of a native build.

For now the creator tests gameplay on Safari using the existing DEV preview. This
sprint does not change its separate publishing workflow. An unsigned iOS simulator
.app is not a signed IPA and cannot be installed on a physical iPhone. Installing
on a real iPhone requires signing, an Apple development team/provisioning and an
appropriate native build/distribution process. Future TestFlight requires Apple
Developer Program setup and a separately authorized sprint; none is configured here.
No everyday computer workflow is imposed; macOS compilation is assigned to CI.

## Saves and future architecture

Web preview and installed app have different origins/sandboxes: **existing Safari
saves are not automatically transferred into the app**. Capacitor preserves the
same JSON formats/keys; no migration/import/export or backend was introduced.
Updates with stable app ID/origin normally retain localStorage, but uninstalling
or clearing app/site data can remove it. Debug APKs use development signing; do not
assume later release builds can replace them without a compatible signature.
Local data is not a cloud backup or authoritative multiplayer economy. A later
backend/account sprint must design synchronization and server authority explicitly.
The existing normalized stores are the boundary; an extra storage wrapper now would
not supply native cross-store atomicity and was intentionally not introduced.

## Verification status

Record actual local build/test results and CI outcomes in the delivery report.
Linux cannot execute Xcode; simulator compilation belongs to the macOS CI job.
Chromium touch/viewport/offline-package tests do not prove WKWebView/Safari behavior
on a physical iPhone. Required follow-up: iOS safe areas/browser-independent viewport,
Android Back/keyboard, background/resume, offline launch, native localStorage across
process restarts/app updates and unchanged avatar composition on both platforms.
Unsigned compilation alone does not validate signing, installability or store readiness.

Sprint 2.2 local verification: clean `npm ci` and `cap sync` succeeded;
all 27 suites passed (16 engine, 11 browser), including 320/375/390/430 px,
viewport contraction/expansion and the normal two-class journey through Elar.
The Android debug APK compiled successfully with JDK 21 / SDK 36; its signature
verified and sampled packaged files matched www byte-for-byte. iOS cannot compile
on this Linux host; the committed macOS workflow performs that check after push.
No native emulator or physical iPhone/Android was available for this delivery.

The CLI's unrelated example native tests were removed (including a hard-coded
Capacitor demo application ID). Native runtime testing must exercise NYMERIA on
an emulator/device; the web/foundation suites and compilation do not replace it.
Android CI uses the SDK already installed on ubuntu-24.04, then explicitly verifies
required SDK packages with sdkmanager; no redundant SDK setup action is needed.

## Sprint 2.3 — validation and readiness

Read the [validation report](MOBILE_VALIDATION_REPORT.md) and
[iPhone-first TestFlight preparation guide](IOS_TESTFLIGHT_PREPARATION.md).
The active suite is now 16 engine + 12 browser suites; `npm test` includes measured
browser timings, storage faults and real UI equipment/renderer persistence checks.
Reports are written into ignored test-results and uploaded with the CI logs.
Browser CI checks out the run's exact SHA, not a moving branch tip.

Mobile Builds also attempts a real Android API 34 AOSP / 3 GB emulator smoke and an iPhone
simulator install/launch/relaunch smoke. Android uses Playwright's existing Android
WebView support plus native adb Back/Home/force-stop; no runtime plugin was added.
iOS process smoke is not touch/gameplay/XCTest or physical validation. Native smoke
logs/screenshots are additional artifacts; APK/app artifacts remain available after
successful compilation even if a later smoke fails. Run timeouts are bounded;
there is no signing, store upload, preview deployment or paid service integration.

The smoke originally confused a restored Equipment navigation stack with the Hero
root; the corrected harness reaches depth zero before minimizing. Native activity
state is checked with App.getState, independently of document visibility.
The native adapter also listens to appStateChange and
requests existing Pause controls for running world/manual combat; game engines
and save formats are unchanged. Smoke checks use App.getState for activity state.
Repeated native/document events cannot toggle paused combat into running.

Debug APK signing uses the runner’s ephemeral debug keystore. APKs from different
runs may not install as updates: do not uninstall an app containing valuable saves.
A stable development signing identity requires separately authorized secure key
management; no signing secrets or private keys are added by Sprint 2.3.

Native startup exposes NymeriaNativeReady only inside the adapter: listener
registration plus an App.getState round-trip on the plugin queue. Native smoke
waits for it and foreground state before input; renderer asset readiness alone
does not establish native input readiness. Registration errors remain observable.
The web bootstrap stays inert and no save data or debug UI is added.


## Sprint 2.4 — tempo persistente

Gli incontri automatici del Mondo ora continuano logicamente offline; background
ferma solo la presentazione. Pausa manuale persistita, recupero da timestamp e
ricompense transazionali sono descritti in [OFFLINE_PROGRESSION.md](OFFLINE_PROGRESSION.md).
Il tab Combattimento con priorità modificabili durante lo scontro resta escluso
dal replay offline e mantiene la pausa al background. Nessuna distribuzione nativa
o preview è stata effettuata in questo sprint.
