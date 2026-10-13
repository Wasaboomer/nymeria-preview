# Borsa — Fase 3E: collegamento al runtime reale

Base DEV: `17019d9dee9b0f91ad67a0c4ec075c04823aea10`.
La capacità resta **inattiva per i giocatori**. Nessuna migrazione o copia delle
quantità, nessun ampliamento ottenibile, nessuna modifica UI o al bilanciamento.

## Avvio e responsabilità

`index.html` carica ProfessionEngine e i dati prima di MaterialBagContract,
MaterialBagStore, MaterialCapacityAdmission e MaterialBagRuntime. QuestEngine
è definito prima di ProgressionStorage; WorldSystem/QuestSystem sono costruiti
con ProgressionStore e ProgressionSystem. ProfessionUI è costruito più tardi:
i lettori delle dipendenze di test sono lazy e vengono invocati soltanto nelle
operazioni, quando tutte le istanze esistono. Non vengono lette/scritte quantità
né creati metadati durante il caricamento dei nuovi moduli.

`material-bag-runtime.js` fornisce tre callback immutabili, passate ai singleton:

| Singleton / percorso | Controllo prima delle scritture |
| --- | --- |
| ProgressionStore.transact | MaterialBagRuntime.progression: differenza completa prima/dopo materiali |
| ProfessionUI.engine.gather / craft | MaterialBagRuntime.profession: stato finale di consumi e produzioni |
| ProfessionUI.engine.handover | stesso controllo professioni; ricevuta già presente non riscritta |
| ProgressionSystem.grantRewards | MaterialBagRuntime.reward: piano completo, inclusi duplicati, prima di XP/Corone/loot |
| QuestSystem.claim | grantRewards + controllo finale ProgressionStore; pendingReward originale |
| ProgressionSystem.claim spedizione | grantRewards + controllo finale ProgressionStore; report originale conservato |
| WorldSystem.finishEncounter / claimEncounter | grantRewards + controllo finale ProgressionStore; lastEncounter pending, esito invariato |
| Conversione loot duplicato | inclusa nel piano grantRewards e nella differenza finale di ProgressionStore |
| QuestSystem.deliver Bram | lettura sicura Progressione, ricevuta Professioni, aggiornamento ProgressionStore separato |
| Ricompensa Bram | claim normale di QuestSystem; conversione anello duplicato inclusa |
| Arena / awardManualCombat | ticket legacy e scrittura finale ProgressionStore; oggi solo XP e Corone, nessun materiale |
| Mutazioni dirette partecipanti / comandi TEST della Progressione | stessa barriera ProgressionStore, non soltanto un controllo visivo |

Equipment proietta il possesso ma non scrive quantità di materiali. Guild e Guild
Projects hanno risorse simulate separate, escluse dalla Borsa. Colyseus non viene
toccato né collegato. ExpeditionEngine produce un report, non accredita materiali.
Le sole scritture delle quantità persistenti sono quelle dei due motori sopra.

## Dipendenze esplicite e controllo globale

Il singleton distribuito è costruito con `MaterialBagRuntimeFactory.create()`:
callback permissive, `enforced=false`. Non ha setter o flag URL/salvataggio/UI.
Le factory dei motori restano utilizzabili con i precedenti contratti.

Solo il test browser intercetta il file runtime e inietta una dipendenza
`admission` alla costruzione dello stesso singleton. Non sostituisce i metodi
Quest/World/Progressione dopo l'avvio e non crea motori paralleli. La dipendenza
usa MaterialCapacityAdmission.createTestSession con:
- lettori readSnapshot dei singleton reali;
- lettura sicura dei metadati dal loro registro originale;
- MaterialWriterCoordinator.isCoordinated;
- proiezione di materiali virtuali esclusivamente in memoria per raggiungere
  39/40/41 tipi: il catalogo reale contiene attualmente soltanto otto identità.

Gli scrittori rileggono il proprio registro sotto il coordinamento esistente;
il validatore legge l'altro registro e i metadati nello stesso callback sincrono.
Non acquisisce altri lock. Una dipendenza mancante, un'eccezione o una callback
asincrona non può autorizzare la scrittura quando il controllo è iniettato.
Il controllo ricompense rende pending un premio rifiutato prima di accrediti;
il controllo finale del registro intercetta gli altri writer partecipanti.

## Garanzie e limiti

Nessun limite attivo nel gioco normale, neppure con `?test=1`. Nessun nuovo record
all'avvio. Quando iniettata, la barriera blocca nuovi materiali senza spazio,
consente aumenti di quantità a 40 tipi, considera consumi/produzioni insieme,
protegge ricompense pending e rifiuta letture incompatibili o non disponibili.
Oltre capacità, il contratto corretto consente consumi e incremento degli stack
esistenti, ma rifiuta qualsiasi nuovo tipo se l’operazione parte già oltre il
limite. Un crafting che parte a capacità esatta può liberare e riutilizzare uno
slot; la sostituzione quando si parte oltre capacità resta bloccata.

Non esiste atomicità tra registri. Bram conserva il protocollo recuperabile della
Fase 3D e richiede di tornare da Bram e riprovare dopo un'interruzione. Web Locks
protegge i writer partecipanti; senza questa capacità le mutazioni browser sono
rifiutate. Non sono protetti localStorage editato manualmente, client legacy non
partecipanti, script esterni o perdita/evizione dello storage. Il prototipo non è
una garanzia multiplayer: occorrerà un backend autorevole.

Non restano writer di materiali del runtime ordinario privi delle callback.
Un futuro writer/nuovo materiale deve aderire al coordinamento e al catalogo.
L'arena non ha oggi premi materiali: se introdotti in futuro, la barriera finale
li rifiuterebbe preservando il ticket, ma servirà definire una UX pending dedicata.

## Verifiche e prerequisiti per l'attivazione

Test nuovi: material-runtime-engine, material-runtime-browser e fixture di
iniezione. Test precedenti capacità/ampliamenti/pending adattati soltanto per non
ridefinire script globali ora già caricati da index.html. Nuova suite browser
inclusa nel runner globale. Nessun test disabilitato.

Prima di attivare: autorizzazione separata, configurazione di produzione esplicita
con validatore e lettori reali, revisione dei messaggi e della UX Borsa, decisione
sui salvataggi oltre capacità, ampliamenti ottenibili in uno sprint distinto,
regressione globale e collaudo fisico Safari/iOS e Android (lifecycle/Web Locks).
Questo sprint verifica il collegamento e non autorizza l'attivazione.

## Esito della validazione locale

- 36 suite engine superate, 0 fallite; 90.000 snapshot legacy completi identici.
- 7 suite browser pertinenti superate, 0 fallite: professioni, sicurezza,
  recupero Bram, capacità, ampliamenti, ricompense pending e singleton runtime.
- La nuova suite esercita i singleton a 320/375/390/430 px; incontri e spedizioni
  reali sono verificati in ulteriori contesti isolati. Controllate anche Promise
  rejection e console JS nelle fixture monitorate, storage quota/rifiutato,
  metadati appena ampliati e registri corrotti/futuri.
- Build web e test degli asset confezionati superati. Suite globale completa non
  rieseguita in questa fase: eseguite tutte le suite engine e i browser pertinenti.
- Safari/iPhone fisico non disponibile; nessuna conferma di collaudo sul dispositivo.

## Audit precedente della politica — differenze poi corrette (storico)

La proposta approvata per documentazione prevede:
- nessuna cancellazione o riduzione automatica dei materiali posseduti;
- consumo consentito dei materiali esistenti;
- incremento consentito delle quantità dei tipi già posseduti;
- nuovi tipi bloccati quando l'occupazione è pari o superiore alla capacità;
- ricompense non consegnabili conservate pending;
- ampliamenti di 10 fino a 100 slot.

Il contratto attuale **non implementa ancora integralmente questa politica**.
`MaterialBagContract.plan` rifiuta ogni stato finale con occupazione superiore
alla capacità, anche quando un'operazione non introduce tipi nuovi.

Verifica pura, senza scritture, su 41 tipi (quantità 2) e capacità 40:

| Operazione | Contratto attuale | Politica proposta |
| --- | --- | --- |
| Consumare una quantità lasciando il tipo positivo: 41 tipi finali | rifiutata | consentita |
| Aumentare un tipo già posseduto: 41 tipi finali | rifiutata | consentita |
| Consumare l'intera quantità di un tipo: 40 tipi finali | consentita | consentita |
| Aumentare un tipo dopo un ampliamento a 50 | consentita | consentita |

A esattamente 40 tipi, l'incremento di un tipo esistente è già consentito e un
nuovo tipo senza consumo compensativo è bloccato. Il crafting viene valutato
sullo stato finale: può consumare l'ultimo ingrediente e produrre un nuovo tipo
se rientra nella capacità. La frase sul blocco di nuovi tipi deve quindi essere
applicata allo spazio disponibile dopo i consumi nella stessa operazione, oppure
richiederà un'ulteriore decisione esplicita per il crafting.

I piani rifiutati non cancellano dati; le ricompense già supportate restano
pending e gli ampliamenti mantengono limiti e ricevute esistenti. Per i record
oltre capacità, incrementi e consumi parziali richiedono un successivo intervento
mirato al contratto e relativi test prima dell'attivazione. Nessun comportamento
del validatore è stato modificato nel consolidamento Fase 3E. I tipi aggiuntivi
usati in questa analisi esistono solo nella proiezione di test, non nei salvataggi.

## Validazione precedente — consolidamento sospeso (storico)

- Suite globale completa: **70 suite superate, 0 fallite** (36 engine, 34 browser);
  90.000 snapshot legacy identici. Build web superata.
- Ripetizione dopo build: 11 suite engine superate; 6 delle 7 suite browser
  pertinenti superate. `material-expansion-browser.cjs` fallisce al controllo
  dell'errore di quota (riga 31): atteso `write-rejected`, ricevuto
  `nested-coordination-rejected`, quindi la richiesta non arriva alla scrittura.
- Confronto con la base `17019d9`, usando i file runtime e il test originali:
  3 esecuzioni della base superate. Sul working tree 1 esecuzione superata e 2
  fallite: una sul controllo di quota (riga 31), l'altra sulla prima
  inizializzazione (riga 24, capacità non restituita). Non è dimostrato che il
  fallimento sia preesistente; non si può consolidare sulla sola suite globale.
- `MaterialBagStore` e `MaterialWriterCoordinator` non sono modificati: il guard
  rifiuta anche richieste non ricorsive mentre un callback coordinato è in corso.
  Il test aggiornato non carica più tre script prima della costruzione, perché
  sono ora presenti nel runtime; questo cambia i tempi rispetto ad avvio/reload.
  Il rifiuto osservato è sicuro, ma distinguere definitivamente una regressione
  di runtime da una sincronizzazione mancante del test richiede un'indagine
  separata. Nessuna modifica ai timeout o alle aspettative è stata applicata.
- Consolidamento sospeso: nessun commit, push o deploy. Capacità ancora inattiva.

## Correzione dei due blocchi — solo locale

### Coordinamento dopo avvio/reload

Il guard dei metadati usava `isCoordinated()`, che significa che un callback è
ancora pendente: non identifica la provenienza della chiamata. Il caricamento
dei moduli in index e la rimozione delle tre richieste di script dai test hanno
cambiato il momento della richiesta rispetto ai refresh asincroni di avvio.
Una normale richiesta esterna era quindi scambiata per ricorsione.

Il coordinatore distingue ora il lavoro pendente (`executing`) dall'invocazione
sincrona corrente (`invoking`). Le richieste indipendenti entrano nella stessa
coda; le acquisizioni durante il callback sincrono sono rifiutate. Anche il
callback del lock Progressione marca la propria invocazione. Non sono aggiunti
lock, lease o journal; ordine comune → lease Professioni → lock Progressione e
rilascio per lifecycle restano invariati. Il mutatore è ancora eseguito una sola
volta, con rilettura sotto lock. I vecchi coordinatori iniettati privi del nuovo
metodo conservano il comportamento conservativo precedente.

Limite esplicito: JavaScript nel browser non fornisce qui un contesto asincrono
per attribuire una chiamata arbitraria dopo `await`. Una ricorsione non dichiarata
che attraversa `await` non è classificata immediatamente; scade nella coda con il
timeout già esistente (5 secondi ordinari), senza eseguire il mutatore in ritardo.
Il test verifica il rifiuto e il recupero della coda con un timeout breve iniettato,
non aumentando i timeout storici. I writer attuali mantengono mutatori sincroni;
nuovi writer asincroni dovranno rispettare questo limite. Nessuna falsa promessa
di riconoscimento universale delle catene asincrone o atomicità multi-registro.

### Salvataggi oltre capacità

Il precedente controllo incondizionato dell'occupazione finale bloccava consumi
parziali e incremento di stack esistenti quando si partiva sopra capacità.
Il piano distingue ora i tipi positivi già posseduti dai tipi introdotti:
- consumi parziali/totali e incremento di stack esistenti sono consentiti;
- sotto o a capacità, il crafting usa lo stato finale dopo consumi/produzioni;
- sopra capacità, nessun nuovo tipo è consentito, anche se il crafting elimina
  abbastanza altri tipi da far rientrare il risultato finale;
- occorre prima ridurre l'occupazione in un'operazione separata, oppure ampliare;
- prodotti multipli restano una sola simulazione: un rifiuto non accredita nulla;
- quantità zero non valgono come tipo posseduto; nessuna cancellazione automatica;
- spazio disponibile mai negativo; ampliamenti 40/+10/100 invariati;
- le ricompense con nuovi tipi restano pending con il contenuto originale.

Test aggiunti: `material-overcapacity-engine.cjs` (39/40/41/55 tipi e 100 slot),
`material-coordination-reentry-engine.cjs` e `material-coordination-browser.cjs`.
La suite runtime verifica ora anche raccolta e consumi a 41 tipi, crafting oltre
capacità rifiutato senza scrittura e ricompensa duplicata pending a 41. Nessuna
aspettativa del test storico ampliamenti è stata allentata.

## Esito finale dopo la ripresa

L'esecuzione globale avviata prima dell'interruzione è arrivata alla conclusione:
**73 suite superate, 0 fallite** (38 engine, 35 browser). Il log contiene il
confronto dei 90.000 snapshot legacy completi: identici. Non è stata riavviata
inutilmente la suite al ritorno nella sessione.

Verifiche già concluse e controllate alla ripresa:
- tutte le 38 suite engine: superate;
- casi specifici browser: 5 esecuzioni superate, comprese 3 ripetizioni consecutive
  del test storico ampliamenti con le aspettative originali;
- build e verifiche specifiche engine dopo build: superate;
- 4 suite browser ripetute dopo build: superate, 0 fallite;
- ricorsione reale, richieste indipendenti, quota, reload, doppia scheda, timeout
  senza scritture tardive; capacità 39/40/41/55, crafting e premi pending;
- diff senza errori di whitespace, nessuna modifica a Colyseus o main.

Restano tutti i file locali della Fase 3E, più i file strettamente relativi ai due
fix. Capacità ordinaria inattiva. Nessun commit, push o deploy. Safari fisico non
verificato e nessuna atomicità multi-registro dichiarata. Limite delle catene
asincrone attraverso await documentato nella sezione sul coordinamento.

## Audit conclusivo dei percorsi reali (prima del consolidamento)

Ricerca nelle sorgenti runtime, escludendo copie www, vendor, test e laboratorio:
- ProgressionStore usa `common.run(() => common.progression(run))`; il mutatore,
  normalizzazione, admission e scrittura sono sincroni nel callback Progressione.
- ProfessionUI usa common.run → ProfessionTabWriter.exclusive → progression;
  refresh della Progressione e mutazione Professioni sono sincroni nell'ultimo
  callback. L'attesa del lease non riacquisisce common.run.
- I metadati usano common.run → progression → lettura/scrittura sincrona.
- Quest/World/Spedizioni usano queste transazioni, non acquisiscono ulteriori lock
  nei mutatori. grantRewards/admission sono funzioni sincrone senza transazioni.
- Bram attende la fine di handover e solo dopo avvia store.transact: sono due
  acquisizioni sequenziali, non una riacquisizione dall'interno della prima.

Non è presente un percorso reale dipendente dalla ricorsione asincrona attraverso
await. La ricorsione non dichiarata è esercitata soltanto dal test negativo:
la richiesta in coda scade prima del mutatore, nessuna scrittura avviene quando
la coda viene successivamente svuotata e un nuovo ampliamento funziona. Il lease
comune resta deliberatamente posseduto dalla scheda attiva; non è un lock rimasto
bloccato. Pagehide/sospensione lo rilascia e i test browser verificano il passaggio
alla seconda scheda. Il lock Progressione viene rilasciato alla fine del callback.
Non si promette di cancellare effetti arbitrari già prodotti da callback esterni
asincroni: i mutatori reali restano sincroni e i writer non partecipanti esclusi.

## Ultimo tentativo di consolidamento definitivo — sospeso

L'audit dei percorsi reali sopra è confermato: nessuna dipendenza da acquisizioni
ricorsive attraverso await. Mutatori sincroni, richieste indipendenti accodate,
negativo async con timeout senza scritture tardive e coda riutilizzabile verificati.
Politica oltre capacità e inattività del singleton ordinario confermate.

La nuova suite globale ha però restituito **73 suite, 1 fallita**: 72 superate.
Unico errore: `material-capacity-browser.cjs`, riga 36, `page.goto` della seconda
scheda a 390 px, timeout di caricamento di 30 secondi. Nessuna asserzione di
materiali, capacità o coordinamento ha fallito in quel caso: la pagina non ha
completato il caricamento richiesto da Playwright.

Il test originale ripetuto isolatamente è passato alle quattro larghezze. Una
ripetizione diagnostica fuori dal repository, con monitoraggio delle richieste e
pageerror e con timeout/asserzioni invariati, è anch'essa passata senza riprodurre
il timeout. Questo non prova che il problema sia infrastrutturale o preesistente:
la causa resta non determinata, quindi il consolidamento è sospeso.

Build successiva superata; cinque suite engine mirate ripetute dopo build
superate; quattro suite browser pertinenti dopo build superate, inclusi capacità,
singleton runtime, ricorsione/accodamento e test storico ampliamenti. Quest'ultimo
mantiene le proprie aspettative. 90.000 snapshot legacy della suite globale
identici. Nessuna modifica al codice o ai timeout durante questo tentativo.
Nessun commit, push o deploy; tutti i 20 file locali conservati. Main e Colyseus
invariati. Prima del consolidamento va chiarito il timeout di caricamento.

## Diagnosi mirata del timeout browser — correzione dell'attesa

Il punto in errore è `second.goto(url)` con il default Playwright `waitUntil=load`,
prima di install(second). Attende quindi anche tutte le risorse HTML bloccanti,
non una condizione di capacità o l'acquisizione del lock. Il gruppo minimo reale
(reward-pending → bram-recovery → material-capacity) e il test con diagnostica
non hanno riprodotto il timeout spontaneo. Il confronto con la base 17019d9 in
/tmp, con sorgenti originali separati, è passato alle quattro larghezze.

La diagnostica temporanea fuori dal repository registra navigazione, richieste
pendenti/fallite, DOMContentLoaded/load, pageerror, singleton e navigator.locks.query.
Una navigazione più lenta ha mostrato SVG del personaggio ancora pendenti e nessun
lock pendente; il completamento delle fetch SVG da solo non prova un blocco di load.
Infatti trattenere body.svg non ha riprodotto il timeout. Un secondo esperimento
controllato trattiene invece il vero img HTML `assets/enemies/sentinel.svg`:
**sia sulla base sia sul working tree, goto/load scade a 30 secondi mentre il
DOM è interactive, i singleton sono pronti e i Web Locks non hanno richieste
pendenti**. Attendere DOMContentLoaded + API richieste funziona anche con la
stessa immagine ancora pendente. Nessun asset viene modificato.

Questa è una fragilità dimostrata della condizione del test. Non identifica il
file preciso che rimase lento nel timeout storico: allora non era disponibile
il tracciato delle richieste. Nessuna evidenza di deadlock dei materiali; restano
possibili ritardi transitori del caricamento/runner. Non si dichiara di avere
riprodotto spontaneamente quel singolo episodio.

`material-capacity-browser.cjs` ora attende DOMContentLoaded e la disponibilità
esplicita di ProgressionStore, ProfessionUI.engine, QuestSystem, WorldSystem e
MaterialCapacityAdmission. Le asserzioni di materiali, pending, reload e ownership
sono conservate. A 390 px trattiene deliberatamente l'immagine del nemico nella
seconda scheda e verifica document.readyState=interactive: i controlli materiali
eseguono prima del load. Il timeout non è aumentato. Gli errori JS/Promise vengono
monitorati anche sulla seconda scheda; ogni context ha un finally di chiusura,
oltre al finally del browser, e la risorsa trattenuta è liberata anche su errore.

Nell'ambiente si osservano oltre 7.000 processi Chromium/crashpad zombie con PPID
1 (PID 1 è tail): sono processi già terminati, non schede vive. Memoria disponibile
circa 30 GB e pids.max=max, pids.events.max=0: non dimostrano esaurimento dei PID
né la causa del timeout. Il test chiude browser/context; il reaping degli orfani
è responsabilità dell'init dell'ambiente. Non sono stati effettuati cambiamenti
invasivi a PID 1 o al runner per attribuzioni non provate.

Verifiche dopo la correzione: gruppo minimo ripetuto due volte (6 esecuzioni,
0 fallite), quattro ulteriori browser pertinenti superati (runtime, coordinamento,
ampliamenti, sicurezza), build/asset confezionati superati e 90.000 snapshot
legacy identici. Nessuna nuova suite globale in questa diagnosi.
Prima di consolidare è raccomandata una nuova validazione globale con questa
condizione motivata e la regressione dell'immagine pendente. Safari fisico resta
non verificato. Nessun commit/push/deploy, capacità inattiva, main/Colyseus invariati.

## Validazione finale autorizzata — 2026-10-13

Eseguita una sola volta la suite globale completa: **73 suite superate, 0 fallite**
(38 engine e 35 browser), con server locale 8018 e NYMERIA_TEST_URL configurato.
La suite di equivalenza conferma **90.000 snapshot legacy identici**.
`material-capacity-browser.cjs` supera anche il caso a 390 px con l'immagine
HTML del nemico ancora pendente e i singleton disponibili prima di load.

Build finale `npm run build:web` riuscita. Dopo la build, ripetute 10 suite:
material-coordination-reentry, material-overcapacity, material-runtime,
material-expansion, material-capacity e mobile-foundation engine; capacity,
runtime, coordination ed expansion browser. **10 superate, 0 fallite**.
Il test storico degli ampliamenti conserva le proprie aspettative.

Audit dei tre punti reali di acquisizione confermato: nessuno dipende da una
riacquisizione ricorsiva dopo await. Il caso negativo di ricorsione asincrona
non riconosciuta immediatamente scade senza scritture tardive, e la coda è
riutilizzabile. Non è garantito un rilevamento universale dell'ascendenza async.
Restano assenti atomicità multi-registro e protezione da writer non partecipanti
o manipolazioni manuali dello storage. Safari iPhone fisico non verificato.

Capacità ordinaria inattiva, nessuna attivazione tramite URL o salvataggi.
Consolidamento autorizzato esclusivamente su DEV con `[skip dev deploy]`:
nessuna pubblicazione dell'anteprima, nessuna modifica a main o Colyseus.
