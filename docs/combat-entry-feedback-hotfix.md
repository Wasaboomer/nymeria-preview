# Sprint 2.8 — regressione intermittente ingresso in combattimento

## Diagnosi

Baseline: `dfede783469dbf42000c284a7b066df8043b1b00` sul solo DEV.
Il test isolato strumentato del percorso completo è passato nelle otto combinazioni:
la regressione non si presenta ad ogni esecuzione. Non è stato trasformato quel
passaggio in una prova di assenza del bug.

La riproduzione controllata usa un salvataggio isolato con Luci senza fiamma attiva,
Bosco accessibile e kit Cacciatore valido. Esegue realmente Esamina la lanterna,
apre Incontri, inizia un touch sul pulsante del Segugio e lo rilascia dopo la
scadenza **reale** del feedback di 3500 ms. Nessun forced click, retry, comando DEBUG,
modifica del timer o modifica dei salvataggi dell'utente.

Risultato prima della correzione:

- `touchstart`: pulsante `data-world-fight="corrupt-hound"`;
- alla scadenza `world-ui.js` svuota il messaggio;
- `.world-message:empty { display:none }` elimina la sua altezza dal normale flusso;
- nell'esempio 320 px, il pulsante passa da y=515,8125 a y=437,3125: **78,5 px**;
- il click finale raggiunge un `span` del progresso, non il pulsante;
- nessun comando al motore, `activeEncounter = null`, route ancora `world/places`;
- `#world-battle.hidden = true` è quindi corretto per quello stato.

I trace registrano route, incontro, eventi touch/click e attributi/style dei
contenitori. Il pannello World è visibile in modalità scroll; non è una route
battle nascosta da locality-ui o da un genitore. navigation.js non riceve alcuna
richiesta di ingresso nell'incontro. fixed-screens gestisce il pannello come
scroll interno, mentre locality-ui raggruppa gli elementi: il collasso del feedback
sposta le azioni reali in quel flusso.

Classificazione: **A, bug reale di interazione/layout, innescato da C, la coincidenza
intermittente fra timeout e gesto**. La verifica originale del test è valida;
non è stata indebolita. Non possiamo attribuire retroattivamente ogni precedente
fallimento non strumentato a questo solo trace, ma abbiamo riprodotto lo stesso
stato fallito e dimostrato un meccanismo concreto che lo produce.

## Correzione minima

Alla scadenza, WorldUI misura il feedback e riserva il suo spazio nei pannelli
World con scroll interno. Il testo scompare, ma le azioni non si spostano sotto
un gesto già iniziato. Il placeholder vuoto è invisibile e non contiene vecchie
informazioni; un nuovo messaggio non vuoto continua ad adattarsi naturalmente
senza altezza fissa né testo troncato. La riserva non viene applicata al layout
paginato di preparazione/risultato o al combattimento fisso.

Non si intercettano né bloccano gli eventi touch. Non cambiano timer di gioco,
combat engine, navigation stack, stat, ricompense, economia, salvataggi o artwork.
Le sole versioni cache aggiornate sono WorldUI e locality-ui.css.

## Test

- Il riproduttore temporaneo sul baseline perde il click; con il fix apre battle.
- Il nuovo `combat-entry-browser.cjs`, eseguito con WorldUI del commit precedente
  tramite risposta HTTP isolata, fallisce sulla geometria del pulsante (78,5 px).
- Lo stesso test sul fix passa da località e dettaglio missione a
  320/375/390/430 px: scadenza attraversata dal touch, geometria stabile, click
  diretto, incontro visibile, pausa/ripresa utilizzabili, vittoria, ritorno,
  reload e ricompensa unica. Sono controllati errori JS e rejection.
- `fixed-screens-journey.cjs` conserva l'assert originale di visibilità, senza
  forced click, retry o attese aggiunte per mascherare un tap perso; aggiunge
  soltanto dettagli diagnostici in caso di fallimento.
- Il runner passa da 39 a **40 suite** con la nuova regressione.
- Test isolato `fixed-screens-journey.cjs`: 8 combinazioni passate dopo il fix.
- Test isolato `combat-entry-browser.cjs`: 8 combinazioni passate dopo il fix.
- Due esecuzioni complete consecutive di `npm test`, ciascuna con build web
  di produzione e `NYMERIA_TEST_URL=http://127.0.0.1:8026`:
  prima **40 suite passate, 0 fallite, exit 0**;
  seconda **40 suite passate, 0 fallite, exit 0**.
  Entrambe comprendono il percorso completo, Cervo/preparazione, Elar/Indietro,
  nuovi incontri, barra inferiore, reload, progressione offline e ricompense uniche.

Condizioni pulite: ogni suite parte in un nuovo processo Node, ogni browser usa
profili/context isolati e i salvataggi fixture sono soltanto dei test; la build
ricrea `www`. Nessun salvataggio reale viene cancellato. Il server HTTP locale
serve file statici e non conserva stato di sessione.

Limite: touch Chromium/CDP e altezze variabili non sono una prova fisica Safari.
Su iPhone va ripetuto un tap mentre scompare il feedback, da località e missione,
poi Cervo → riscossione → Elar → Indietro. Nessun push o deploy è autorizzato.
