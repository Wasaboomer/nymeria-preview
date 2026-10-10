# Sprint 2.8 — Navigazione MMORPG mobile

## Diagnosi verificata sul baseline e4c67109

Fixture normale (senza `?test=1`): Luci senza fiamma attiva con progressi
`[2,3,1,0]`, tre campioni posseduti, Bosco accessibile. Il motore reale conclude
il Cervo con una vittoria, QuestSystem riscuote mq03 e WorldSystem entra a Elar.
La sequenza di route prima della correzione era:

`places (Elar) → Back → quest mq03 → Back → battle (Cervo concluso)`.

`navigation.js` accodava ogni schermata, conservava anche i contesti dei tab e
ripristinava la route senza verificare la fine dell'incontro. `world-ui.js`
mostrava il persistito `lastEncounter` quando la route era `battle`: non veniva
avviato un nuovo combattimento, ma il vecchio risultato riappariva. Anche la
preparazione del Cervo era un flag UI indipendente dalla cronologia e poteva
riapparire tornando alla località.

## Navigazione

- Cronologia e contesti dei tab sono solo UI in memoria: nessuna nuova chiave di
  localStorage, nessuna migrazione o scrittura nei salvataggi.
- Un report concluso rimane visibile finché il giocatore lo consulta, ma non
  diventa una destinazione precedente. La pulizia considera anche i tab salvati.
- La preparazione è una route locale `activity: preparation`: Indietro torna al
  chiamante; Equipaggiamento → Indietro torna alla preparazione. L'avvio effettivo
  elimina le preparazioni dalla cronologia dell'incontro.
- «Torna a …» dal risultato torna esplicitamente alla località, anziché ripristinare
  arbitrariamente l'ultimo snapshot. Il comportamento geografico esistente del
  risultato (compreso il ritorno dopo sconfitta) non cambia.
- Eroe, Inventario, Missioni e Menu mantengono i rispettivi contesti. «Località
  attuale» torna al luogo persistito, senza spostare il personaggio o assegnare
  ricompense. Mappa apre sempre la panoramica geografica.
- I controlli mantengono il blocco già esistente durante un incontro attivo.
  Non cambia il motore, la pausa, il recupero offline o la conferma di abbandono.
- Al reload viene aperta la località persistita; un vecchio report non viene
  riproposto. Il recupero degli incontri ancora attivi resta al sistema esistente.

## Località

`locality-ui.js` raggruppa i controlli reali già renderizzati dal WorldUI:

- **Panoramica**: descrizione e destinazioni esistenti, con requisiti visibili.
- **Missioni**: tracker centrale e accesso al diario.
- **Incontri**: nemici e preparazione del kit, quando presenti.
- **Raccolta**: punti con raccolta e nodi delle professioni effettivamente esistenti.
- **Punti e servizi**: NPC, offerte/dialoghi e punti d'interesse reali.

Le sezioni prive di attività non producono tab. Non vengono duplicati tracker,
asset, event handler o dati di gioco. La sezione selezionata è ricordata per luogo
solo nella sessione UI. Le interazioni continuano ad usare i motori precedenti.

Il contenitore principale e la barra inferiore restano fissi. La località usa
scroll interno controllato; titolo e tab rimangono sticky. Gli elenchi non
richiedono più Prima/Dopo. Preparazione, risultati e combattimento conservano il
layout adattivo precedente. Safe area e altezza visualViewport sono gestite dal
sistema fixed-screens esistente. I nuovi controlli hanno target minimo di 44 px.

## Verifica

`NYMERIA_TEST_URL=http://127.0.0.1:8026 npm test` esegue build e suite complete.
La nuova `contextual-locality-browser.cjs` usa una fixture di vecchio salvataggio,
ma azioni UI e motori reali: Cervo → riscossione → Elar → Back, preparazione/kit,
consultazioni, un nuovo incontro a Elar, reload e rifiuto di pagamenti duplicati.
Verifica 320/375/390/430 px, altezze 568/667/844/932, gesture touch, tab sticky,
barra inferiore, nessun overflow orizzontale o scroll del documento, nessuna
scrittura di stato durante la sola navigazione e nessun errore JS/rejection.
I test precedenti coprono viaggio regionale, recupero offline, professioni,
progressione e percorso reale dall'inizio attraverso Bram e il Cervo fino a Elar.

I risultati finali della suite sono riportati nella consegna. Chromium con touch
ed altezze variabili non dimostra la compatibilità fisica Safari: restano da
collaudare su iPhone le barre Safari, le safe area reali, il cambio sezione dopo
scroll, Back da Elar e il ciclo background/chiusura/riapertura.

Nessun push, deploy, modifica a main, artwork, Avatar Lab o workflow.

### Risultati del ciclo locale

- Build web riuscita; 72 riferimenti locali verificati sia nel sorgente sia in
  `www`, nessun file mancante.
- Runner completo: **39 suite eseguite, 38 passate e 1 fallita nella prima
  esecuzione**. Il solo fallimento era il helper `textThroughPages`, che tentava
  un tap sul paginatore nascosto dopo la riscossione, mentre la località era
  passata allo scroll interno.
- Helper aggiornato per distinguere pannello interno e paginazione reale;
  `tests/fixed-screens-journey.cjs` rieseguita con **exit 0**, tutte le otto
  combinazioni 320/375/390/430 × Cacciatore/Custode passate. Copertura finale:
  **39 suite con esito positivo nel ciclo completo + riesecuzione, zero
  fallimenti residui**. Non si presenta il primo comando `npm test` come exit 0.
- Nuova suite località passata nel runner completo e nella verifica mirata:
  Cervo → riscossione → Elar → Back, nuovo incontro, consultazioni, salvataggi e
  quattro altezze per ciascuna larghezza, touch e assenza di errori JS/rejection.
- Nessuna regressione rilevata dai test dei motori, dell'interfaccia, del viaggio
  regionale o della progressione offline. Safari fisico non eseguito.
