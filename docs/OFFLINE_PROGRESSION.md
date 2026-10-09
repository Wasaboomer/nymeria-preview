# NYMERIA — Sprint 2.4: persistenza temporale

## Audit e confini

Base: `b21a13c84a67cdbe038892632e601b589d108216` (Sprint 2.3), branch
`dev/kaelith-modular-character`, repository `Wasaboomer/nymeria-preview`.

Prima delle modifiche:

- Spedizioni: già `startedAt`/`endsAt`, seed, preparazione e report persistiti;
  esito deterministico alla scadenza, ricompense solo con riscossione atomica.
- Incontri Mondo: preparazione/regole/seed persistiti, ma clock solo RAF in memoria.
  `visibilitychange` e listener nativo imponevano pausa; il riavvio perdeva il tempo
  combattuto e la distinzione fra pausa manuale e sospensione del dispositivo.
- Tab Combattimento: esecuzione automatica delle priorità, ma regole modificabili
  durante lo scontro, reset al cambio configurazione, ticket di reward senza
  snapshot o cronologia delle modifiche. Non è un'attività durevole recuperabile
  senza aggiungere un protocollo di registrazione delle decisioni.
- Raccolta/crafting, interazioni NPC, viaggio, accettazione/consegna quest,
  contributi gilda: azioni esplicite e immediate. Nessun timer automatico da recuperare.

## Comportamento nuovo

Gli incontri Mondo nuovi hanno `clock` v1 nello stesso ticket ProgressionStore:
`elapsedMs`, `anchorAt` assoluto, `running`, `speed` (solo le velocità esistenti 1/2/4).
Il tempo logico è `elapsedMs + max(0, now - anchorAt) * speed`, limitato ai 180 s
**già previsti** dalla simulazione degli incontri Mondo. Nessuna simulazione infinita.

Il motore CombatEngine è invariato. Seed, stats, effetti, template nemico e regole
salvati alla partenza ricostruiscono lo stesso combattimento; le priorità AUTO o
PERSONALIZZATA già salvate non richiedono decisioni inventate. Si recupera un solo
incontro autorizzato, senza iniziarne altri, ripetere farming o equipaggiare loot.
Il risultato usa la stessa logica di ricompense/quest già esistente.

- Aperto: RAF rende il tempo assoluto, senza rallentare logicamente il combattimento
  quando mancano frame.
- Background: si ferma la presentazione, non il clock automatico persistito.
- Riapertura/pageshow/foreground nativo: replay del tempo trascorso; completamento
  e ricompense insieme nella transazione esistente. Non servono timer background.
- Pausa manuale: accumula il tempo e persiste `running:false`. Riavvio e foreground
  non la revocano. Riprendi registra un nuovo anchor; il periodo in pausa non conta.
- Cambio velocità: chiude il segmento precedente e registra la nuova velocità;
  non applica retroattivamente la nuova velocità a tutto il combattimento.
- Listener ripetuti o refresh concorrenti: controllano il ticket e il suo stato
  dentro la transazione. Ticket consumato + receipt + reward nello stesso commit.
  Anche un tentativo di pausa arrivato dopo il completamento salva il risultato una volta.

Le Spedizioni mantengono durata, bilanciamento e claim manuale. Vengono riconciliate
anche al foreground nativo e pageshow; il report è pronto dopo la scadenza, ma XP,
materiali e loot richiedono ancora **Riscuoti**. Nessuna riscossione automatica.

## Compatibilità e storage

Nessuna nuova chiave o reset; schema globale invariato, campo `clock` additivo.
Gli incontri precedenti senza clock restano in attesa di **Riprendi**: il vecchio
`startedAt` non prova quanto tempo il giocatore avesse combattuto o messo in pausa.
Snapshot, quest, XP, materiali, equipaggiamento e inventario restano conservati.
Clock malformato è trattato come legacy senza inventare tempo. Versione clock futura
blocca le scritture come gli altri salvataggi futuri, senza sovrascriverla.

Scrittura negata/quota: pausa/ripresa/completamento non vengono applicati in memoria
come se fossero salvati; ticket e ricompense sono ritentabili. Un completamento non
salvato resta in attesa, non genera una seconda ricompensa. Storage cancellato o
corrotto integralmente non può essere ricostruito: nessuna garanzia di recupero di
bytes non disponibili, né persistenza dopo disinstallazione.

## Orologio locale e sicurezza

Timestamp non finiti, negativi o oltre 1e15 sono rifiutati. Tornare indietro con
l'orologio non produce tempo negativo: il clock resta fermo fino a raggiungere
l'anchor precedente. Cambi molto avanti possono completare un'attività; il cap
limita il lavoro di replay, **non** rende affidabile l'orologio.

**Il sistema locale non è sicuro contro manipolazioni dell'orologio o dei salvataggi.
La versione multiplayer richiederà un backend autorevole**, identità delle attività,
ledger/transazioni server e tempo server. Nessuna sincronizzazione cloud introdotta.

## Limiti espliciti

Il tab Combattimento resta in pausa al background e perde lo scontro in memoria
al riavvio, come prima: non vengono ricostruite modifiche alle priorità non salvate
come eventi. Viaggio, NPC, scelta missioni, raccolta, crafting, claim Spedizioni e
altre azioni esplicite non vengono simulate durante l'assenza.

Il codice nativo e lo smoke Android sono aggiornati al contratto nuovo; questo
sprint non li presenta come test nativi eseguiti. Non disponibili test fisici,
Xcode o emulatore locale; restano i limiti di disconnessione ADB dello Sprint 2.3.
Nessuna pubblicazione preview, store o TestFlight, nessuna modifica al repository
separato della preview. Il commit è locale sul branch DEV, senza push/deploy.

## Verifiche

- `tests/offline-progression-engine.cjs`: scadenza aperto/background/riavvio,
  ritorno anticipato, pause/resume e velocità, vecchi ticket, clock corrotti/futuri,
  write failure/retry, completamento vs pausa, claim ripetuti, entrambe le classi e
  priorità AUTO/PERSONALIZZATA, anomalie timestamp e limite replay.
- `tests/offline-progression-browser.cjs`: 320/375/390/430, controlli reali
  Pausa/Riprendi, evento foreground del bridge, chiusura/nuova pagina, reload,
  tempo arretrato, risultato persistito una sola volta, claim Spedizioni,
  assenza di errori JS/rejection e overflow orizzontale.
- Clock delle prove controllato per simulare l'assenza, senza attendere minuti.
  È QA Chromium, non un test fisico o prova che il sistema operativo esegua JS in background.
- Suite precedente rieseguita; risultati conclusivi riportati alla consegna.


### Risultati conclusivi locali

Suite completa `npm test`: **30 suite eseguite (17 engine + 13 browser)**,
28 superate nella prima esecuzione e 2 fixture browser da aggiornare.
`fixed-battle-browser` cercava Riprendi nello stato iniziale ora automatico:
richiede ora una pausa esplicita prima della verifica del layout.
`contextual-combat-browser` presumeva tre secondi di scontro sempre disponibili,
ma il Cacciatore può vincere in 2,85 s: seed/clock QA deterministici e campione
prima della vittoria, con attesa del commit della pausa. Le due suite sono state
rieseguite e superate; **0 fallimenti residui**. I test del completamento restano
separati e verificano pagamento/receipt, senza aspettarsi un engine dopo la vittoria.

La suite offline engine finale ha **16 controlli superati**. La suite offline
browser passa a tutte le quattro larghezze, con controlli touch reali ed evento
foreground simulato; suite foundation e integrazione World rieseguite verdi.
Controlli di sintassi e `git diff --check` superati. `npm run sync:mobile` riuscito;
APK debug compilata localmente (`assembleDebug --offline`), senza installazione,
avvio emulatore, iOS compile o test fisico in questo sprint.

File di log locali (fuori Git): `/tmp/s24-all-tests.log`,
`/tmp/s24-battle-repeat.log`, `/tmp/s24-contextual-final.log`,
`/tmp/s24-offline-engine-final.log`, `/tmp/s24-offline-browser-final.log`.
Nessuna CI remota o pubblicazione attivata: il commit resta locale.
