# NYMERIA — Sprint 2.3, mobile validation

## Base e confini della verifica

Baseline: `cc871ca3898b13212aac74e637c9733aaa768704`, branch
`dev/kaelith-modular-character`, repository `Wasaboomer/nymeria-preview`.
La CI Sprint 2.2 era verde: 27 suite browser/engine e entrambe le compilazioni native.
Questo documento registra la verifica locale e descrive le prove prodotte dalla
CI Sprint 2.3. Per il risultato della singola run consultare gli artifact del suo
SHA: la configurazione di uno smoke test non ne prova l'esecuzione riuscita.

## Ambiente e livelli di evidenza

| Ambiente | Verifica |
| --- | --- |
| Linux cloud, Node 24.19, Chromium 151.0.7922.173 | Test browser touch simulato e engine |
| Linux, Temurin JDK 21, SDK 36/build-tools 35+36 | Nuova compilazione APK debug locale |
| Runner Ubuntu 24.04, Android API 35 Google APIs, Pixel 7 x86_64 | CI installa APK e verifica il WebView reale via Playwright Android/CDP |
| Runner macOS 15, Xcode stabile, iPhone Pro disponibile | CI compila, installa, avvia, termina e riavvia il processo iOS; raccoglie screenshot/log |
| iPhone/Android fisico | **Non disponibile e non testato** |

Qui non esistono `/dev/kvm`, emulatore Android o Xcode. I test nativi vengono
eseguiti sui runner, non spacciati per test locali. La CI registra versione Android,
user agent WebView, viewport, dati memoria e runtime/device iOS negli artifact.
La prova iOS è uno **smoke di installazione/processo**, non una suite XCTest touch:
non valida navigazione, salvataggio o safe area visuale su iPhone.

## Test browser/engine

Le 27 suite precedenti vengono rieseguite; una nuova suite porta il totale a
**28 (16 engine + 12 browser)**. Le prove aggiuntive esercitano:

- 320/375/390/430 px e altezze 568/667/844; touch e scroll interno, shell fissa,
  assenza di overflow orizzontale e navigazione raggiungibile (target almeno 44 px).
- Creazione reale via UI; confronto/equip di un pezzo compatibile via UI;
  variazione del rendering dell'avatar; salvataggio e riapertura dello stesso
  contesto browser con aspetto/equip persistenti.
- UI già caricata con rete disabilitata. Questo **non** prova l'avvio offline di
  un sito HTTP non installato: il pacchetto nativo include invece gli asset locali.
- Storage con letture negate, scritture negate e JSON corrotto: UI interattiva,
  nessun pageerror; il Creator non conferma una creazione non salvata e mostra
  l'errore. Nessuna modifica al formato/alle chiavi dei salvataggi.
- Regressioni precedenti: Eroe, layer, Equipment, classi, quest/Frontiera, percorso
  fino a Elar per entrambe le classi, combattimento/HUD, inventario, professioni,
  progressione e salvataggi. Nessun Debug Mode necessario per il percorso.

La variazione delle altezze è una simulazione browser, non una tastiera iPhone o
una Dynamic Island. I test non promettono persistenza dopo disinstallazione.

## Prestazioni locali misurate

Quattro campioni, uno per larghezza, sul runner Linux con contesto nuovo per ciascuna
larghezza. Il test scrive dati grezzi in
`test-results/mobile-browser-performance.json` (ignorato da Git, artifact CI).

| Misura | Risultato locale |
| --- | --- |
| Avvio fino al renderer pronto, inclusi HTTP/automazione | 537–578 ms |
| Tap e due frame fino al cambio schermata | 78–151 ms |
| JS heap del WebView Chromium simulato dopo riapertura | 2,98–3,05 MB |
| Long task rilevati nelle sessioni | 52–71 ms |
| Pacchetto www | 16.079.836 byte, 148 file |

JS heap non è memoria totale dell'app. Questi dati non rappresentano prestazioni
di iPhone vecchi né FPS reali; quattro campioni non sono un benchmark statistico.
I file più grandi sono modelli GLB dei proof opt-in già esistenti (circa 1,8–2,8 MB
ciascuno), non nuovi artwork. Non sono state applicate ottimizzazioni speculative,
compressioni/revisioni degli asset o cambiamenti al renderer.

Una seconda esecuzione completa ha misurato avvio 574–627 ms e un outlier a
375 px: Menu 3.881 ms, Eroe 3.139 ms, long task fino a 750 ms. Nessun test
funzionale è fallito. La ripetizione isolata a 375 px ha misurato avvio 630 ms,
cambi schermata 78–131 ms e long task 62 ms. Il rallentamento non è stato
riprodotto: la causa non è dimostrata e il campione anomalo non viene escluso
dalla valutazione. Serve misurazione su dispositivo reale prima di promettere
fluidità. NYMERIA_PERFORMANCE_WIDTH consente una ripetizione diagnostica mirata.

## Smoke nativi e prove da scaricare

**Android:** installazione della vera APK debug nell'emulatore effimero, avvio con
Wi-Fi/dati mobili disabilitati, creazione via touch nel WebView, navigazione,
equip/variazione avatar, confronto/modal e Back nativo, Back alla radice,
background/foreground, focus testo/tastiera, portrait, force-stop e ripristino
dei dati salvati. Raccolta logcat, screenshot, tempi e dumpsys meminfo; nessun
reset di salvataggi dell'utente. Il test rifiuta un dispositivo fisico/non-CI.
Non è un test completo del combattimento nativo o di ogni versione Android.

**iOS:** compilazione per simulatore senza firma; boot di iPhone Pro disponibile,
installazione, launch con controllo processo vivo, terminate/relaunch e screenshot.
Log del processo e lista simulatori disponibili sono conservati. Screenshot
prodotti non significano safe area/Dynamic Island visivamente approvate.
Touch, combattimento, storage/process-kill funzionale e tastiera iOS richiedono
ancora XCTest o test fisico: non sono dichiarati passati da questo smoke.

In Actions → **NYMERIA Mobile Builds** → run del commit:

- `nymeria-android-debug-SHA`: APK (solo Android).
- `nymeria-ios-simulator-unsigned-SHA`: app per simulatore (non IPA installabile).
- `nymeria-android-validation-SHA`: report JSON, logcat, screenshot, build log.
- `nymeria-ios-validation-SHA`: screenshot, log, device/runtime, esito dello smoke.

Artifact conservati 14 giorni; un fallimento preserva i log disponibili.
La CI web carica anche il report prestazioni nell'artifact dei test.

## Problemi e correzioni

Il precedente smoke browser leggeva `Character.ready` senza chiamare la funzione:
ora attende realmente `Character.ready()`; i nuovi test verificano anche i diagnostici
del renderer dopo avvio ed equip. Il renderer stesso non cambia.

Il workflow web precedente faceva checkout del nome del branch: un push ravvicinato
poteva far testare un HEAD diverso dal commit della run. Ora usa `github.sha`.
Mancavano prove di avvio nativo e log di build persistenti: aggiunti smoke e artifact
senza introdurre dipendenze runtime, modificare origini o usare credenziali.
Nessun difetto del gioco riprodotto nelle nuove verifiche browser; nessuna modifica
a gameplay, progressione, classi, save format, renderer o artwork.

## Stato e prossimi passi

Validazione **parziale** finché non si completano prove fisiche e UI iOS/native
combat. Verificare nei singoli artifact gli esiti effettivi delle run; non inferirli
da una compilazione verde. Provare su iPhone reale safe area/barra inferiore,
tastiera, scroll interno, combat HUD, riavvio, offline e aggiornamenti con dati
conservati. La preview Safari continua con lo stesso meccanismo di pubblicazione;
non trasferisce automaticamente i save nell'app. Nessun deploy manuale eseguito.

Per firma, provisioning, costi, operazioni del proprietario e installazione futura
consultare [preparazione TestFlight](IOS_TESTFLIGHT_PREPARATION.md). Nessun account,
certificato, segreto o upload store/TestFlight è stato creato. Icone/splash restano
placeholder Capacitor: richiedono branding approvato prima della distribuzione.

Build locale Sprint 2.3: `assembleDebug` completato in 17 s (cache esistente),
123 task, 24 eseguiti/99 riutilizzati. Verifica `apksigner` riuscita; entry, adapter
nativo e campioni di renderer/character nel pacchetto coincidono byte per byte
con www. Il tempo di build non è il tempo di avvio su dispositivo.

Risultato locale finale: **28 suite superate, 0 fallite** (27 regressioni esistenti
eseguite con npm test, più la nuova suite di validazione eseguita separatamente).
La suite esistente mobile foundation è stata rieseguita con l’attesa corretta
del renderer. Esiti nativi Sprint 2.3: prodotti dai job CI dopo il push, da leggere
negli artifact del commit; nessun esito nativo è anticipato da questo report locale.

Prima run CI Sprint 2.3: [37890722836](https://github.com/Wasaboomer/nymeria-preview/actions/runs/37890722836).
Entrambe le build e lo smoke di installazione/avvio/riavvio iOS sono riusciti.
Lo smoke Android ha incontrato un timeout funzionale: sono conservati i log e
aggiunta una diagnostica per distinguere il punto di blocco senza indebolire le
asserzioni o dichiarare passate verifiche non completate. Consultare gli esiti
delle run successive per la risoluzione, non dedurla dalla compilazione verde.

Diagnosi precisa del timeout Android: le prove precedenti fino alla tastiera
erano passate, ma lo smoke assumeva erroneamente che il tab Eroe azzerasse lo stack.
M6.2 ripristina il contesto del tab: dopo equip lo stack era ancora su Equipment;
Back tornava a Hero invece di minimizzare. Il test ora usa il Back reale e verifica
la radice prima di verificare background. Nessuna modifica a navigation.js.
L'osservazione document.hidden=false in quelle run non provava da sola un difetto
di background: il test non aveva ancora minimizzato l'app.

Lo smoke ora verifica App.getState().isActive e interroga il WebView dal test host
senza affidarsi a RAF in background. L'adapter usa anche appStateChange per una
pausa esplicitamente legata al ciclo di vita nativo, usando i controlli già presenti.
Non cambia gli engine, non assegna ricompense e non riprende automaticamente;
eventi duplicati non togglano una pausa in resume. La prova con Home/incontro
registra lo stato del documento per distinguere quello nativo da visibilitychange.

Lo smoke Android aggiunge un fixture di incontro creato tramite le API esistenti
di classe/equip/World nell'emulatore isolato: verifica pausa del clock in background,
assenza di auto-resume e conservazione dell'incontro dopo force-stop. Questa prova
non sostituisce il percorso missioni via UI né un combattimento completo nativo.

Lo smoke raccoglie inoltre 60 intervalli RAF durante/attorno a una vera gesture
di scroll nel WebView. Sono tempi di frame dell’emulatore CI, non FPS certificati
su smartphone o memoria totale del dispositivo fisico.

Le latenze del report Android includono attach/trasporto CDP e attese della
harness (100 ms dopo un tap); non sono latenze pure del motore.

Run [37895401230](https://github.com/Wasaboomer/nymeria-preview/actions/runs/37895401230):
compilazioni e smoke iOS riusciti; verifiche funzionali Android completate fino
al ripristino del ticket dopo force-stop. Il job Android è fallito successivamente
nella raccolta logcat: il buffer stdout predefinito di Node causava ENOBUFS.
La raccolta ora scrive direttamente su file, con timeout, conservando il log
completo senza quel limite di buffer. La run successiva verifica anche la
scansione degli errori nel log. Non era un crash del gioco.

Run 37896138775: lo smoke Android ha perso il collegamento al WebView
prima dell’Home del fixture di combattimento (Target page/context/browser closed).
Il precedente incontro era riuscito nella run 37895401230: il comportamento
non è ancora spiegato e non viene mascherato con retry. Le run successive
espongono anche estratti log di renderer/processo per distinguere il problema.

Run 37897975167: timeout sul primo Back con app ancora in Equipment, senza
crash nei log esposti. Il test attendeva asset ma non la conferma di registrazione
dei listener App. L’entry native espone ora NymeriaNativeReady dopo la registrazione
dei listener e un round-trip getState sulla coda plugin; lo smoke attende anche attività in primo piano. Il fixture
di combattimento attende inoltre i layer dopo la preparazione. Nessuna nuova
UI, chiave di salvataggio o regola di gameplay. Non si presume risolta la
disconnessione successiva del WebView senza una nuova prova.

Le interrogazioni ADB dello smoke sono ora asincrone: execFileSync sul thread
che riceve anche DevTools poteva sospendere il trasporto durante i cambi attività.
Il collector logcat usa spawn con stdout direttamente su file, lasciando attivo
il loop di automazione. Questo corregge un rischio concreto del test, non è
un’ottimizzazione del gioco; la nuova run verifica l’effetto sul disconnect.
I PASS rimangono nei log/report/summary; le notice sono riservate a diagnostici
aggregati per non esaurire il budget di annotazioni GitHub prima dell’errore.
