# Fase 4C — Inventario e Borsa, revisione locale

Base DEV f15e438040176ccac9bbe5dfeed76fbc02030898. Nessun commit/push/deploy.

## Audit e responsabilità

Nove pulsanti mischiavano sei categorie principali e tre sottocategorie gear.
Materiali ereditava statistiche e risorse duplicate sopra la Borsa. I dettagli
risorsa usavano il dialog condiviso a quasi tutta altezza e la paginazione del
layout fixed-screens, anche per una sola quantità. Il testo del dettaglio
esponeva il registro di origine e 'Non equipaggiabile' senza un'azione utile.

InventoryUI resta proprietario di categorie, rendering e handler. MaterialBagView,
contratto, metadati, lettori, coordinator e writer non modificati. FixedScreens
resta proprietario del layout; la modifica riconosce soltanto il detailKind
resource già esistente e ne evita la paginazione/altezza forzata. Equipaggiamento
mantiene il ramo originale, confronto, requisiti, equip/rimuovi/browse-slot.
Il dettaglio resource attuale non dispone di azioni Usa: non ne vengono inventate.
Consumabili resta raggiungibile anche quando il catalogo proiettato è vuoto.

## Gerarchia

Un select nativo di sei categorie: Tutti gli oggetti, Equipaggiamento,
Consumabili, Materiali, Oggetti missione, Altro. Solo Equipaggiamento mostra
il select contestuale Tutto/Armi/Armature/Accessori. Slot filtering, ordinamento
e preferenze di sessione conservati; un cambio esplicito di categoria azzera
solo slotFilter e scroll del pannello. Il ritorno da altre schermate conserva
categoria, ordinamento e contesto con la navigazione esistente.

Materiali apre direttamente la Borsa cinque colonne, quantità e icone temporanee,
raggruppamenti esistenti (etichetta Risorse invece di Progressione), occupazione
40/+10/100 proiettata. Niente griglia di pulsanti, saldi duplicati o spiegazioni
tecniche sull'attivazione. Stati vuota/piena/oltre capacità/illeggibile conservati.
Statistiche totali duplicate rimosse dalla presentazione Inventario, disponibili
in Eroe/Equipaggiamento; nessun dato cancellato. Saldi restano nei filtri pertinenti.

## Dettaglio

Stesso dialog/handler, layout resource proporzionato al contenuto, nella parte
bassa del viewport effettivo. Una sola superficie verticale scorrevole se il
testo è lungo, senza pager, con X >=48px, header visibile durante lo scorrimento,
safe area e visualViewport già disponibili. Armi/armature non adottano questo
layout. Simbolo provvisorio e quantità esatta; descrizione autentica se presente,
altrimenti omessa. Oggetti missione: testo neutro di rimando a Missioni.
Nessun registro di salvataggio o lore/ricette inventate nel dettaglio materiale.

Backdrop chiude solo se anche il pointerdown avviene fuori dal dialog; trascinare
da dentro a fuori non chiude. X/Escape restano nativi. Scroll/focus di ritorno
risorsa conservati in memoria, con lo stesso meccanismo della Fase 4B esteso agli
stack dell'Inventario, senza history/route supplementari o scritture.

## Test e limiti

I test storici scelgono ora opzioni native invece di toccare i nove pulsanti.
La fixture usa selectOption (eventi reali change), senza reveal DOM o click()
programmatici su controlli nascosti. Le asserzioni aria-pressed dei vecchi toggle
sono sostituite con aria-selected della stessa opzione; quantità, filtri,
persistenza, requisiti e azioni rimangono controllati. 'Non equipaggiabile' è
rimosso dalle aspettative del materiale per la richiesta UX, non per un bug.

La nuova suite inventory-ux4c-browser controlla quattro larghezze, otto dettagli,
dimensioni naturali, X/backdrop/drag, focus, testo lungo/ingrandito a tre altezze,
zero scritture, categorie/sottocategorie, capacità inattiva e overflow. Test
Fase4A/4B conservano corruzione/versioni future, vuota/piena/oltre capacità,
reload, crafting/raccolta e scroll. Screenshot 390 in test-results/inventory-ux4c.

Zoom del testo simulato, non collaudo OS reale. Picker nativo Safari e safe area
fisiche richiedono iPhone. Nessuna prova fisica Safari dichiarata. I materiali
non hanno descrizioni autentiche nel catalogo attuale: il campo viene omesso.

## Validazione globale e correzione del titolo

La suite globale è stata eseguita una sola volta: **68 superate, 8 fallite su 76**.
Tutti gli otto fallimenti denunciavano lo stesso overflow di #context-title,
reso erroneamente un elemento di focus largo 1px con testo tagliato tramite CSS.
Il test di audit ha individuato dx=69/dy=19. Correzione nel CSS, non nell'audit:
il titolo contestuale resta visibile e accessibile, il titolo duplicato nel
pannello Inventario è nascosto. Topbar e regole di navigazione restano invariati
nelle altre schermate. Nessuna modifica a timeout o aspettative di overflow.

Test interessati: fixed-screens, contextual-panels, sprint12-navigation,
fantasy-identity, interface-refinement, mobile-validation, equipment-sheet,
two-hand browser. Dopo la build sono ripetuti tutti e otto, insieme a tre engine
(vista, runtime, mobile-foundation) e ai due browser vista e UX4C.
Non viene avviata una seconda globale, rispettando il limite di una esecuzione.

90.000 snapshot legacy identici nella globale. Test locale aggiuntivo su singleton
reali: dettaglio già aperto segue gathering/crafting 3 → 5 → 2; la griglia mostra
anche il nuovo Ferro forgiato. Operazioni esplicite in context isolato, nessun
salvataggio reale coinvolto. Se un opener sparisce al refresh, il focus di ritorno
ripiega sul selettore di categoria. Anche questo caso è coperto dalla suite UX4C.

Gli script storici non registrati nel runner sono adattati al picker nativo e
verificati sintatticamente; non si dichiarano eseguiti. Il runner della suite
completa prevista dal progetto contiene ora 76 suite.

## Ripresa e chiusura delle verifiche — 2026-10-14

Checkout e tutti i 17 file locali recuperati senza ricostruzioni. Il processo
precedente non era più attivo. Il log post-build conservava cinque suite passate
ed undici dei dodici scenari fixed-screens; nessun risultato completo per gli
altri sette browser. Ripreso soltanto il caso 430×844 tramite copia in memoria
dello script originale con filtro sulla matrice, fuori dal repository: tutte
le asserzioni originali restano inalterate. Nessun test sorgente riscritto.

Completati e passati: fixed-screens (11 scenari recuperati + ultimo ripreso),
contextual-panels, sprint12-navigation, fantasy-identity, interface-refinement,
mobile-validation, equipment-sheet e two-hand. **Gli otto fallimenti relativi
al titolo sono risolti e verificati; nessun fallimento residuo nei test ripetuti.**

La build precedente precedeva l'ultima pulizia dei testi (niente 'registrati'
né contatore ampliamenti zero): aggiornata con build:web riuscita. Ripetuti
soltanto mobile-foundation engine (byte del pacchetto) e UX4C browser (nuova
asserzione sui testi). Il gruppo di ripresa registra **10 controlli passati,
0 falliti**, compreso l'ultimo scenario della matrice. Considerando i risultati
precedentemente completati, sono verificati i 13 test pertinenti previsti dopo
il fix. Non è stata rieseguita la globale: il suo esito storico resta 68/76,
con gli otto errori successivamente corretti e verificati separatamente.
I 90.000 snapshot identici recuperati dal log restano validi: nessun motore
è stato modificato nella ripresa. Nessun test saltato nel gruppo di ripresa.

Screenshot aggiornati a 390 px in test-results/inventory-ux4c. Limiti: Safari
fisico/picker iOS e zoom OS non verificati; grafica provvisoria; i materiali non
hanno descrizioni autentiche nel catalogo attuale e il campo è omesso. Gli altri
script standalone fuori runner non sono stati eseguiti (solo verifica sintassi).

### File della Fase 4C

- index.html
- inventory.js
- fixed-screens.js
- material-bag-view.css
- tools/run-tests.cjs
- tests/inventory-ux4c-browser.cjs (nuovo)
- tests/material-bag-view-browser.cjs
- tests/fixed-navigation-fixture.cjs
- tests/interface-refinement-browser.cjs
- tests/fixed-feedback-browser.cjs
- tests/sprint12-navigation-browser.cjs
- tests/armor-loot-browser.cjs
- tests/browser.cjs
- tests/class-build-browser.cjs
- tests/combat-browser.cjs
- tests/progression-browser.cjs
- docs/inventory-phase4c-ux.md (nuovo)

HEAD f15e438040176ccac9bbe5dfeed76fbc02030898 invariato. Capacità ordinaria
inattiva. Nessun commit, staging, push, merge, deploy o modifica a main/Colyseus.
Fase locale pronta per revisione; non si dichiara una seconda globale verde.

## Validazione finale autorizzata — 2026-10-14

Eseguita una sola suite globale sul codice finale: **76 suite superate, 0 fallite**.
Inclusi e superati gli otto browser relativi al titolo Inventario: fixed-screens,
contextual-panels, sprint12-navigation, fantasy-identity, interface-refinement,
mobile-validation, equipment-sheet e two-hand. **90.000 snapshot legacy identici**.
Build web riuscita; sette suite post-build superate: material-bag-view engine,
mobile-foundation engine, inventory-ux4c browser, material-bag-view browser,
equipment-sheet browser, inventory-compatibility browser e torre-silente-v1 browser.
Categorie, otto materiali, dettaglio compatto/X/backdrop/drag, scroll/focus e zero
scritture verificati a 320/375/390/430; capacità ordinaria ancora inattiva.
Le categorie consumabili mantengono la disponibilità reale del catalogo: non si
introducono azioni d'uso inesistenti. Gameplay, dati e requisiti non modificati.

Workflow sorgente invariato: push DEV -> test job -> dispatch della sola preview.
Workflow di destinazione letto su GitHub: checkout del branch DEV, gate dei test,
versione derivata da HEAD e ricontrollo SHA prima del deploy. Nessun deploy manuale.
API Actions e Pages attualmente bloccati dal proxy (CONNECT tunnel failed, 403):
questa limitazione impedisce di attestare CI/pubblicazione, anche dopo un push.
Il collaudo fisico Safari/iPhone resta da eseguire separatamente.
