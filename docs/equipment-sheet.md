# Sprint 2.8.3 — dettaglio equipaggiamento unificato

`InventoryUI.renderDetail()` resta l'unico renderer del dettaglio. Lo usano
inventario, lista per slot, equipaggiamento e confronto delle ricompense.
Il dialogo condiviso identifica il tipo di contenuto solo nel DOM: nessun nuovo
campo persistito. Solo i dettagli equipaggiamento escono dalla paginazione di
FixedScreens e usano `#detail-body` come superficie verticale scorrevole.
Le altre schermate e i dettagli delle risorse conservano il comportamento esistente.

Il titolo e la chiusura rimangono nell'intestazione del dialogo. Nel corpo:
identificazione/requisiti, statistiche e scelta slot, valutazione, confronto,
azioni e infine descrizione/consiglio esteso comprimibili. I nodi e gli handler
esistenti sono riutilizzati. Nessuna barra di azioni sovrapposta al fondo.

Equipaggia continua a chiamare `Equipment.equip` solo dopo un'azione esplicita;
restano canEquip, confronto e Gear Advisor. Gli stati già equipaggiato e non
utilizzabile conservano il controllo disabilitato con spiegazione del motivo.
Altri oggetti chiude il dialogo e usa `openSlot`/NymeriaNavigation già esistenti,
con il filtro slot incluso nella route; Back ripristina il contesto precedente.
Il confronto da ricompensa apre direttamente il dialogo sopra la missione, senza
un passaggio intermedio in Inventario. La chiusura non modifica la route.

Le traduzioni di livello, mani e categorie d'armatura e la rimozione di
«Asset provvisorio condiviso» sono proiezioni UI: GearData, identificatori,
descrizioni originali e formato dei salvataggi non cambiano.

Il test specifico copre 320/375/390/430 px, altezze 568/667/844, inset superiori
44 px e inferiori 34 px simulati, touch scroll reale Chromium, gerarchia,
confronto e pulsanti raggiungibili senza pager, apertura da ricompensa Corazza
della veglia/inventario/slot, miglioramento/peggioramento/parità, classe e livello,
scelta tra gli slot anello, nessun auto-equip, equip esplicito, filtro slot/Back,
persistenza e claim unico. Le fixture restano isolate dai dati dell'utente.
La suite generale delle schermate è aggiornata per verificare lo scroll del
solo dettaglio equipaggiamento, senza autorizzare overflow su altri contenitori.

Le safe area usano env(safe-area-inset-top/bottom) e l'altezza dinamica del
contenitore esistente. Gli inset simulati non dimostrano un collaudo fisico
Safari/iPhone, Android o tastiera nativa: queste verifiche restano da eseguire.
Nessuna modifica a renderer, gameplay, salvataggi, main, Avatar Lab o workflow.

## Esito della verifica

Build web di produzione riuscita. Ripetizione finale completa: 43 suite passate,
0 fallite (tutti i test del runner di progetto, con processi browser isolati).
Il test del pannello passa a 320/375/390/430 px e altezze 568/667/844 px.
Nella prima esecuzione completa era fallito il test di navigazione che tentava
ancora di usare la seconda pagina del dettaglio: aggiornato per verificare
scroll e apertura dall'inizio, passa sia isolatamente sia nella suite completa.
Nessun test fisico Safari/iPhone o Android eseguito.
