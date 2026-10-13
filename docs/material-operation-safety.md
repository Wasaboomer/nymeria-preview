# Sicurezza materiali — blocco A/B, senza capacità o journal

## Ambito

ProgressionStorage e ProfessionEngine classificano i record prima di scrivere tramite SaveRecordSafety. Una chiave assente permette i default; JSON corrotto, versione non supportata, campi/identità non rappresentabili nel modello e quantità modificate dalla normalizzazione bloccano la scrittura. I byte persistiti restano intatti. I default in memoria con un errore NON significano un salvataggio vuoto valido; i chiamanti devono rispettare l'errore. La normalizzazione pura resta disponibile per proiezioni/test legacy, ma non autorizza a riscrivere dati rifiutati.

Compatibilità intenzionale: campi mancanti ricevono default; versioni professioni 1/2 e legacy senza versione; progressione v1; stati disponibili delle quest vengono riconciliati come prima; i vecchi report personali possono acquisire controparti coerenti SOLO tramite la migrazione già esistente e senza eliminare elementi della lista. Nessuna quantità viene trasferita o copiata. Eventuali record parziali malformati devono essere riparati separatamente con consenso, non tramite raccolta o claim.

Le normalizzazioni non sono un validatore universale del gioco: dati futuri che il modello conserva integralmente senza interpretarli non sono automaticamente tutti classificabili. Il blocco protegge soprattutto informazioni che sarebbero eliminate/convertite, materiali e proprietà del loot. Le verifiche delle attività continuano a essere quelle esistenti.

## Scrittori partecipanti e lock

MaterialWriterCoordinator concede una lease Web Locks `nymeria-material-writer` a una sola scheda per origin fino a pagehide. La lease, anziché un semplice lock breve, evita di promettere visibilità aggiornata delle cache localStorage fra processi concorrenti. Nella scheda proprietaria una coda serializza le operazioni; ProgressionStorage e ProfessionEngine rileggono il proprio record dentro la sezione protetta. Nessun retry automatico. Le richieste ancora in coda scadono dopo 5 secondi e vengono saltate prima di chiamare la mutazione, anche se la coda si libera successivamente. Il timeout di acquisizione del lock è separato (5 secondi): attesa complessiva fino a circa 10 secondi, più scheduling del browser. I timer possono essere ritardati durante la sospensione del processo.

Ordine:
1. Lease comune material-writer, richiesta ifAvailable (altrimenti rifiuto immediato).
2. Per professioni, lease profession-writer esistente, ifAvailable.
3. Lock breve nymeria-progression, con AbortSignal e timeout di acquisizione 5 secondi.
4. Rilettura, mutazione su copia, singola setItem e feedback.

Non acquisire il coordinatore ricorsivamente. I due tratti della consegna a Bram sono distinti, non annidati: handover salva la ricevuta e restituisce prima della transazione quest. Il lock delle professioni esistente resta compatibile e protegge il handoff. Un callback asincrono che non termina non è cancellato: il timeout annulla soltanto un'acquisizione ancora in attesa. La race della sola coda imposta un flag di scadenza che impedisce di eseguire successivamente il task; una volta iniziato il task, il suo timer di coda viene annullato. Il timeout del lock usa AbortSignal, senza una race che lasci scritture in background.

Senza Web Locks le mutazioni browser partecipanti sono bloccate. Letture e navigazione restano disponibili; non si dichiara sicurezza inter-scheda con una sola coda JS. I factory Node accettano storage/exclusive iniettati per i test: l'assenza di adapter browser non garantisce sicurezza in processi diversi.

La lease è volutamente conservativa: anche una transazione no-op può acquisirla; la seconda scheda resta in consultazione fino alla chiusura/reload della proprietaria. Schede sospese potrebbero trattenere la lease: non si forza lo sblocco e non si sottraggono risorse. Vecchie versioni del gioco non partecipanti non sono protette dal nuovo protocollo: prima del collaudo chiudere tutte le vecchie schede. Non sono garantiti aggiornamenti simultanei con altri client o script esterni.

## Percorsi

Coordinati nel browser: tutte le transazioni progressione (quest claim, spedizioni, incontri, ticket combattimento e aggiornamenti del mondo) e gather/craft/handover delle professioni. I mutator legacy e il bilanciamento non cambiano. I subscriber della progressione non possono più trasformare un salvataggio riuscito in un errore di feedback.

Equipment non entra nella coda comune, ma la sincronizzazione della proprietà e il suo salvataggio sono protetti quando ProgressionStore segnala un errore: non si usa un fallback vuoto per eliminare loot posseduto.

Esclusi dal coordinamento: Equipment, classi, gilda, discovery e metadati Borsa inattivi. Non possiedono le quantità qui protette. L'infrastruttura MaterialBagStore della Fase 2 rimane conservata e non inizializzata nel gameplay; prima dell'attivazione andrà collegata sotto lo stesso proprietario, evitando lock annidati ricorsivi.

Bram continua con il protocollo a ricevuta già esistente, non una nuova transazione: errore nel secondo registro lascia una consegna persistente ritentabile senza secondo consumo. Nessun journal o sistema di premi pendenti aggiunto. Quest e spedizioni continuano a salvare ricevuta e premi insieme nel singolo record. La capacità non viene controllata.

## Garanzie e limiti

Si evita la riscrittura silenziosa dei record rifiutati e la concorrenza fra scrittori browser partecipanti. Una setItem riuscita è distinta dal feedback; richieste con ricevuta rispettano i controlli esistenti. Raccolta/crafting ripetuti rimangono nuove azioni del giocatore, non richieste idempotenti automaticamente.

Non si garantisce atomicità multi-registro, durability contro perdita dello storage del sistema operativo, recupero di dati già corrotti, protezione contro modifica manuale o sincronizzazione multiplayer. I limiti di quantità legacy restano invariati; la politica di accredito vicino a quei limiti deve essere affrontata prima della capacità globale.

Prima di attivare la Borsa restano necessari: capacità su snapshot globale sotto la lease comune; decisione sui premi non consegnabili; test/implementazione separata del recupero multi-registro. Nessuna di queste funzionalità è introdotta nel presente blocco.

## Verifica della sessione

- Build riuscita; 31 suite engine superate, inclusi i 90.000 snapshot legacy identici.
- Seconda esecuzione globale, su codice stabile: 59 suite superate su 60. Il solo fallimento è combat-entry-browser.cjs, prima del tocco: feedback già scaduto rispetto alla finestra reale di 3500 ms.
- Il test combat-entry, senza modifiche, è successivamente passato isolato in tutti gli otto scenari sia su HEAD originale sia sul working tree. Il fallimento globale non viene cancellato né dichiarato definitivamente risolto; richiede un approfondimento separato dell'automazione/timing.
- Suite browser dedicata di sicurezza superata: byte corrotti/futuri/sconosciuti conservati dopo reload, tutela Equipment con input valido, ownership fra due schede, lock reale occupato/timeout/retry e blocco senza Web Locks.
- Professioni e Torre Silente superate a 320/375/390/430 px. Nessun collaudo Safari/iPhone fisico eseguito.
- I test storici che accettavano reset/normalizzazione distruttiva sono aggiornati al blocco conservativo richiesto; il test due-schede verifica che soltanto la proprietaria modifichi la località.
- Una prima esecuzione durante lo sviluppo conteneva fallimenti corretti (migrazione legacy, aspettative sui dati corrotti ed errore di sintassi Equipment). Non è usata come esito del codice finale.

Nessun commit, push o deploy. Le Fasi 1–2 sono rimaste byte-identiche durante questa sessione.

## Revisione di lifecycle e stabilizzazione

La lease comune e quella delle professioni vengono ora rilasciate sia su pagehide sia su visibilitychange verso hidden. Le richieste della coda conservano un'epoca: una sospensione invalida le richieste precedenti, evitando che vengano eseguite dopo la riattivazione. Le acquisizioni pendenti del lock progressione vengono abortite alla sospensione, e il callback ricontrolla l'epoca prima di mutare. Il completamento di un callback sincrono già in esecuzione non viene annullato a metà. La ripresa rende possibile una nuova richiesta, non un retry implicito. Nessun takeover forzato di un lock ancora posseduto da un altro contesto.

Prove browser automatiche simulano gli eventi visibility/pagehide: handoff delle due lease, rifiuto delle scritture della scheda nascosta, ripresa, reload e quantità esatte. Questi eventi simulati non costituiscono una prova della sospensione del processo Safari reale. Senza pagehide/visibilitychange o con processo congelato prima della gestione dell'evento, un lock può restare occupato fino alla riattivazione/chiusura della scheda: è preferibile il rifiuto alla concorrenza non protetta. Vecchie versioni non partecipanti vanno chiuse.

La UI professioni riporta il motivo del rifiuto quando disponibile. Gli errori persistenti di storage conservano un messaggio italiano esplicito e non vengono sostituiti da un messaggio di creazione/raccolta completata.

Compatibilità documentale verificata nei browser-compat-data MDN: LockManager.request supportato da Safari 15.4 (Safari iOS mirror). La disponibilità reale viene comunque rilevata a runtime. HTTPS o localhost sono necessari per il contesto sicuro. Non è disponibile Safari fisico né un runtime WebKit installato in questo ambiente; nessun collaudo Safari è dichiarato.

Il confronto isolato del test combat-entry originale passa su HEAD e working tree. Il test originale lasciava 250 ms tra l'attesa e la scadenza, includendo più round trip al protocollo. La stabilizzazione non aumenta timeout o durata del feedback: calcola prima la geometria, inizia il gesto a 2500 ms e verifica con timestamp che touchstart preceda la scadenza DOM effettiva e click la segua. Restano gli assert su geometria, bersaglio, battaglia visibile/usabile, pausa/ripresa, vittoria, ritorno, persistenza e ricompensa unica.

## Esito finale della revisione

- Suite globale: **60 suite superate, 0 fallite**. Build riuscita. Incluse 31 suite engine e 90.000 snapshot legacy identici.
- Combat-entry originale: 8/8 scenari su HEAD e 8/8 su working tree, nelle stesse condizioni del server/browser. Test stabilizzato: 8/8 isolato e superato nella suite globale, con timestamp del gesto attraverso la scadenza reale; nessuna modifica a WorldUI o ai 3500 ms del feedback.
- Suite dedicata finale: byte invalidi conservati, reload, Equipment protetto, ownership/handoff dopo eventi simulati di sospensione, coda/lock cancellati, assenza Web Locks, quota nel crafting senza consumi/XP o falso messaggio di completamento.
- Torre Silente: superata a 320/375/390/430 px. Cinque file Fasi 1–2 verificati tramite SHA-256, invariati.
- Nessuna regressione residua dimostrata nei test eseguiti. Restano non verificati Safari fisico, bfcache e sospensione/terminazione del processo iOS reale. Le simulazioni di lifecycle non li sostituiscono.
- Consolidamento in un commit DEV tecnicamente ragionevole; non equivale ad approvazione fisica Safari né ad autorizzazione ad attivare la Borsa o distribuire. Nessun commit/push/deploy eseguito.

## Verifica circoscritta prima del consolidamento

- Il difetto asincrono preesistente di `WorldUI.settle()` è stato corretto: la chiusura attende l'azione UI pendente e le chiamate simultanee attendono lo stesso completamento durabile. Il test UX verifica anche l'identità della ricevuta, il rifiuto per quota, il retry esplicito e l'assenza di premi duplicati. Nessuna formula o regola del combattimento modificata.
- Il precedente fallimento isolato di `fantasy-identity-browser.cjs` sul pulsante Pausa a 430 px resta un problema aperto, con causa non determinata. Nell'ultimo confronto circoscritto il caso è passato **3/3 su fc01637b0c4ca243252500c7b4ee5111d847a3e3 e 3/3 sul working tree**, con gli stessi seed 7/31/97, server, Chromium, viewport e controlli.
- Il confronto ha eseguito il caso originale limitando la matrice al solo viewport 430 in un launcher temporaneo esterno al checkout. La versione originale è stata servita dai byte del commit, senza cambiare branch o file del progetto. Nessun timeout o aspettativa del test è stato modificato.
- Non sono emerse evidenze che attribuiscano quell'intermittenza al working tree; questo non dimostra che il problema storico sia risolto. Nessuna correzione del test grafico introdotta. Safari/iPhone fisico resta da verificare.
- Il consolidamento autorizzato deve includere `[skip dev deploy]`: i workflow sorgente e preview rispettano il blocco della pubblicazione. Capacità della Borsa ancora inattiva; nessun journal o sistema di ricompense pendenti.
