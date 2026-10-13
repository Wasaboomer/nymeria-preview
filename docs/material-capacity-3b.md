# Borsa Fase 3B — integrazione inattiva della capacità

## Attivazione esclusivamente in test

`MaterialCapacityAdmission.createTestSession` richiede `purpose: 'capacity-simulation'`, lettori validati, metadati e verifica di coordinamento espliciti. Non è caricato da index.html né configurato dai singleton di gameplay. Non esistono flag URL, preferenze o campi nei salvataggi capaci di attivarlo. Il default dei factory resta permissivo. I metadati vengono letti, mai inizializzati o scritti da questo controllo.

I test inseriscono il controllo nel costruttore di ProgressionStorage, ProfessionEngine e ProgressionLifecycle. Le identità sintetiche usate per occupare 40 slot esistono soltanto nella proiezione di test: non vengono aggiunte al catalogo reale o persistite. I motori continuano a rifiutare ID non riconosciuti nei registri.

## Percorsi coperti

- Raccolta e crafting: `materialAdmission(before, after)` è chiamato prima dell'unica scrittura del registro professioni. Si validano consumi e produzioni sullo stato finale, compresi prodotti multipli. Un rifiuto non accredita XP, discovery o prodotti e non consuma ingredienti.
- Tutte le transazioni di progressione: la stessa verifica finale copre introduzioni di materiali, incluse mutazioni dirette autorizzate al motore. Gli scrittori di materiali reali sono ProgressionStorage e ProfessionEngine; le quantità temporanee prodotte da ExpeditionEngine/RewardDelivery non sono registri.
- Quest, spedizioni, incontri e conversione duplicati: `rewardAdmission` della Fase 3A usa `session.reward`, prima di qualsiasi credito, conservando bundle/report/ricevuta pending. Il controllo finale del registro è una seconda protezione; non sostituisce il preflight necessario a conservare il premio.
- Handover a Bram: il controllo finale osserva il consumo del registro professioni, ma NON trasforma la successiva scrittura quest in una transazione comune. Rimane il protocollo a ricevuta preesistente; nessun journal aggiunto.

## Riletture e garanzie

Il motore mutante rilegge il proprio record dentro l'esclusione comune. Il controllo rilegge l'altro proprietario con `readSnapshot()` e i metadati con MaterialBagStore.read, nella medesima operazione, senza copie conservate fra richieste. Questi lettori rispettano SaveRecordSafety e non riscrivono o riparano dati. JSON corrotto, versioni future, identificatori sconosciuti, storage indisponibile e metadati incompatibili bloccano il controllo.

`MaterialWriterCoordinator.isCoordinated()` indica lease posseduta e callback in esecuzione, non una proprietà persistente. Nessun nuovo lock: ordine e policy di ownership restano quelli del blocco sicurezza. I test Node utilizzano una coda condivisa dichiarata; il browser usa i Web Locks reali. Nessun retry implicito. Senza Web Locks resta il rifiuto già previsto dal gameplay.

Il pagamento è tutto-o-niente nel singolo registro. Non si promette atomicità multi-registro, sicurezza contro editing o durabilità contro cancellazione dello storage. Raccolte/crafting ripetuti sono nuove azioni intenzionali, non operazioni con ricevuta idempotente.

## Cosa impedisce ancora l'attivazione

1. Collegamento esplicito dei tre hook nei singleton reali, dopo revisione; ora sono iniettati solo nei test. Tutti i client/schede precedenti non partecipanti devono essere chiusi.
2. Gli ampliamenti futuri del MaterialBagStore devono partecipare al coordinatore comune. La sua coda storica separata non garantisce un'operazione globale: non viene usata per concedere ampliamenti in questa fase.
3. Validazione separata del recupero multi-registro di Bram e di eventuali futuri premi fra proprietari, incluse interruzioni fra le due scritture. La Fase 3B non aggiunge un protocollo di recupero.
4. Decisione su salvataggi eventualmente oltre capacità e integrazione UX prima del rilascio; nessuna migrazione o UI introdotta.
5. Safari/iPhone fisico, bfcache e sospensione del processo rimangono da collaudare. I test Chromium con due schede non li certificano.

La capacità resta disattivata per i giocatori. Nessun deposito cittadino, carica di nodo, valore di bilanciamento o catalogo di professioni modificato.

## Verifiche locali preliminari

- 33 suite engine superate sul codice finale, inclusi 8 scenari di integrazione capacità e i 90.000 snapshot legacy identici.
- 7 suite browser pertinenti superate: capacità, sicurezza materiali, professioni, ricompense pendenti, offline, consolidamento UX e Torre Silente. Il test capacità è stato ripetuto sul codice finale a 320/375/390/430 px.
- Il primo giro ha rilevato una copia www non aggiornata nel test mobile foundation; build rigenerata e tutte le suite engine rieseguite senza modificare test o aspettative. Build finale riuscita.
- Suite globale browser completa e Safari/iPhone fisico non eseguiti in questa fase.
- Nessun commit, push o deploy. I cinque file delle Fasi 1–2 rimangono invariati.

## Validazione finale per il consolidamento

- `npm test`: 64 suite globali superate, 0 fallite (33 engine e 31 browser del runner). 90.000 snapshot legacy identici.
- Build ripetuta dopo la suite globale; quindi 14 suite pertinenti superate, 0 fallite: 9 engine e 5 browser, inclusi sicurezza materiali e Torre Silente.
- Salvataggi legacy, premi pendenti, retry, doppia riscossione, quota, versioni incompatibili e ownership fra schede verificati. Nessuna nuova regressione rilevata; nessun test o timeout modificato per il consolidamento.
- Il primo avvio in background non è stato mantenuto dall'ambiente: non è contato come esecuzione completa. La suite globale è stata rieseguita da capo in sessione gestita, con exit 0.
- Capacità inattiva: modulo assente dal caricamento del gameplay, hook dei singleton non configurati, nessun flag URL o persistente. I tre blocchi restano ampliamenti coordinati, recupero multi-registro di Bram e collegamento autorizzato ai singleton.
- Consolidamento autorizzato soltanto su DEV, con `[skip dev deploy]`; nessuna pubblicazione richiesta. Safari/iPhone fisico non verificato.
