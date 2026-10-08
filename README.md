# Nymeria Character Progression & First Idle Loop 0.1 — M5

M5 aggiunge XP/livelli, crescita reale delle statistiche e un primo ciclo persistente di spedizioni alla base Equipment/Inventory, Combat e Class/Build. Base Equipment & Inventory 0.1: manichino SVG e art direction esistenti, 16 slot, inventario di 49 oggetti demo (44 originali più un kit Mail completo) e regole centralizzate. Nessun framework, backend, build obbligatoria o dipendenza runtime. GitHub Pages può servire direttamente la radice.

## Avvio e test

```sh
python3 -m http.server 8000
```

Aprire la pagina sulla porta 8000. La persistenza usa l'origine HTTP corrente: lo stato locale di sviluppo non viene trasferito automaticamente a GitHub Pages o a un altro browser.

Per eseguire i test reali del browser, con server attivo e Playwright disponibile nell'ambiente di sviluppo:

```sh
node tests/browser.cjs
```

Il cloud fornisce già Playwright e Chromium. In altri ambienti, installare separatamente Playwright come strumento di sviluppo; non serve alla pagina. Variabili opzionali: `NYMERIA_TEST_URL` (default `http://127.0.0.1:8000`) e `NYMERIA_CHROMIUM` (default `/usr/bin/chromium`).

I test touch coprono 320/390/430 px: tutte le famiglie arma/supporto, 2H, slot doppi, equip/rimozione corazza, confronto, totali e Potere, filtri e ordinamento, effetti descrittivi, persistenza, Reset demo, overflow e errori JS. A 390 px verificano inoltre i 49 oggetti demo: equipaggiamento degli utilizzabili e rifiuto di Cloth/Leather e i relativi gruppi SVG. Controllano storage negato e normalizzazione di dati incoerenti. Chromium in emulazione mobile non sostituisce una prova su Safari/iPhone fisico.

## Moduli

| File | Responsabilità |
| --- | --- |
| `items.js` | Asset SVG e palette del manichino originale; nessuna statistica gameplay. |
| `equipment-data.js` | Catalogo, 16 slot, rarità, icone e metadati degli effetti. |
| `equipment.js` | Stato, compatibilità, equip/rimozione, confronto, statistiche, Potere e persistenza. |
| `character.js` | Rendering dei gruppi SVG da `appearanceItem` e riepiloghi statistiche. |
| `inventory.js` | Pannelli equipaggiamento/inventario, filtri, ordinamento e dialogo di confronto. |
| `app.js` | Collegamento moduli, Character Creator con blocco persistente e UI separata di Equipment Appearance. |
| `styles.css` / `index.html` | UI, struttura, materiali e animazioni del prototipo. |

## Modello e regole

Ogni oggetto ha `id`, `name`, `slot` (famiglia), `type`, `rarity`, `itemLevel`, `requiredLevel`, `stats`, `description`, `equipped`, `effects` e `appearance`. Le armi principali hanno inoltre `handedness`, `weaponType` e `allowedSupports`. Tutti gli oggetti demo richiedono livello 1, con competenza armature richiesta; la regola sul requisito di livello è già centralizzata.

I 16 slot concreti contengono `{ equippedItem, appearanceItem }`. Le famiglie `ring`, `earring` e `bracelet` possono essere assegnate a due destinazioni indipendenti; una stessa istanza non può occupare due slot. Il dialogo permette di scegliere SX/DX e confronta con la destinazione selezionata. Le statistiche vengono lette esclusivamente da `equippedItem`, il rendering esclusivamente da `appearanceItem`: il glamour completo non è ancora implementato.

Le armi 2H (bastone, spadone, lancia) bloccano logicamente il supporto. Un supporto incompatibile, anche dopo cambio di arma 1H, torna nella sacca. Il tentativo di equipaggiare direttamente un supporto incompatibile viene rifiutato senza modificare lo stato. Arco e balestra occupano il solo slot principale nel modello demo (`1H` come occupazione logica) per consentire faretra/dardi nel supporto; non indica una tecnica fisica di impugnatura.

L'inventario mostra l'intera collezione con posizione e indicatore equipaggiato; il conteggio distingue sacca ed equipaggiati. Nessun oggetto viene duplicato o perso durante una sostituzione. Il confronto mostra la variazione totale dopo l'operazione, compresa la rimozione di un supporto incompatibile o lo spostamento da SX a DX.

Statistiche base al livello 1: Forza 12, Agilità 15, Vigor 14, Spirito 11; Critico, Velocità e Armatura partono da zero. Il Potere è calcolato in un solo punto:

```text
2 × Forza + 2 × Agilità + Vigor + 2 × Spirito
+ 3 × Critico + 2 × Velocità + Armatura
```

Critico e Velocità sono punti percentuali nel prototipo. Gli effetti speciali sono dati strutturati (`trigger`, `modifier` o `status`). Combat 0.1 interpreta il solo hook `thorn-bleed` della Faretra delle Spine; gli altri effetti restano descrittivi.

## Persistenza e rappresentazione

La chiave `nymeria.equipment.v1` conserva inventario, equipaggiamento, configurazione personaggio, statistiche e Potere. Le bozze e le modifiche consentite vengono salvate automaticamente; **Crea personaggio** conferma una volta l'aspetto e blocca il Creator soltanto dopo una scrittura riuscita. Al caricamento i dati vengono validati contro il catalogo, i duplicati vengono eliminati e statistiche/Potere ricalcolati. L'aspetto del vecchio prototipo viene importato da `nymeria.character.v1` se manca il nuovo salvataggio. **DEBUG · Reset equipaggiamento demo**, solo Test Mode, ripristina il kit senza riaprire il Creator o cambiare l'aspetto personale già confermato; conserva progressione, risorse e loot. **Casuale** è disponibile soltanto nel Creator aperto e cambia capelli/occhi, mantenendo equipaggiamento e tintura.

Il rig conserva la geometria originale e aggiunge gruppi per i nuovi slot. Aggiornare uno slot non ricrea i figli degli altri gruppi. La tintura resta nel solo canale degli inserti della corazza, senza filtri globali. Gli slot vuoti possono mostrare abiti base del manichino, che non conferiscono statistiche. Alcuni oggetti condividono una silhouette provvisoria; gli accessori più piccoli sono segni SVG tecnici, non asset definitivi. `nymeria-art.png` è conservata e non utilizzata.

Per un nuovo oggetto, aggiungere dati a `equipment-data.js` e un asset/mapping a `character.js`; le regole di compatibilità restano in `equipment.js`. Non sono implementati party, dungeon, crafting, classi definitive, backend, multiplayer o monetizzazione.


## Class & Build 0.1 — M4

Il tab **Classe** permette il cambio libero tra **Custode** e **Cacciatore** e la selezione di una tendenza principale. Conserva l'inventario; le armature incompatibili tornano in sacca, senza sostituzioni automatiche. I requisiti di combattimento sono **Spada 1H + Scudo** e **Arco + Faretra**: la UI spiega il kit richiesto e gli oggetti attuali, porta a Equipaggiamento e rifiuta l'avvio se il kit manca. Anche un profilo marcato `kitValid: false` non può avviare il motore.

### Architettura estesa

| Modulo | Responsabilità |
| --- | --- |
| `classes-data.js` | Identità, ruolo, risorsa, statistiche preferite, tipi arma/supporto, abilità, passiva, modificatori, AUTO, sei tendenze, metriche di riepilogo. |
| `class-system.js` | Selezione/persistenza, requisito kit e composizione di un profilo di combattimento. Nessuna copia delle statistiche degli oggetti. |
| `build-system.js` | Compatibilità per classe, pesi/score, componenti effetti e hook futuri per sinergie/set; consigli per gli oggetti posseduti. |
| `class-ui.js` | Pannello Classe, schede abilità, selezione tendenza e pesi dichiarati provvisori. |
| `combat-data.js` | Formule comuni, kit legacy, nemico, effetti/hook, condizioni e normalizzazione parametrizzata sul profilo. |
| `combat-engine.js` | Motore puro a passi fissi: risorse, abilità, effetti, mitigazione/blocco, log e risultati. Non confronta ID/nome delle classi. |
| `combat-ui.js` | Bridge all'Equipment System, un clock RAF, risorsa sotto HP, strategie separate per classe e risultati. |
| `inventory.js` | UI esistente con indicatori discreti e score nel confronto. |
| `navigation.js` | Bootstrap indipendente dai moduli; cinque tab, tastiera e `hidden`. |

Il motore continua a usare copie di `Equipment.state.resultingStats` e degli effetti degli oggetti effettivamente equipaggiati. `create({ stats, effects, rules, seed, profile })` estende la vecchia API: senza `profile` il kit Combat 0.1 rimane disponibile per regressione. Il profilo contiene abilità, risorsa, modificatori, effetti, AUTO e metadati classe/build. La simulazione non accede a DOM/storage e non muta Equipment. Per aggiungere una classe usare dati e hook generici; una meccanica nuova richiederà un hook del motore, non un controllo sul nome della classe.

Cambiare classe, tendenza o equipaggiamento azzera lo scontro (anche in pausa) e aggiorna il profilo. Cambiare soltanto capelli/occhi/tintura aggiorna il manichino senza interromperlo. I preset AUTO seguono la build; PERSONALIZZATA mantiene ordine e condizioni separatamente per ciascuna classe. Disponibili otto condizioni: Sempre, debuff assente, buff assente, HP nemico < X%, HP giocatore < X%, abilità pronta, Risorsa > X, Risorsa < X. Si può scegliere quale buff/debuff controllare. Tutte le soglie sono confronti stretti.

### Risorse e abilità

**Cacciatore:** Concentrazione iniziale 100/100, rigenerazione 6/s; Tiro Rapido recupera 4 punti. Statistiche desiderate: Agilità, Critico e Velocità. Il kit conserva Sanguinamento e il vero hook `thorn-bleed` della Faretra delle Spine.

| Abilità | Danno (base × coefficiente + bonus) / effetto | CD | Costo |
| --- | --- | --- | --- |
| Tiro Rapido | 0,65 + 8; recupero 4 | 0 s | 0 |
| Freccia Lacerante | 0,55 + 4; Sanguinamento | 4 s | 12 |
| Tiro Potente | 1,8 + 12 | 6 s | 28 |
| Colpo Finale | 0,85 + 8; ×2,3 sotto 25% HP nemico | 5 s | 22 |
| Passo del Vento | 6 s: Agilità +8, Velocità +20 punti, Schivata +12 punti | 12 s | 10 |

**Custode:** Risolutezza iniziale 0/100, nessuna rigenerazione passiva; +10 quando un colpo raggiunge il giocatore, +18 aggiuntivi se bloccato. Un colpo schivato non genera risorsa. I costi limitano la difesa attiva e il contrattacco. Passiva **Baluardo**, con kit valido: Armatura ×1,6, HP ×1,15, mitigazione aggiuntiva 12%, blocco 23% che dimezza il colpo. Statistiche desiderate: Vigor, Armatura, Forza.

| Abilità | Danno / effetto | CD | Costo |
| --- | --- | --- | --- |
| Fendente | 0,65 × base + 6 | 0 s | 0 |
| Guardia Ferrea | 6 s: mitigazione +18 punti, blocco +25 punti | 10 s | 15 |
| Colpo di Scudo | 0,9 × base + 10; Sbilanciato: danno nemico −15% per 4 s | 5 s | 10 |
| Ritorsione | 1,15 × base + 8 + 1,6 × Risolutezza spesa | 4 s | 30 |
| Ultimo Baluardo | 7 s: mitigazione +35 punti, blocco +20 punti; AUTO sotto 35% HP | 20 s | 20 |

I guadagni sono limitati al massimo; la metrica «generata» conta i punti effettivamente recuperati, escludendo quelli persi al cap. I costi vengono verificati prima della selezione/azione e non rendono negativa la risorsa. Il modello supporta anche perdita al secondo (`decay`, attualmente 0 per entrambe le classi) e guadagni da eventi. Durante la pausa non rigenera e non decade nulla.

### Sei tendenze reali

| Classe / tendenza | Effetto sul combattimento | AUTO (in ordine) |
| --- | --- | --- |
| Custode / Baluardo | Blocco +12 punti; Guardia dura 8 s e aggiunge altri 8 punti mitigazione / 10 blocco | Ultimo Baluardo → Guardia → Ritorsione (>45 risorsa) → Scudo → Fendente |
| Custode / Ritorsione | Generazione Risolutezza ×1,5; danno Ritorsione ×1,35 | Ultimo Baluardo → Ritorsione (>29) → Scudo → Guardia → Fendente |
| Custode / Comando | Sbilanciato dura 6 s e riduce il danno nemico del 25%; base per futura utilità di gruppo | Ultimo Baluardo → Scudo → Guardia → Ritorsione → Fendente |
| Cacciatore / Predatore | Critico +5 punti; danno Tiro Potente ×1,15 | Finale → Potente → Lacerante → Vento → Rapido |
| Cacciatore / Laceratore | Tick Sanguinamento ×1,45, durata +2 s | Lacerante → Finale → Potente → Vento → Rapido |
| Cacciatore / Esploratore | Velocità +8 punti; rigenerazione ×1,25; Vento dura 8 s | Vento → Lacerante → Finale → Potente → Rapido |

Ogni riga conserva le condizioni dell'abilità (es. debuff/buff assente, Finale sotto 25%, Ultimo Baluardo sotto 35%), non lancia abilità alla cieca. Queste tendenze sono una singola scelta provvisoria; nessun albero talenti o specializzazione rigida.

### Formule provvisorie

Con F = Forza, A = Agilità, V = Vigor, S = Spirito, C = Critico, Ve = Velocità e Ar = Armatura:

```text
HP = round((160 + 9 × V) × moltiplicatore HP del profilo)
Base Cacciatore/legacy = 8 + 0,75 × F + 1,3 × A + 0,3 × S
Base Custode = 8 + 1,6 × F + 0,25 × A + 0,2 × S
Danno diretto = (base × coefficiente + bonus + costo × danno-per-risorsa)
                × modificatore classe (Custode 0,95) × modificatore abilità/build
                × eventuale critico × 100/(100 + Ar bersaglio)
Critico = min(60%, clamp(5% + 0,15% × A + C%, 0%, 60%) + bonus build)
Moltiplicatore critico = 1,75
GCD = max(0,55 s, 1,6 s / (1 + Ve/100 + A/200))
Schivata = clamp(0,1% × A + buff, 0%, 35%)
Danno nemico = danno attacco × (1 − riduzione Sbilanciato, cap 80%)
              × 100/(100 + Armatura effettiva)
              × (1 − mitigazione complessiva, cap 80%)
              × (1 − riduzione blocco, cap 90%) se il colpo è bloccato
Probabilità blocco = min(80%, passiva + build + buff)
```

Danni arrotondati e limitati agli HP rimasti; minimo 1 per un colpo andato a segno. La risorsa usa valori frazionari e un epsilon numerico. Il riepilogo conta danno effettivo, DPS, danno subito, critici e abilità più usata; aggiunge classe/build, risorsa generata/usata, Sanguinamento per Cacciatore e mitigazione/blocchi per Custode. «Danno mitigato / bloccato» confronta il danno base dell'attacco con quello ridotto da debuff, armatura, mitigazione e blocco; non include le schivate.

Sanguinamento: tick ogni secondo, base ×0,12 prima della mitigazione, durata 6 s, nessun critico, 1 stack per sorgente. Il refresh conserva la cadenza e il massimo di potenza/scadenza. Faretra delle Spine: ogni `rangedHit` ha probabilità 30% di applicare/rinnovare il bleed con tick ×1,35 e +2 s. I modificatori Laceratore si combinano: tick ×1,45×1,35 e durata 10 s sul proc. Origine attore/abilità/oggetto viene mantenuta; gli altri effetti degli oggetti restano descrittivi.

Guardiano invariato: 1050 HP, Armatura 35, attacco ogni 2,4 s, primo colpo a 1,2 s; danno 44, speciale 72 con CD 8 s. Il tempo avanza in passi fissi 50 ms con RNG a seed interno. Un solo RAF gestisce 1×/2×/4×. Il background mette in pausa senza simulazione offline. Log massimo 60 eventi.

Misure ripetibili (seed 1, equipaggiamento iniziale più kit richiesto): Cacciatore/Predatore vince in **19,95 s**, **52,6 DPS**, **252 danni subiti**; Custode/Baluardo vince in **36,3 s**, **28,9 DPS**, **238 danni subiti**, **9 blocchi**. Danni subiti al secondo circa **12,6 contro 6,6**. Eliminando gli altri slot, Cacciatore perde con seed 1 e Custode perde con seed 3. Strategie che non attaccano/ignorano i difensivi possono perdere: non esiste una vittoria garantita. Sono esempi, non un bilanciamento definitivo.

### Gear Advisor provvisorio

`scoreItemForBuild(item, classId, buildId)` è centralizzata; restituisce `null` per armatura, arma o supporto incompatibile con la classe. `scoreBreakdown` distingue statistiche, effetti riconosciuti e sinergie; `registerScoreHook` offre l'estensione per effetti/set contestuali futuri. Nessun punteggio basato sul solo item level.

```text
Score = Σ (statistica oggetto × peso classe/tendenza)
        + peso effetti riconosciuti + contributi hook sinergie
↑ Miglioramento: candidato non equipaggiato, equipaggiabile nello slot,
                score − score attuale > max(2 punti, 5% del valore attuale)
★ Migliore posseduto: score massimo tra gli oggetti posseduti compatibili
                     con quello slot/classe/build e requisito livello (pari merito inclusi)
```

| Tendenza | Forza | Agilità | Vigor | Spirito | Critico | Velocità | Armatura |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baluardo | 1,2 | 0,4 | 3,5 | 0,4 | 0,5 | 0,8 | 3,5 |
| Ritorsione | 3 | 0,6 | 2,4 | 0,4 | 1,4 | 1 | 2,2 |
| Comando | 1,5 | 0,5 | 2,8 | 1 | 0,6 | 2 | 2,8 |
| Predatore | 1 | 3 | 1 | 0,3 | 4 | 2 | 0,5 |
| Laceratore | 1,2 | 3,5 | 1 | 0,4 | 1,8 | 2,4 | 0,5 |
| Esploratore | 0,8 | 2,5 | 1,2 | 0,4 | 2 | 4 | 0,6 |

Laceratore attribuisce inoltre **18 punti** all'effetto `thorn-bleed`. Altri effetti non ancora implementati non ricevono bonus inventati. I pesi sono dichiaratamente provvisori: il consiglio valuta lo slot, non ottimizza tutto il kit o simula il DPS. Il migliore posseduto può essere già equipaggiato; gli slot doppi non duplicano oggetti e il consiglio non promuove lo spostamento di un oggetto già equipaggiato altrove. Il confronto esistente resta la fonte per il delta reale dell'intero equipaggiamento. Inventario conserva anche gli oggetti incompatibili; nessun filtro/cancellazione imposti dalla classe. Non viene usata l'etichetta BIS nell'interfaccia.

### Persistenza, regressioni e limiti

- `nymeria.classes.v1`: classe scelta e tendenza conservata per ciascuna classe.
- `nymeria.combat.v2`: modalità, regole e velocità per ciascuna classe. Importa le preferenze `nymeria.combat.v1` nel Cacciatore. Nessuno scontro viene salvato.
- Equipment e aspetto mantengono le chiavi e normalizzazione precedenti. Reset demo è un controllo DEBUG/Test Mode: ripristina il kit, conservando aspetto personale creato, classe, strategie, XP e ritrovamenti; Reset combat azzera solo l'incontro.
- In caso di storage negato/dati non validi si usano default e messaggi discreti, senza bloccare tab o gameplay. Gli asset condividono `?v=idle-0.1` per evitare versioni cache miste.

```sh
node tests/class-build-engine.cjs
node tests/class-build-browser.cjs
node tests/combat-engine.cjs
node tests/combat-browser.cjs
node tests/browser.cjs
node tests/navigation.cjs
```

M4 verifica entrambe le classi, sei tendenze, risorse/costi/eventi/rigenerazione/perdita, requisiti kit, statistiche reali, passive/modificatori effettivi, AUTO e strategie per classe, otto condizioni, Faretra delle Spine, score/confronti/indicatori, risultati, vittorie/sconfitte, determinismo e persistenza/migrazione. Browser touch: 320/390/430 px, errori JS e overflow, classi/build, pausa/riprendi/reset, risultati e advisor. Combat e Equipment/Inventory mantengono le suite di regressione; i test del browser Combat sono aggiornati per l'AUTO Predatore, la risorsa e i nuovi campi risultato. I 12 test legacy del motore rimangono validi senza profilo.

UI mantenuta provvisoria; nessun asset definitivo, creazione personaggio completa, set bonus attivo, composizione di più tendenze o Gear Advisor globale. Nessun party, aggro multiplayer, healer, loot, quest, dungeon, raid, crafting, professioni, PvP, backend o monetizzazione. Chromium mobile non sostituisce Safari/iPhone fisico.

## M5 — Character Progression & First Idle Loop 0.1

Il ciclo ora è: **preparo classe/build/equipaggiamento → scelgo Spedizioni → attendo online o offline → leggo il report → riscuoto XP, Corone, materiali e loot → salgo di livello e miglioro il kit → sblocco attività più difficili → riparto**. Non è implementata una ripetizione automatica: una spedizione termina nel report e richiede una nuova partenza dopo la riscossione.

La UI precedente è mantenuta. Il nuovo tab **Spedizioni** mostra la **Frontiera del Vespro**, risorse, rischio, requisiti, stato in corso e report. La barra XP è reale, nella schermata Personaggio e in forma compatta in Spedizioni. L'identità mostra il livello effettivo. Il level-up compare nel feedback Personaggio, nel report e nella notifica. Inventario mostra Corone e i tre materiali senza trasformarli in slot equipaggiamento.

### Moduli M5

| File | Responsabilità |
| --- | --- |
| `progression-data.js` | Curva XP, soglie, cap, eccedenza, crescita base e nomi materiali. |
| `progression-store.js` | Record locale versionato, validazione/normalizzazione e transazioni di progressione; serializzazione fra tab tramite Web Locks quando disponibili. |
| `progression-system.js` | Partenza, snapshot, scadenza, interruzione, claim, riconciliazione Equipment e Test Mode. |
| `expedition-data.js` | Quattro attività, durate, incontri, difficoltà, premi, loot table e sei eventi. |
| `expedition-engine.js` | Risoluzione deterministica degli incontri usando lo stesso Combat Engine; stima rischio basata su simulazioni. |
| `expedition-ui.js` | XP, risorse, pannello Spedizioni, countdown, report, bentornato e controlli di sviluppo. |

`equipment.js` conserva l'unico algoritmo di somma delle statistiche: usa basi di livello da ProgressionData, poi somma gli oggetti. Classe/build e buff restano nel profilo/effectiveStats del Combat Engine. `equipment-data.js` contiene undici oggetti fissi di loot, separati dai 49 oggetti demo; tutti riusano asset esistenti. `build-system.js` estende il consiglio con un candidato appena trovato prima della riscossione. `combat-engine.js` aggiunge soltanto un template nemico parametrico e l'opzione headless `captureLog: false`: niente secondo motore matematico.

### XP, cap e crescita

```text
Livello iniziale = 1; cap = 20
XP richiesta per passare da L a L+1 = round(80 × L^1,35), per L < 20
Esempi: L1 80; L2 204; L3 353; L4 520; L5 703; L8 1325
XP totale per raggiungere L20 = 36597
XP corrente = XP totale − soglia cumulativa del livello corrente
Al cap: XP corrente/necessaria = 0; XP totale continua a crescere
XP eccedente = XP totale − 36597, conservata nel record
```

Livello, XP corrente/necessaria ed eccedenza vengono ricalcolati dall'unica fonte `totalXP`. Una ricompensa grande può superare più soglie e registra tutti i level-up. Al cap la barra mostra **MAX** e XP totali, senza suggerire un livello 21. Contatori e ingressi numerici sono normalizzati a interi non negativi, con un limite tecnico di 1 miliardo nel prototipo.

```text
Base livello L = base livello 1 + (L − 1) × crescita
Crescita per livello: definita da `ClassesData.classes[classId].statGrowthPerLevel`
Custode: Forza +2, Agilità +0, Vigor +3, Spirito +1, Critico +0
Cacciatore: Forza +0, Agilità +3, Vigor +1, Spirito +0, Critico +0,5 punti percentuali
Velocità e Armatura base: nessuna crescita automatica
Totali Equipment = base livello + statistiche oggetti
Statistica effettiva Combat = totali Equipment + classe/build + buff/modificatori
HP = (160 + 9 × Vigor totale) × eventuale moltiplicatore del profilo, arrotondato
```

A parità di oggetti il livello 10 aggiunge al Custode Forza +18, Vigor +27 e Spirito +9; al Cacciatore Agilità +27, Vigor +9 e Critico +4,5 punti. I test confrontano davvero gli incontri con lo stesso kit ai due livelli. Il requisito di livello degli oggetti usa questa progressione, non il vecchio Liv. 1 fisso.

### Quattro spedizioni

| Attività | Durata reale | Livello | Incontri base | Nemico: HP / danno / armatura rispetto al Guardiano | Eventi per incontro | XP base se completa |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| Pattuglia delle Rovine | 1 min | 1 | 3 | ×0,32 / ×0,5 / ×0,5 | 35% | 90 |
| Sentiero Spezzato | 5 min | 3 | 5 | ×0,75 / ×0,75 / ×0,8 | 40% | 200 |
| Ricognizione del Vespro | 15 min | 5 | 8 | ×1 / ×1 / ×1,1 | 45% | 480 |
| Veglia della Frontiera | 30 min | 8 | 15 | ×1,5 / ×1,35 / ×1,4 | 50% | 1140 |

XP per incontro vinto: rispettivamente **18 / 30 / 45 / 60**. Bonus completamento: **36 / 50 / 120 / 240**. Corone per incontro: **4 / 6 / 9 / 12**, bonus finale **8 / 15 / 24 / 40**. Materiali per incontro: **1 / 2 / 3 / 4**, alternando Ferro del Vespro, Fibra Lunare e Polvere d'Etere; gli eventi possono aggiungerne. I premi base crescono con l'attività e non con il tempo tenuto aperto il browser.

I requisiti vengono derivati dal livello nel record `unlockedContent`; la UI bloccata mostra «Si sblocca al livello X». L'architettura usa durate in millisecondi e può supportare ore senza timer persistenti (il validatore attuale consente fino a sette giorni per incarico).

### Stima rischio e incontri

La stima **Facile / Adeguata / Difficile / Pericolosa** non usa Potere o una percentuale inventata: risolve la stessa attività con la preparazione corrente su tre seed fissi (`11, 29, 71`). Tre successi con HP finale medio ≥50% → Facile; tre successi con HP inferiore → Adeguata; almeno un successo → Difficile; nessun successo → Pericolosa. Include livello, equipaggiamento, effetti, classe/build e strategia AUTO/PERSONALIZZATA. Il risultato effettivo usa un nuovo seed e può differire. Le stime sono memorizzate in UI per preparazione, senza ricalcolarle ogni secondo.

Alla partenza viene salvato uno snapshot di statistiche reali, livello, oggetti/effects, profilo classe/build e regole della strategia. Prepararsi diversamente dopo la partenza non cambia retroattivamente la spedizione. Combattimento manuale resta disponibile e indipendente: assegna ora le proprie ricompense XP/Corone tramite Progression System, senza riscuotere quelle di spedizione. Un level-up ricalcola Equipment; il report del combattimento appena vinto viene conservato durante la sua assegnazione di ricompense, mentre il prossimo scontro usa le nuove statistiche.

Il piano degli incontri/eventi e i roll loot sono generati dal seed. Ogni incontro usa `CombatEngine.create` con il Guardiano scalato, mantenendo abilità, risorse, difese, critici, DoT, cooldown e Faretra delle Spine reali. HP residui vengono conservati, con un riposo di **40% HP massimi** prima del successivo incontro; risorsa e cooldown ripartono come in una nuova battaglia astratta. Ogni incontro viene risolto per massimo **180 secondi simulati**, a passi fissi del motore senza DOM/RAF/log dettagliato. Sconfitta o timeout interrompono la sequenza. Il costo del calcolo dipende dal numero finito di incontri, non dai minuti/giorni offline.

La durata dell'attività è il tempo di viaggio assegnato: non è la somma delle durate delle battaglie astratte. Gli incontri aggiuntivi possono aumentare il totale. Il report conserva esito, durata simulata, danni e HP di ogni incontro per verifica, oltre al riepilogo leggibile.

### Sei eventi automatici

| Evento | Modifica reale, premi concessi se l'incontro viene vinto |
| --- | --- |
| Mercante dei guadi | +7 Corone |
| Altare del Vespro | XP dell'incontro ×1,2 |
| Varco tra le spine | +2 Fibra Lunare, chance loot dell'incontro +20 punti |
| Imboscata dei cenerei | Un incontro extra con HP/danno/armatura ×1,2 |
| Archivio sepolto | +2 Polvere d'Etere, XP dell'incontro ×1,1 |
| Bestia ferita | +2 Ferro del Vespro, difficoltà di quell'incontro ×0,85 |

Nessuna scelta interattiva o acquisto. Il report mostra gli eventi effettivamente incontrati prima di una sconfitta, senza rivelare quelli della parte non raggiunta. Le definizioni eventi e attività sono conservate nella preparazione persistita; `rulesVersion: 1` serve a gestire future migrazioni del risolutore.

### Loot table personale fissa

| Famiglia | Custode (Plate) | Cacciatore (Mail) | iLv / requisito | Attività |
| --- | --- | --- | --- | --- |
| Gioiello | Anello della Frontiera (universale) | Stesso anello | 8 / 1 | Pattuglia, Sentiero |
| Stivali | Sabatons del guado lunare | Stivali del guado lunare (maglia) | 8 / 1 | Pattuglia, Sentiero |
| Arma del sentiero | Lama della frontiera | Arco del sentiero spezzato | 12 / 3 | Sentiero, Ricognizione |
| Arma della veglia | Lama della veglia | Arco della ricognizione | 14 / 5 | Ricognizione, Veglia |
| Corazza | Corazza della veglia (piastre) | Usbergo della veglia (maglia) | 14 / 5 | Ricognizione, Veglia |
| Supporto | Scudo del vespro stellato | Faretra del vespro stellato | 18 / 8 | Veglia |

Gli ID storici `moon-boots` (Mail) e `frontier-mail` (Plate, corazza a piastre) restano stabili per non perdere il possesso. `armorType` è l'autorità sul materiale, non il nome dell'ID. Gli asset SVG condivisi rimangono dichiaratamente provvisori; questa iterazione aggiorna regole e catalogo senza rifare il renderer.

Probabilità loot per incontro vinto: **12 / 14 / 16 / 18%**; roll aggiuntivo solo a spedizione completata: **30 / 35 / 40 / 45%**. Alla partenza ciascuna voce viene associata alla variante utilizzabile dalla preparazione salvata; i roll scelgono uniformemente le voci di questa tabella personale congelata. Gli eventi possono aumentare la chance del singolo incontro. Non sono generati oggetti proceduralmente.

Un oggetto nuovo entra in Inventario soltanto al claim; non viene mai auto-equipaggiato. «Oggetto trovato» mostra nome, rarità, item level, livello richiesto e consigli Gear Advisor quando appropriati. Prima del claim il confronto include il ritrovamento come candidato, indicato come consiglio dopo riscossione; dopo il claim usa il possesso reale. Il personal loot rispetta la preparazione salvata alla partenza. Dopo un cambio classe il ritrovamento può essere inutilizzabile dalla classe corrente, ma resta possedibile e non riceve consigli errati.

Ogni oggetto fisso può essere posseduto una volta. Se lo stesso ID ricompare, il duplicato viene convertito in **+2 Ferro del Vespro** al claim, anche per duplicati nello stesso report. Il report indica la conversione; non sposta o sostituisce l'esemplare equipaggiato. I 44 oggetti demo originali restano disponibili, con metadati di materiale coerenti; cinque nuovi pezzi Mail completano il kit del Cacciatore.

### Offline, salvataggio e claim

Chiave canonica: **`nymeria.progression.v1`**, schema `version: 1`:

```text
level / currentXP / requiredXP / totalXP / overflowXP
crowns / materials { iron, fiber, ether }
unlockedContent / ownedLootIds / sequence
activeExpedition { id, activityId, activity, eventDefinitions,
  startedAt, endsAt, seed, snapshot, lootPolicy, rulesVersion, testMode }
pendingExpeditionResult
lastClaim { report, loot, levelUps, resultingLevel, claimedAt }
```

`Date.now()` viene confrontato con `endsAt` al caricamento, ritorno in foreground e nel piccolo timer di presentazione. Una riapertura dopo 20 minuti risolve una spedizione scaduta in una sola operazione, mostra **Bentornato** e il report, con XP/risorse ancora da riscuotere. Non serve un timer vivo in background. Il countdown è una vista dei timestamp, non la fonte di avanzamento. Un orologio portato indietro non concede premi; il progresso visivo è limitato fra 0 e 100%.

**Riscuoti ricompense** legge sempre l'ultimo record, controlla l'ID del report e scrive XP, Corone, materiali, ID loot e ricevuta/consumo del report in **un unico `localStorage.setItem`**. Non esiste una fase in cui si assegna XP ma si lascia il report riscuotibile. La UI protegge dai tap ripetuti; refresh e chiamate ripetute trovano il report già consumato. Web Locks serializza partenza/completamento/claim fra tab dello stesso browser/origine quando disponibile. In browser senza Web Locks è garantita l'idempotenza nella singola pagina e dopo refresh; non è promessa una transazione simultanea fra più processi/tab senza quel supporto.

L'inventario equipaggiabile e il livello vengono riconciliati dal record canonico: se il secondo salvataggio `nymeria.equipment.v1` viene interrotto, al caricamento il loot e il livello vengono recuperati senza un nuovo claim. Chiavi classe/build, strategie ed equipaggiamento esistenti sono mantenute. I vecchi salvataggi M4 partono con progressione L1/0 XP senza perdere oggetti o preparazione. Record corrotti sono normalizzati; un futuro schema sconosciuto non viene sovrascritto dalla progressione.

Se il salvataggio non è disponibile o una scrittura fallisce, la partenza/ricompensa non viene applicata in memoria come se fosse persistita. Il report resta riscuotibile per un nuovo tentativo. Combattimento manuale e i tab restano utilizzabili. Il timer può essere chiuso: alla riapertura lo stato viene ricalcolato dal record.

**Fallimento:** premi parziali solo dagli incontri vinti, niente bonus finale; equipaggiamento intatto. Il loot già trovato in incontri vinti può essere riscosso. **Termina spedizione:** prima della scadenza cancella l'incarico, senza XP, Corone, materiali o loot; nessuna penalità all'equipaggiamento. Un incarico già scaduto va risolto e riscosso. Non si può partire con un incarico attivo o un report non riscosso. **Reset demo** non azzera XP, risorse o ritrovamenti; non è un prestige/reset di progressione.

### Test Mode e test

Modalità normale: URL senza parametri, nessun comando di sviluppo visibile. **`?test=1`** mostra un pannello tratteggiato **TEST MODE — SOLO SVILUPPO** e marca le nuove partenze/report come TEST. **Completa ora · TEST** risolve subito un incarico TEST con lo stesso seed, snapshot, incontri e premi. `startedAt`, `endsAt` e durate normali restano invariati; il comando non accelera incarichi normali iniziati prima. Le ricompense TEST modificano esplicitamente il salvataggio locale del prototipo; non esistono accelerazioni pagate o con valuta. Non viene aggiunto un comando normale che regali XP/livelli.

```sh
node tests/armor-loot-engine.cjs
node tests/armor-loot-browser.cjs
node tests/progression-engine.cjs
node tests/progression-browser.cjs
node tests/combat-engine.cjs
node tests/class-build-engine.cjs
node tests/combat-browser.cjs
node tests/class-build-browser.cjs
node tests/browser.cjs
node tests/navigation.cjs
```

I 19 controlli M5 usano Equipment e Class/Build reali: curva, confini, livelli multipli/cap/eccedenza, statistiche/HP/danno a parità di kit, requisiti, snapshot, offline, successo/fallimento/timeout/premi parziali, tutte le risorse, sei eventi, loot/duplicati/consigli, claim ripetuti, interruzione, recupero dopo scrittura Equipment interrotta, persistenza negata, migrazione M4 e orologio arretrato. Nessun secondo set di statistiche gameplay inventato nei test.

Chromium touch a **320/390/430 px** verifica barra XP, identità, sblocchi, tutte le attività, countdown, refresh, chiusura pagina/ritorno a +20 minuti, bentornato, claim/doppio click, loot/advisor/equip/duplicati, risorse, cancellazione, Combat indipendente, Test Mode, fallimento/cap, errori JS e overflow. Le fixture possono impostare XP alle soglie reali per testare gli sblocchi: questo non è un pulsante del gioco. Due tab reali verificano partenza/claim concorrenti con Web Locks. Un ulteriore test chiude completamente il processo Chromium, riapre lo stesso profilo persistente dopo +20 minuti, completa/riscuote e verifica i premi dopo un secondo riavvio. Le suite Equipment, Class/Build, Combat e navigazione rimangono regressioni obbligatorie; il selettore di errore Equipment è ora circoscritto al dialogo, dato che anche Spedizioni può mostrare un messaggio di storage.

### Limiti e TODO futuri

- Prototipo locale, con bilanciamento provvisorio, quattro attività e undici oggetti loot; nessuna garanzia di anti-cheat, clock fidato o sincronizzazione fra dispositivi senza backend. Cambiare origine/browser o cancellare i dati locali cambia il salvataggio.
- Una sola spedizione, nessuna ripetizione automatica o simulazione di missioni infinite mentre si è assenti. Ricompense applicate al claim, non alla sola scadenza.
- Stima su tre seed, non una probabilità esatta. Occorre migliorare la taratura delle ricompense/rischio ai vari livelli e per le sei tendenze; le attività appena sbloccate possono richiedere un kit migliore.
- TODO: bilanciamento curva/growth, migrazioni per nuovi `schemaVersion`/`rulesVersion`, ampliamento loot table e score di effetti/set, eventi con scelte, futura definizione delle attività simultanee. Nessuna di queste estensioni è implementata qui.
- Safari/iPhone fisico non è stato testato; emulazione Chromium mobile non lo sostituisce. Valutare i fallback di persistenza/concorrenza sul dispositivo reale.
- Non implementati energia/stamina, acquisti, pubblicità, accelerazioni con valuta, crafting, professioni, quest vere, mappa, dungeon, party/guild, multiplayer, backend, notifiche push, PvP, prestige o battle pass. Nessuna monetizzazione dei timer.


## Armor Proficiency & Smart Loot 0.1 — integrazione M5

`armor-rules.js` centralizza esclusivamente quattro materiali: `cloth`, `leather`, `mail`, `plate`. Tutti i pezzi di `head`, `torso`, `legs`, `gloves`, `boots` dichiarano `armorType`. I bracciali demo sono gioielli universali, non bracciali d'armatura; mantelli, cinture, collane, orecchini, anelli, armi e supporti non richiedono un materiale d'armatura.

Ogni classe dichiara una sola `armorProficiency` in `classes-data.js`: **Custode → Plate**, **Cacciatore → Mail**. La stessa regola supporta future classi Cloth/Leather senza gerarchie di competenza: Plate non autorizza a indossare Mail/Leather/Cloth. Equipment rifiuta il tentativo con un messaggio esplicito e mantiene l'oggetto in inventario. Il cambio classe prototipale rimuove soltanto le armature incompatibili dagli slot, mantenendo proprietà, gioielli e aspetto personale. Il Cacciatore nuovo parte con usbergo, gambali e stivali Mail; il Custode ha un kit demo Plate completo disponibile. Nessun equipaggiamento viene scelto automaticamente al cambio classe.

Gear Advisor usa la stessa compatibilità prima del punteggio: gli oggetti incompatibili non concorrono al migliore per slot e non ricevono **↑ Miglioramento** o **★ Migliore posseduto**. Inventario, dettagli e report mostrano invece **Non utilizzabile · Plate/Mail/Cloth/Leather** quando necessario. Le famiglie di armi/supporti continuano a essere considerate dal kit Combat e dal consiglio; il sandbox Equipment mantiene le combinazioni demo già esistenti.

### Personal loot e preparazione salvata

`personal-loot.js` applica la politica soltanto alle ricompense personali delle spedizioni. Alla partenza salva `lootPolicy {version: 1, kind: "personalLoot", classId, armorProficiency, weaponTypes, supportTypes, handedness, lootIds}` insieme allo snapshot. Il profilo include questi criteri; le build attuali condividono la famiglia arma/supporto della propria classe. Il risolutore usa esclusivamente la tabella personale congelata, mai la classe corrente al completamento o alla riscossione. Ogni armatura ottenuta rispetta la competenza salvata; armi e supporti rispettano le famiglie salvate e il livello di sblocco dell'attività. Gioielli universali rimangono nella tabella normalmente.

Il possesso non è filtrato dalla classe. Future sorgenti **worldLoot / sharedLoot / tradeLoot** potranno assegnare oggetti di altre classi senza questa politica. Non sono implementate in 0.1: nessuna regola globale in inventario cancella gli oggetti incompatibili, nemmeno quelli personali riscossi dopo un cambio classe.

### Migrazione conservativa

Le chiavi e gli schema principali restano `nymeria.equipment.v1` e `nymeria.progression.v1` (`version: 1`); è un'estensione additiva. Equipment rilegge i metadati canonici del catalogo, aggiunge i cinque oggetti demo Mail ai vecchi inventari e conserva tutti gli oggetti già posseduti. Le armature incompatibili salvate vengono rimesse in sacca e le statistiche ricalcolate; nessuna conversione degli oggetti già posseduti.

Per una vecchia spedizione attiva senza `lootPolicy`, la migrazione deriva la competenza e le famiglie da `snapshot.profile.classId` (o dal nome classe storico), mantenendo seed, timestamp, statistiche, strategia e incontri. Per un vecchio report **non riscosso**, associa soltanto gli ID loot alle varianti della classe salvata nel report; XP, Corone, materiali ed esiti non vengono risimulati. I report già riscossi, gli ID posseduti e le ricevute rimangono invariati: nessun nuovo claim o reroll. La politica normalizzata viene persistita nella successiva transazione; la riconciliazione Equipment salva gli slot aggiornati all'avvio.

### Identità futura della classe

**La scelta della classe/archetipo deve avere peso e non consentirà cambi arbitrari tra ruoli incompatibili.** Un personaggio nato come Tank non potrà trasformarsi liberamente in Healer. Evoluzioni e build future devono appartenere a una famiglia coerente dell'archetipo. Il blocco definitivo del cambio classe non è implementato: il prototipo mantiene Custode/Cacciatore liberamente selezionabili per i test.

### Salvage System — TODO, non implementato

- Smantella equipaggiamento indesiderato.
- Restituisce materiali.
- Possibile smantellamento multiplo.
- Futuro auto-salvage per rarità.
- Futuro auto-salvage degli oggetti non migliorativi.
- Protezione/favorite per impedire distruzione accidentale.

La conversione M5 di duplicati al claim resta il comportamento esistente; non è uno smantellamento degli oggetti nell'inventario.

### Test dell'integrazione

`tests/armor-loot-engine.cjs` verifica 23 casi usando Equipment, Class, Advisor, persistenza e Combat/Expedition reali: tutte le competenze/rifiuti, conservazione, migliore utilizzabile, gioielli, cambio classe, tutti i loot pool M5, snapshot e migrazione di inventari/spedizioni/report. `tests/character-fixture.cjs` condivide la preparazione reale con la suite M5.

`tests/armor-loot-browser.cjs` verifica tramite touch a **320/390/430 px** tutti gli slot indossabili, rifiuti e messaggi, assenza di badge errati, cambio classe durante spedizione, reload, claim/possesso/equip del personal loot, gioielli, dimensioni leggibili del personaggio, errori JS e overflow. Le suite Equipment, Combat, M4, M5 e navigazione restano obbligatorie; i test si preparano con kit coerenti, senza aggirare le competenze. Test mobile eseguiti in Chromium emulato; Safari/iPhone fisico non verificato in questa iterazione.


## M5 hotfix — XP & Rewards from Manual Combat

Una vittoria nel tab Combattimento assegna automaticamente **XP + Corone**, subito persistiti nella stessa chiave canonica `nymeria.progression.v1`. **Sconfitta = 0 XP e 0 Corone**; nessuna XP parziale per ora. Reset, interruzione o refresh di uno scontro non concluso non assegnano premi. Gli incontri headless delle spedizioni continuano ad assegnare soltanto i premi delle rispettive attività, senza doppi premi del combattimento manuale.

### Reward dei nemici e bilanciamento

`combat-data.js` centralizza livello, difficoltà e coefficienti reward dei nemici. Per il **Guardiano delle Rovine**: `level: 1`, `difficulty: 1`, `rewards: { xpPerLevel: 35, crownsPerLevel: 4 }`. La formula provvisoria è:

```text
XP = round(xpPerLevel × livello nemico × difficoltà nemico)
Corone = round(crownsPerLevel × livello nemico × difficoltà nemico)
```

Livello e difficoltà hanno minimo 1. Il Guardiano attuale assegna quindi **35 XP e 4 Corone per vittoria**, indipendentemente dal livello del personaggio. Servono tre vittorie per raggiungere L2 (105 XP totali, 25/204 XP nel nuovo livello), nove complessive per L3 e circa 1046 per L20 con questo solo nemico. Sono valori provvisori, centralizzati per il futuro bilanciamento. Nessuna stamina, diminishing returns, limite giornaliero o altro vincolo di farming è implementato. Loot/materiali manuali rimangono futuri e non vengono assegnati in questo hotfix.

### Percorso condiviso e persistenza

`progression-system.js` usa un'unica `applyRewards` per riscossione spedizioni e premio manuale: somma XP/Corone/materiali previsti e determina i level-up tramite `ProgressionData.fromTotal`. Livelli multipli, crescita statistica, sblocchi e cap L20 usano il percorso M5 esistente; nessuna seconda curva o duplicazione del calcolo. Al cap l'XP eccedente viene conservata, la barra mostra MAX e le Corone continuano ad aumentare.

`beginManualCombat(enemyId)` registra un identificativo progressivo di scontro e congela i reward del nemico alla partenza. `awardManualCombat(id, outcome)` consuma quell'identificativo insieme alla scrittura atomica di premi e ricevuta `lastCombatReward`: una seconda richiesta per lo stesso scontro non assegna nulla, nemmeno dopo refresh o dopo una vittoria successiva. Web Locks usa il lock di progressione già esistente. I vecchi salvataggi M5 migrano aggiungendo `manualCombatTickets: []` e `lastCombatReward: null`, senza cambiare XP, risorse o spedizioni. Gli identificativi non conclusi non provocano ricompense automatiche al caricamento; vengono conservati al massimo 64 ticket recenti per limitare metadati di scontri abbandonati, non il numero di combattimenti giocabili.

Il report mostra **VITTORIA**, **+35 XP · +4 Corone** e, se pertinente, **LIVELLO N RAGGIUNTO**. Entrambe le barre XP (Personaggio/Spedizioni) si aggiornano dalla notifica dello store canonico. Il level-up non nasconde il report appena vinto. Se una scrittura fallisce, XP e Corone non vengono applicate e il report offre **Riprova salvataggio ricompensa**. La ricevuta si salva immediatamente quando la transazione riesce; il combattimento in corso non viene ripristinato dopo refresh.

### Test hotfix

```sh
node tests/manual-rewards-engine.cjs
node tests/manual-rewards-browser.cjs
node tests/combat-engine.cjs
node tests/class-build-engine.cjs
node tests/combat-browser.cjs
node tests/class-build-browser.cjs
node tests/progression-engine.cjs
node tests/progression-browser.cjs
node tests/armor-loot-engine.cjs
node tests/navigation.cjs
```

I 16 controlli del nuovo motore di integrazione usano il Combat Engine reale: vittoria/sconfitta di Custode e Cacciatore, AUTO/PERSONALIZZATA, valori data-driven, level-up singolo/multiplo/cap, persistenza e idempotenza anche dopo sostituzione della ricevuta, scrittura fallita/retry, migrazione M5 e convivenza con spedizione attiva/report non riscosso. Il test browser touch a 320/390/430 px verifica gli stessi esiti, report preservato al level-up, entrambe le barre XP, refresh, chiamate duplicate, retry della persistenza, errori JavaScript e overflow. Le suite Combat/Class e Progression/Spedizioni rimangono regressioni obbligatorie.


## M5 hotfix — Character Creator Lock 0.1

Un nuovo salvataggio presenta il **Character Creator** con capelli, colore capelli e occhi. La bozza conserva esplicitamente `characterCreated: false`: refresh prima della conferma mantiene la bozza e il Creator disponibile. **Crea personaggio** salva tutti i dati estetici e `characterCreated: true` nella stessa scrittura `nymeria.equipment.v1`; soltanto se la scrittura riesce, sezione Creator e pulsanti Casuale/Crea scompaiono. Se il salvataggio fallisce, la bozza resta modificabile e può essere riconfermata.

Dopo la creazione, la schermata Personaggio mostra il personaggio e i dati senza controlli per cambiare capelli/occhi. Refresh, chiusura pagina o riavvio completo del browser mantengono il blocco. `setCharacter` e `randomizeCharacter` applicano la regola anche nel modello, non soltanto nella UI. Una bozza obsoleta in un'altra scheda non può riportare il flag a false o sovrascrivere l'identità creata: il modello riconcilia il marker e l'aspetto persistiti, e la UI ascolta gli eventi storage.

### Character Appearance / Equipment Appearance

Il modello separa:

```text
characterCreated: true | false
character: { hair, hairColor, eyes, level }
equipmentAppearance: { dye }
equipment[slot]: { equippedItem, appearanceItem }
```

`character` contiene l'aspetto personale e il livello derivato dalla progressione; `equipmentAppearance.dye` è il canale colore dell'armatura. `equippedItem` resta la fonte delle statistiche e `appearanceItem` quella della rappresentazione per slot, predisposta per **Equipment Appearance / Glamour / transmog** futuri. Il blocco del Creator riguarda **Character Appearance**: equipaggiamento, inventario, tintura armatura e normalizzazione degli appearanceItem continuano a funzionare. Nessun glamour completo o Barbiere viene implementato qui. La tintura resta isolata nel layer torso e non cambia pelle, capelli, occhi o statistiche.

### Migrazione dei personaggi del prototipo

Un salvataggio Equipment valido senza `characterCreated` appartiene al prototipo precedente e viene considerato **già creato**. Importa i valori estetici attuali, aggiunge `characterCreated: true` e trasferisce il vecchio `character.dye` in `equipmentAppearance.dye`, preservando il colore. Un salvataggio legacy `nymeria.character.v1` viene ugualmente importato come personaggio già creato. Le nuove bozze con false esplicito restano bozze; agli utenti esistenti non viene richiesta una nuova creazione.

La chiave Equipment e la versione 1 restano valide: migrazione additiva, senza cancellare livello/XP, classe/build, gear/inventario, Corone/materiali, progressione, ricevute Combat o spedizioni/report. La progressione mantiene la propria chiave canonica e il level-up non sblocca il Creator. Il salvataggio migrato viene persistito all'avvio come già avviene per Equipment.

### DEBUG / Test Mode

Soltanto **`?test=1`** mostra **DEBUG · Riapri Character Creator** e **DEBUG · Reset equipaggiamento demo**. Riaprire il Creator è un override temporaneo in memoria: il personaggio esistente conserva sempre `characterCreated: true` anche mentre si prova un diverso aspetto. Il pannello e la conferma indicano DEBUG. Ricaricare la pagina, anche in Test Mode, o tornare all'URL normale richiude l'editor; confermare salva l'aspetto DEBUG e richiude subito. `debugReopenCreator()` rifiuta la chiamata fuori da Test Mode. Il reset del kit non sblocca il personaggio e non tocca progressione/risorse/ritrovamenti. Nessun comando di riapertura/reset del Creator compare nell'esperienza normale.

### Barber System — TODO, non implementato

In futuro il giocatore potrà pagare **Corone** per modificare elementi estetici consentiti tramite un servizio dedicato:

- Capelli.
- Barba.
- Eventuali cosmetici minori.

Modifiche profonde potranno richiedere servizi differenti e più costosi. **Razza e caratteristiche fondamentali non devono essere liberamente modificabili.** Il Barbiere resta separato da Equipment Appearance/Glamour; non viene aggiunto alcun servizio, prezzo o consumo di Corone in questo hotfix.

### Test Character Creator Lock

```sh
node tests/creator-lock-engine.cjs
node tests/creator-lock-browser.cjs
```

Gli 11 controlli di integrazione verificano nuova bozza, conferma atomica, lock persistente e blocco delle API, separazione dye/appearanceItem, migrazione M5 e legacy, XP/class/build/gear/inventario/risorse/spedizioni/report e ricevute manuali conservati, fallimento scrittura, riapertura DEBUG temporanea, reset kit e protezione da scheda obsoleta.

Il browser touch a **320/390/430 px** verifica creazione e scomparsa dei controlli, refresh/chiusura pagina, migrazione completa, tintura/equipaggiamento, Class, XP manuale e spedizioni, Test Mode, errori JS e overflow. Un test chiude e riavvia completamente Chromium con lo stesso profilo persistente; altri verificano scrittura fallita con retry e due schede reali. Restano obbligatorie le regressioni Equipment, Combat/Class, Progression/Spedizioni e il precedente hotfix XP (35 XP / 4 Corone).

### Class-based Stat Growth

Valori provvisori da bilanciare. La crescita è ricostruita dal livello: base L1 + (livello − 1) × crescita della classe corrente + equipaggiamento; build e modificatori restano applicati dal profilo Combat. Nessun bonus viene accumulato o salvato permanentemente a ogni level-up. Il cambio classe ricalcola la crescita senza conservare quella precedente. HP = round(160 + Vigor × 9), poi moltiplicatore HP del profilo. Nessuna Fortuna introdotta. Curva XP, ricompense e meccaniche delle spedizioni invariate.

Le ricevute dei level-up conservano classe e aumenti totali effettivi (anche per livelli multipli); i report mostrano gli aumenti con Critico in punti percentuali. Ricevute precedenti senza questi dati restano leggibili; non vengono inventati aumenti retroattivi. Nessuna migrazione distruttiva: i salvataggi esistenti ricalcolano automaticamente le statistiche usando livello e classe salvati.

Test dedicati: `node tests/stat-growth-engine.cjs` (12 verifiche integrate, livelli 1/2/10/20 per entrambe le classi, HP, ricalcolo, persistenza, cambio classe, ricevute Combat/Spedizioni, livelli multipli e classi future) e `node tests/stat-growth-browser.cjs` (320/390/430 px, refresh, touch, nessun errore/overflow). Le regressioni dei premi manuali ora verificano anche il testo completo degli aumenti per entrambe le classi. Gli asset usano `?v=m5-stat-growth-0.1` per evitare script della versione precedente rimasti in cache.

## M6 — Frontiera del Vespro & Quest System 0.1

Base: `5243cf09423fd8b4a60a8c381027c5d80eff558b`. M5 conserva curva XP, crescita per classe, bilanciamento Combat, spedizioni e premi del Guardiano (35 XP / 4 Corone). M6 collega luoghi, NPC, missioni, incontri, ricompense e sblocchi senza dipendenze runtime nuove. Il tab **Mondo** contiene **Luoghi**, **Diario** e **Scoperte**; i nodi sono schede esplorabili, senza mappa complessa o movimento libero.

### Moduli e flusso

| Modulo | Responsabilità |
| --- | --- |
| `world-data.js` | Zona, sei luoghi, punti d'interesse, cinque NPC/dialoghi, nove template nemici, scoperte e titoli. Nomi e lore modificabili qui. |
| `quest-data.js` | Definizioni delle sei main quest e quattro secondarie: ID, tipo, testo, committente/luogo, prerequisiti, livello, obiettivi, premi, missione successiva e sblocchi. |
| `quest-events.js` | Dispatcher puro `dispatch(state, {type, target, quantity})`. Avanza soltanto obiettivi corrispondenti di missioni attive, limita il progresso al conteggio richiesto e rileva il completamento. |
| `quest-system.js` | Schema/versioning Frontiera, normalizzazione/migrazione additiva, macchina degli stati, accettazione, tracking, claim, DEBUG. |
| `world-system.js` | Visita, dialogo, esplorazione, incontri persistenti, simulazione deterministica con `CombatEngine`, eventi e premi tramite M5. |
| `quest-ui.js` | Diario Principale/Secondarie, offerte NPC, obiettivi, ricompense, stati e missione tracciata. |
| `world-ui.js` | Interazione touch, luoghi, dialoghi, scoperte, report e clock di presentazione degli incontri. |
| `progression-system.js` | API condivisa `grantRewards(state, reward)` e policy Personal Loot; bridge generico per kill manuali e spedizioni riscosse. |
| `progression-store.js` | Una transazione salva insieme progresso quest, XP, Corone, materiali, inventario canonico, stato incontro e claim. Web Locks sincronizza i tab nei browser supportati. |

Gli eventi non contengono ID di missioni. Combat/Expedition non conoscono MQ01–MQ06. Il tipo quest è un dato libero: future profession/guild/faction quest possono usare la stessa macchina degli stati. Un test inserisce una definizione futura e ne verifica il dispatcher senza cambiare i sistemi sorgente.

### Frontiera e progressione

| Luogo | Livello indicativo | Accesso / attività |
| --- | --- | --- |
| Avamposto di Veyra | 1 | Iniziale; Serah, Mira e Bram. Preparazione e ritorno dopo sconfitta. |
| Sentiero Spezzato | 1 | Iniziale; Oren, predoni e carro abbandonato. |
| Bosco delle Lanterne Spente | 2 | Claim MQ02; segugi, ragni, Cervo, lanterna e campioni di erbe. |
| Rovine di Elar | 3 | Claim MQ03; Ilyen, sentinelle, frammenti, finestra e Tavoletta. |
| Guado del Vespro | 4 | Claim MQ04; razziatori, comandante e riva opposta (accessibile dopo il comandante). |
| Torre Silente | 7–8 | Claim MQ05; Ombre e Custode del Silenzio. |

Gli sblocchi sono ID `world:<locationId>` dentro `unlockedContent`, affiancati agli sblocchi M5 derivati dal livello. Le transazioni preservano questi ID; la normalizzazione ricostruisce anche gli sblocchi delle quest riscosse. I luoghi hanno progressione narrativa, gli incontri non hanno un blocco rigido di livello. Le missioni hanno livelli minimi 1/1/2/3/4/5. La valutazione **Facile / Adeguato / Difficile / Pericoloso** usa tre simulazioni seed fissi, kit/build/statistiche correnti e salute finale, con le stesse soglie concettuali delle spedizioni. I nemici non sono scalati automaticamente al personaggio.

### Catena principale

| Quest | Obiettivi | Premi | Sblocco |
| --- | --- | --- | --- |
| MQ01 — Oltre il confine | Parla con Serah, visita il Sentiero | 40 XP, 6 Corone | MQ02 |
| MQ02 — Nessuno è tornato | 3 predoni, 3 Distintivi della Pattuglia | 100 XP, 12 Corone, 2 Ferro | Bosco / MQ03 |
| MQ03 — Luci senza fiamma | 2 segugi, 3 campioni, lanterna, Cervo del Crepuscolo | 240 XP, 20 Corone, 3 Fibra | Rovine / MQ04 |
| MQ04 — Pietre che ricordano | Visita Elar, 3 frammenti, 3 sentinelle | 420 XP, 28 Corone, 3 Etere, arma personale Epica | Guado / MQ05 |
| MQ05 — Il Guado | 3 razziatori, comandante, riva opposta | 700 XP, 40 Corone, 4 Ferro, corazza personale Epica | Torre / MQ06 |
| MQ06 — La Torre Silente | Visita Torre, sconfiggi Custode del Silenzio | 1100 XP, 80 Corone, 8 Etere, corazza personale superiore Epica, titolo | Conquistatore della Frontiera |

La causa rimane misteriosa: gli animali sembrano seguire una memoria proveniente da Elar. L'epilogo dopo il boss e nel riconoscimento suggerisce una risposta oltre la Frontiera; non spiega la causa. Prima del boss possono servire livelli, quest secondarie, spedizioni o incontri ripetuti e un kit migliore. Le ricompense MQ04/MQ05 sono realmente equipaggiabili e rendono concreta la preparazione. Il test engine percorre la storia e si prepara fino a L7 combattendo Ombre reali, senza assegnare XP artificialmente; i test browser impostano L8 soltanto come fixture per velocizzare la verifica UI.

### Secondarie e NPC

- **Erbe nella nebbia** (Mira): 3 campioni di erbe al punto esplorativo nel Bosco, dialogo; 100 XP, 10 Corone, 3 Fibra. Introduzione narrativa alle professioni, senza professione/raccolta professionale implementata.
- **Un debito non pagato** (Bram): 2 predoni; 65 XP, 25 Corone.
- **Il mercante smarrito** (Oren): carro, predone, una Pattuglia delle Rovine completata con successo e riscossa; 140 XP, 20 Corone, 2 Ferro, Anello della Frontiera universale. Richiama il mercante dei guadi degli eventi M5; non richiede un evento casuale specifico.
- **Una luce alla finestra** (Ilyen): finestra e dialogo, senza combattimento obbligatorio; 180 XP, 15 Corone, 2 Etere.

NPC: **Capitana Serah Venn** (comandante, Veyra), **Oren Vale** (esploratore, Sentiero), **Mira Thalen** (guaritrice/studiosa, Veyra), **Bram** (mercante, Veyra), **Ilyen** (conoscenze antiche, Elar). Brevi dialoghi cambiano dopo claim definiti nei dati. Nessun albero di dialogo.

### Bestiario e incontri

| Nemico | Liv. | HP | Danno base | Armatura | Velocità | XP / Corone |
| --- | --- | --- | --- | --- | --- | --- |
| Predone del Vespro | 1 | 240 | 16 | 8 | 0,9 | 16 / 2 |
| Segugio Corrotto | 2 | 330 | 22 | 5 | 1,25 | 24 / 3 |
| Ragno delle Lanterne | 2 | 290 | 20 | 15 | 1,4 | 22 / 3 |
| Sentinella di Elar | 3 | 550 | 28 | 42 | 0,8 | 36 / 4 |
| Razziatore del Guado | 4 | 630 | 32 | 24 | 1,05 | 44 / 5 |
| Ombra Silente | 6 | 850 | 43 | 12 | 1,45 | 65 / 7 |
| Cervo del Crepuscolo · miniboss | 3 | 780 | 30 | 20 | 1,15 | 70 / 8 |
| Comandante del Guado · miniboss | 5 | 1120 | 40 | 38 | 0,95 | 110 / 12 |
| Custode del Silenzio · boss | 8 | 1800 | 50 | 45 | 1,05 | 180 / 20 |

Attacco ogni `2.8 / speed` secondi, speciale ×1,55 ogni 9 s (primo dopo 5 s). Il Combat Engine esistente riceve `enemyTemplate`: stessi cooldown, risorse, build, effetti oggetti, critici e fixed step. AUTO/PERSONALIZZATA e velocità vengono dalla preparazione Combat esistente; le regole sono congelate nell'incontro. Il mondo ha un adapter UI compatto per HP/log/pausa, senza secondo motore. Il tab Combattimento M5 resta disponibile con il Guardiano originale.

All'avvio vengono salvati ID univoco, seed, luogo, template e snapshot del personaggio. Al risultato, il motore ricostruisce deterministicamente l'incontro prima della transazione di premio/progresso. Un refresh non paga né annulla: offre **Riprendi incontro**, rigiocando la stessa preparazione/seed dall'inizio. Massimo 180 secondi simulati; un timeout è una sconfitta. L'app si mette in pausa quando la pagina viene nascosta. Vittoria: XP/Corone del template, kill, eventuale defeatBoss e drop di missione. Sconfitta/ritirata: ritorno a Veyra, nessuna perdita di equipaggiamento/livello, nessuna penalità permanente, 0 XP/Corone. Nessuna durability.

### Quest, eventi e ricompense

Stati: `locked → available → active → completed → claimed`. Disponibilità da prerequisiti riscossi e livello minimo. Si accetta nel luogo del committente; il luogo corrente produce un evento visit all'accettazione (utile per Elar). Una sola quest tracciata, salvata e visibile compatta anche durante l'esplorazione. Dopo il claim non si può riaccettare/reset in normale esperienza.

Obiettivi supportati: `kill`, `collect`, `visit`, `talk`, `completeExpedition`, `defeatBoss`. L'accettazione non retrodata uccisioni/raccolte/dialoghi. Un evento può avanzare più missioni attive. I distintivi/campioni/frammenti vengono dai nemici indicati; il punto Erbe consente di trovare campioni ripetutamente, senza sistema professionale. Gli oggetti di missione sono conteggi in `frontier.supplies`, separati dall'inventario Equipment. Solo una spedizione riuscita e riscossa emette `completeExpedition`; report non riscossi, fallimenti, doppio claim non avanzano l'obiettivo.

`grantRewards` riusa il percorso XP M5, compresi level-up multipli, crescita specifica della classe e cap. Le missioni possono pagare XP, Corone, materiali, `items`, `personalLoot`, content unlock e riconoscimenti. Claim quest e risultato incontro sono idempotenti: stato missione/ticket e premi vengono salvati nello stesso record; un errore di scrittura non applica nulla e permette retry. Duplicati di un ID di loot si convertono in 2 Ferro come in M5.

**Personal Loot**: policy della classe salvata all'accettazione della missione, conservata dopo refresh/cambio classe. MQ04 paga Spada/Arco, MQ05 Plate/Mail, MQ06 `silence-plate` / `silence-mail`, sempre secondo la preparazione salvata. Un cambio classe successivo può rendere il premio inutilizzabile dalla classe corrente: resta posseduto, Armor Proficiency/Advisor lo trattano normalmente. `items` universali come l'anello non richiedono policy. Questo filtro riguarda ricompense personali; non introduce vincoli globali per futuro world/shared/trade loot.

Le due corazze del Silenzio sono Epiche iLv20, requisito L5: Plate Forza8/Vigor15/Armatura26, Mail Agilità15/Vigor8/Critico4/Armatura18. Sono inventario canonico M5, visibili nel Gear Advisor, senza auto-equip. Asset SVG modulari condivisi e provvisori; M6 non aggiunge un catalogo di illustrazioni definitive. Il campo legacy `expeditionOnly` significa escluso dalla proprietà iniziale/demo: viene riutilizzato anche per loot di quest, senza attribuire la provenienza alla sola spedizione.

### Scoperte, sblocchi e migrazione

`frontier` è un'estensione additiva del record `nymeria.progression.v1`, con `version`, `zoneVersion`, `questVersion`, `discoveryVersion`, `achievementVersion` a 1. Contiene luogo, stati/progressi quest, policy personali, tracking, conteggi oggetti quest, nemici sconfitti, scoperte, riconoscimenti, incontro attivo e ultimi report. Versioni future non supportate bloccano la scrittura, senza sovrascrivere il record. Vecchi M5 senza `frontier` ricevono Veyra/Sentiero e MQ01 disponibile; tutti i campi M5 vengono conservati. Nessun reset di Equipment/Class/Creator/Combat/Spedizioni.

La scoperta `tablet_of_elar` si registra esaminando la Tavoletta a Elar. **Non decifrata · Richiede Archeologia 10**. Nessuna Archeologia, abilità professionale o meccanica di decifrazione. La scoperta non è un obiettivo bloccante della main quest. Il formato dati permette segreti, lore, ricette e profession discoveries future. `frontier-conqueror` è un title data entry persistente mostrato in Riconoscimenti dopo il claim finale.

### Test Mode e verifica M6

Solo **`?test=1`** espone il pannello DEBUG e abilita le API di sviluppo: completamento/reset degli obiettivi di quest accettate, sblocco di un luogo, +500 XP, avvio boss. Queste operazioni modificano esplicitamente lo stesso salvataggio locale; non esistono nella UI normale. Il reset di missioni già riscosse è vietato anche in Test Mode, per preservare il pagamento unico. Per iniziare una nuova partita di test usare un profilo browser separato. Gli strumenti DEBUG esistenti di M5 restano disponibili.

```sh
node tests/world-engine.cjs
NYMERIA_TEST_URL=http://127.0.0.1:8002 node tests/world-browser.cjs
NYMERIA_TEST_URL=http://127.0.0.1:8002 node tests/world-side-browser.cjs
```

Il server deve servire la radice repository (es. `python3 -m http.server 8002`). `tests/world-fixture.cjs` integra i veri moduli Equipment/Class/Combat/Progression/Expedition. Le 18 verifiche engine integrate verificano dati/bestiario, migrazione M5 con spedizione attiva, tutti gli obiettivi, entrambe le catene principali con combattimenti veri, quattro secondarie per classe, bridge spedizioni, policy loot, Armor Proficiency/Advisor, tracking, scoperta/titolo, dialoghi, persistenza, sconfitta, concorrenza, doppio claim, scrittura fallita/retry e protezione versioni future.

I test Chromium touch attraversano MQ01–MQ06 per Custode/Cacciatore a 320/390/430 px, inclusi pausa/refresh/ripresa dello stesso incontro, claim, ricompense/Advisor, barre XP Personaggio/Spedizioni, Diario, Scoperte, titolo, riapertura pagina e assenza di errori JS/overflow. La suite secondarie verifica tutte e quattro via touch a 320/390/430 px, inclusa la riscossione reale di una spedizione M5. Un'altra verifica carica da zero il record M5 e usa due tab reali/Web Locks per un solo pagamento, oltre a errore di scrittura/retry e tutti gli strumenti DEBUG. Screenshot solo in `/tmp`, nessun output generato nel repository. Le suite M2/M3/M4/M5 rimangono regressioni obbligatorie. Navigazione verifica anche il settimo tab e guasti isolati dei nuovi moduli; 30 asset relativi con versione condivisa `m6-frontier-0.1`, adatti a GitHub Pages `/nymeria/`.

### Limiti della slice

Bilanciamento e testi provvisori; le due classi hanno preparazione e difficoltà diverse. Nessuna vera mappa, movimento libero, professione, crafting, party, multiplayer, gilda, fazione, trading, backend, stamina, monetizzazione o cinematica. Gli incontri usano HP/log e template differenti, senza nuovi asset definitivi dei nemici. La ricostruzione al refresh riparte dall'inizio dello stesso scontro; non salva ogni tick. Gli eventi registrano progressi dopo l'accettazione, senza ricostruire azioni storiche. Nei browser senza Web Locks rimane il limite M5 di concorrenza fra tab: usare un tab di gioco per i claim. Tutti i dati risiedono in localStorage; nessun account/cloud save.

## M6.1 — Global Notification System & Level-Up Feedback

Il feedback globale è separato dal salvataggio di gioco. **`progression-store.js`** confronta lo stato prima/dopo ogni transazione riuscita, dopo la scrittura duratura e la ricostruzione del livello. **`progression-events.js`** produce eventi semantici; **`notification-system.js`** gestisce la coda in memoria; **`notification-ui.js`** decide testi, priorità visiva, durata e accessibilità. Nessun trigger level-up in Combat/Expedition/Quest, nessun nuovo percorso XP, nessuna dipendenza circolare.

### API e categorie

- `ProgressionStore.subscribeEvents(listener)` riceve `{ type, payload }` solo dalle transazioni confermate. Restituisce una funzione di unsubscribe.
- `Notifications.notify(type, payload, { key? })` accoda feedback; una chiave opzionale deduplica eventi UI nella sessione.
- `Notifications.dismiss(id?)` rimuove soltanto la notifica corrente, con controllo ID contro timer/dismiss obsoleti.
- `NotificationSystem.create()` è testabile senza DOM/storage.

Categorie data-driven della presentazione: `levelUp`, `areaUnlocked`, `questAvailable`, `importantItem`, `discovery`, `achievement`, `featureUnlocked`. M6.1 emette automaticamente le prime quattro necessarie alla slice: level-up, nuove aree, scoperte e riconoscimenti. Le altre categorie sono disponibili tramite API per i futuri sistemi, senza notificare oggi ogni offerta quest/drop e senza spam di piccoli eventi. Una transazione con più aumenti emette un solo level-up aggregato.

### Level-up globale

Il livello deriva sempre dall'XP totale M5. Un passaggio L2→L3 mostra **LIVELLO AUMENTATO! · Livello 3**. Un salto L3→L5 mostra **LIVELLI AUMENTATI! · Livello 3 → 5** con aumenti complessivi delle due crescite. `statGrowthPerLevel` della classe corrente è l'unica fonte: `ProgressionData.statGains` moltiplica la crescita per i livelli realmente guadagnati. La UI formatta soltanto gli incrementi e il Critico in punti percentuali, senza duplicare valori di crescita.

Custode: +2 Forza, +3 Vigor, +1 Spirito per livello. Cacciatore: +3 Agilità, +1 Vigor, +0,5% Critico. Al raggiungimento L20 vengono mostrati solo i livelli effettivi fino al cap, più **Livello massimo raggiunto**. XP aggiuntiva al cap continua a persistere secondo M5 ma non produce un finto L21 o un altro level-up. Qualsiasi fonte futura che modifica XP tramite la transazione centrale riceve lo stesso feedback, anche senza una ricevuta Combat/Quest/Expedition specifica.

### Presentazione e queue

Un solo banner alla volta, sopra ogni tab. Il level-up ha riquadro più grande, bordo/simbolo evidente e testo esplicito; resta per 9 secondi o fino al dismiss tramite pulsante touch da 44px. Le notifiche normali durano 5–6,5 secondi. Un level-up precede i banner in attesa, senza cancellare quello già mostrato. Nessun blocco del gameplay o focus rubato. I timer si fermano con pagina nascosta, focus nel banner o hover mouse, così il feedback non scade mentre non è leggibile. Il touch non usa hover persistente che bloccherebbe la queue. Il banner resta utilizzabile anche con un dialogo Equipment aperto: viene collocato nel dialogo attivo e torna nel body alla chiusura.

`role=status`, `aria-live=polite`, `aria-atomic=true`, etichette testuali e dismiss accessibile. Informazioni mai affidate al solo colore. `prefers-reduced-motion` elimina l'animazione d'ingresso. Layout verificato a 320/390/430 px, con safe area mobile e testo degli incrementi leggibile.

### Integrità e duplicati

XP/Corone, quest, scoperte, achievement e sblocchi sono confermati prima di emettere feedback. Il modulo produttore è opzionale all’avvio: se non viene caricato, Progression continua a funzionare. Errori nel produttore o nei listener di notifiche non annullano un premio già salvato né consentono un secondo claim. Transazioni fallite, operazioni unchanged e doppi claim non emettono notifiche. La queue non legge/scrive localStorage e il dismiss non modifica gioco, inventario o premi.

Nessun replay al caricamento, refresh, migrazione M5/M6 o evento `storage`: vengono notificati solo i cambiamenti della transazione effettivamente confermata da quel tab. Un altro tab sincronizza i dati come prima, senza duplicare il feedback. Dopo refresh/chiusura possono andare persi banner ancora in attesa: è feedback temporaneo, non stato di gioco. Nessuna migrazione nuova o flag di notifica persistente necessario. Gli eventi di aree/scoperte/titoli derivano da nuovi ID rispetto allo stato precedente e non vengono ripetuti per una visita o claim già registrati.

### Test M6.1

```sh
node tests/notifications-engine.cjs
NYMERIA_TEST_URL=http://127.0.0.1:8002 node tests/notifications-browser.cjs
```

15 verifiche engine/integrate: entrambe le classi da Combat/Spedizioni/Quest, crescita e fonte futura, salto multiplo, cap, aree/Tavoletta/titolo (anche tramite claim M6 reali), refresh/migrazione/rilettura tra istanze, fallimento/retry/duplicati, listener UI fallito, queue/priorità/dismiss/keyed dedup e categorie future. La suite browser esercita gli stessi feedback su tab differenti a tutte e tre le larghezze, testi/growth, multi-level/cap, queue, timeout/dismiss, area/scoperta/titolo, refresh/persistenza, dialogo aperto, touch e reduced motion, senza errori JS/overflow. La suite verifica anche il caricamento con lo script feedback non disponibile: premi e persistenza restano funzionanti. Le regressioni M2–M6 chiudono i banner tramite tocchi reali quando usano un clock congelato (`tests/notifications-fixture.cjs`), senza disattivare il sistema o rimuovere le verifiche. Gli asset condividono la versione `m6-feedback-0.1` (33 riferimenti relativi) per GitHub Pages `/nymeria/`.

## M6.2 — Mobile UX Architecture Rework

La Home è **Mondo**, nel luogo persistente del personaggio. L'interfaccia non è più una griglia di sette moduli: la bottom navigation offre **Personaggio / Mondo / Attività / Menu**, con quattro target da almeno 44 px, stato attivo con sottolineatura e testo marcato, frecce/Home/End da tastiera, padding `env(safe-area-inset-bottom)` e spazio riservato nei contenuti. Il top bar è compatto. Palette e asset modulari rimangono quelli del prototipo; nessun art pass M6.5 o cambiamento al bilanciamento.

### Luoghi e missioni nel contesto

- Il Mondo presenta nome/atmosfera del luogo, missione tracciata, obiettivi ancora incompleti e contatori, NPC, esplorazioni, incontri e destinazioni adiacenti. Gli obiettivi indicano il luogo pertinente, oppure Attività per una spedizione. Le azioni pertinenti hanno un segnale visivo e una descrizione accessibile. Gli incontri richiesti dalla missione vengono presentati prima delle esplorazioni opzionali, per rendere più raggiungibile la CTA corrente.
- `WorldData.connections` è il grafo data-driven di presentazione dei sei nodi. Le destinazioni bloccate mostrano il requisito esistente. Il viaggio continua a utilizzare `WorldSystem.enter`, persistenza e dispatcher `visit` originali: nessuna regola di progressione nuova. La panoramica **Mappa dei luoghi** è un accesso secondario ai luoghi sbloccati.
- Il **Diario** è secondario: lista Principale/Secondarie → dettaglio missione → Back al Diario → Back al luogo. Il dettaglio mantiene progressi, tracking, stati, anteprima e riscossione delle ricompense. Il tracking può aprire direttamente il dettaglio, senza imporre il passaggio dal Diario.
- **Menu → Scoperte** conserva Tavoletta di Elar, requisito Archeologia e titoli. Non sono state aggiunte destinazioni fittizie al Menu.

### Hub e flussi contestuali

**Personaggio** contiene identità, livello, classe/build, XP, manichino SVG e statistiche essenziali. Da qui si aprono Equipaggiamento, Inventario e Classe/Build. Il Creator resta disponibile soltanto prima della creazione; lock e migrazioni precedenti non cambiano. Le vecchie scorciatoie sul manichino aprono slot reali. Character Appearance rimane separata dall'aspetto dell'equipaggiamento: la tintura è in Equipaggiamento.

**Equipaggiamento → slot → Inventario filtrato → dettaglio → Equipaggia**. Il filtro contestuale include il tipo di slot, Armor Proficiency e famiglia arma/supporto della classe; gli oggetti di altra classe restano nell'inventario completo. Un equip riuscito chiude il dettaglio e torna alla schermata Equipaggiamento. Confronti, Gear Advisor, slot duplici, unequip e tutti i 16 slot restano gestiti dai moduli originali. Oggetti compatibili ma con requisito di livello troppo alto possono essere consultati; il controllo di equipaggiamento continua a impedirne l'uso.

**Incontro dal luogo → Combat UI → risultato → Continua → luogo d'origine**. La UI dell'incontro è una schermata secondaria, utilizza lo stesso Combat Engine e lo stesso ticket/reward ledger. Strategia AUTO/PERSONALIZZATA è configurabile in Personaggio → Classe/Build; le regole vengono fissate alla partenza come prima. Pausa, ripresa dopo refresh e abbandono restano disponibili. Un incontro ancora attivo ha un comando Riprendi dal luogo. Il risultato già concluso non viene ripagato o riaperto al refresh. In caso di sconfitta il sistema continua a registrare il ritorno a Veyra, senza premi: premendo Continua la UI permette di ritornare al luogo iniziale tramite il normale viaggio; abbandonare continua a riportare a Veyra.

**Attività** presenta direttamente Spedizioni: preparazione, stato/tempo della spedizione attiva, report/claim, elenco e risorse. Offline progress, durate, XP e Personal Loot restano invariati. Il badge **Riscatta** deriva da `pendingExpeditionResult`; il badge Mondo conta soltanto missioni completate e non riscosse. Non ci sono badge simulati.

In `?test=1`, **Menu → DEBUG** raccoglie i controlli M6, completamento anticipato delle spedizioni, reset demo e riapertura Creator. L'incontro dimostrativo del Guardiano è raggiungibile solo da questa schermata. Le funzioni interne restano testabili dagli engine test, ma la navigazione normale non offre una destinazione Combat/debug. Riavviare un editor DEBUG non cambia il flag di creazione permanente.

### Navigation/context stack e salvataggi

`navigation.js` è un bootstrap piccolo e indipendente dagli altri moduli. `NymeriaNavigation.root(destination)` cambia destinazione principale e azzera il percorso secondario; `open(screen, options)` salva contesto/scroll/focus; `back()` chiude prima un dialogo aperto o ripristina la schermata precedente. Escape equivale a Back nelle schermate secondarie; le normali semantiche Escape dei dialoghi rimangono attive. Non è un router SPA e non modifica la history del browser: il controllo Indietro interno è il riferimento per il percorso UI.

La route contiene `screen`, destinazione `root`, eventuale vista Mondo, ID missione o filtro slot. Lo stack è **solo in memoria**. `frontier.location` è il currentLocation di gioco già persistente: non è duplicato nello stack né rinominato. Refresh ricostruisce Mondo nel luogo salvato, oppure l'incontro attivo riprendibile. Non persiste una schermata di inventario/Diario/modalità aperta. **Nessuna nuova versione/schema o migrazione è necessaria**: i salvataggi M6 vengono letti senza perdita; le migrazioni additive M2–M6 restano in funzione.

M6.1 non cambia: il ledger centrale emette gli eventi, il sistema globale presenta level-up/aree/scoperte/titoli su ogni route. La coda non dipende dalla bottom navigation; il banner ha z-index superiore, supporta i dialoghi e rispetta reduced motion. Nessuna ricompensa deriva da una notifica.

I 34 riferimenti CSS/JS sono relativi e condividono `?v=m6-mobile-0.2`, per GitHub Pages `/nymeria/` e per evitare cache miste.

### Rapporto UX: numero indicativo di tocchi

Confronto con M6 al commit `8da975a`, partendo dal luogo corrente e con un oggetto posseduto/non ancora equipaggiato. Lo scroll viene indicato separatamente: non è contato come tap. Sono esclusi creazione, prima preparazione del kit e dismiss di feedback globali.

| Flusso | M6 | M6.2 | Effetto |
| --- | --- | --- | --- |
| Mondo → parla con NPC nel luogo della quest | 1, spesso dopo scroll oltre intro/lista luoghi | 1 | NPC nel contesto; per un altro luogo il tragitto dipende dal grafo, con mappa secondaria disponibile |
| Luogo corrente → avvia incontro | 1, spesso dopo scroll | 1 | CTA contestuale senza destinazione Combat globale |
| Risultato → luogo | 0 tap, scroll verso il dettaglio precedente | 1 Continua | Ritorno esplicito, senza attraversare report/arena nella schermata del luogo |
| Controlla quest tracciata | 0, eventuale scroll | 0 | Obiettivo e destinazione immediatamente nel luogo |
| Diario → luogo precedente | 2 | 2 | Nessun salto di luogo, con dettaglio e Back coerenti |
| Personaggio → equipaggia → schermata Equipaggiamento | 5 via Inventario, dettaglio, equip, chiudi, tab Equipaggiamento; 6 se si parte dal dettaglio di uno slot occupato | 4: hub, slot, oggetto, equip | Filtro compatibile diretto e ritorno automatico |
| Mondo → controlla spedizione / riscuoti | 1 / 2 | 1 / 2 | Attività è raggiungibile col pollice, badge reale per il claim |

Il beneficio principale non è abbassare artificialmente ogni contatore: è ridurre scroll, controlli duplicati e perdita del contesto. Viaggiare fra luoghi è una scelta di gioco; la mappa resta disponibile per raggiungere direttamente un nodo già sbloccato.

### Verifica M6.2

`tests/mobile-ux-browser.cjs` esercita tocchi reali a 320/390/430 px per Custode e Cacciatore: Home, quattro destinazioni, Creator/lock, Classe/Build e strategia, 16 slot, filtro per proficiency/famiglia, equip/ritorno, inventario completo, NPC/talk, missione e azioni pertinenti, spostamento e blocchi, Diario/dettaglio/Back/focus, incontro/ripresa/risultato/Continua, spedizione normale/offline/claim/badge, level-up su tutte le destinazioni, persistenza, Scoperte/titolo, reduced motion e overflow. Una prova separata verifica Menu/DEBUG solo in Test Mode. Gli otto screenshot a 390 px vengono scritti esclusivamente in `/tmp`.

I test browser precedenti usano `tests/mobile-navigation-fixture.cjs` per raggiungere le stesse funzionalità tramite i nuovi percorsi UI: nessun tab globale nascosto per soddisfare i test. Il helper notifiche esegue dismiss reali, tenendo conto di un banner che può scadere fra controllo e tap. La suite navigation verifica anche che eccezioni, parse error o mancato caricamento di un modulo non impediscano i listener delle destinazioni.

Esecuzione locale (Playwright/Chromium sono strumenti di sviluppo, non dipendenze dell'app):

```sh
python -m http.server 8004
NYMERIA_TEST_URL=http://127.0.0.1:8004 node tests/mobile-ux-browser.cjs
NYMERIA_TEST_URL=http://127.0.0.1:8004 node tests/navigation.cjs
```

I controlli sulle safe area sono strutturali e su viewport touch emulati Chromium. Una prova su iPhone/Safari fisico resta utile per valutare ergonomia, tastiera virtuale e barre dinamiche: non viene dichiarata come eseguita nell'ambiente cloud. Gli asset definitivi, animazioni di combattimento illustrate e art pass restano M6.5.

Risultati della verifica cloud M6.2: **141 controlli engine e 13 suite browser completati con esito positivo**. Inclusi la storia principale completa per entrambe le classi su tutte e tre le larghezze, quattro side quest, Web Locks con due tab reali, storage negato/errore/retry e riavvio completo del browser. Un salvataggio generato dai moduli del commit M6 originale è stato caricato in M6.2 e confrontato integralmente, includendo titolo/scoperta e spedizione/incontro attivi. Verificato anche un caricamento reale dal sottopercorso `/nymeria/`: 34 asset HTTP 200 e navigazione senza errori JS. La normalizzazione può ripristinare l’ordine di catalogo degli oggetti dopo un drop: la verifica di persistenza confronta tutti gli oggetti e i loro dati per ID, non l’ordine incidentale dell’array.

### M6.5 — Visual Identity & Modular Character Vertical Slice

Il personaggio usa ora **asset SVG indipendenti** sul rig adulto condiviso 360×640, con manifest e compositore comune a Personaggio, Equipaggiamento e Combat. Plate A/B hanno geometrie diverse, spade/scudi distinti; Mail A, arco e faretra provano lo stesso sistema sul Cacciatore. Creator: 3 carnagioni, 3 acconciature, 3 palette capelli/occhi e 2 dettagli volto, con lock e migrazione additiva conservati. I 16 slot reali restano accessibili attorno al personaggio.

La Frontiera ha una mappa verticale originale a sei nodi con stato reale e obiettivi tracciati. Quattro nemici vettoriali, icone originali, micro-animazioni e feedback essenziale migliorano la presentazione senza cambiare motore, formule o ricompense. La grafica originale è un vertical slice vettoriale, non artwork finale; i nuovi asset Custode M6.5.1 sono esplicitamente proxy (vedi sotto); accessori e oggetti fuori dal slice usano fallback esplicitamente dichiarati.

Documentazione completa: [pipeline grafica M6.5](docs/visual-pipeline.md), inclusi rig/anchor, layer order, mapping, hide rules, salvataggi, export, budget, diagnostica DEBUG e aggiunta di item/hairstyle/classi.

Test nuovi: `node tests/visual-manifest.cjs` e `NYMERIA_TEST_URL=http://127.0.0.1:8004 node tests/visual-browser.cjs`. Proof a 390 px salvate fuori dal checkout in `/workspace/nymeria-preview/m65`. Nessun build, framework o asset remoto necessario; riferimenti relativi e cache versionata `m65-1` compatibili con GitHub Pages `/nymeria/`.

**Visual Showcase M6.5 (solo DEBUG):** aprire il sito con `?test=1`, poi **Menu → DEBUG · Test Mode → Visual Showcase M6.5**. Preset Custode Plate A/B e Cacciatore Mail A, spade/scudi, arco/faretra, tutte le opzioni estetiche e i quattro nemici si selezionano con un tap. Il personaggio usa `VisualRenderer` e `VisualManifest` reali; i nemici usano gli stessi SVG del Combat. L'anteprima ha stato soltanto in memoria: non equipaggia oggetti reali, non modifica salvataggi e non sblocca il Creator. Se si sceglie un dettaglio estetico, l'elmo dell'anteprima viene rimosso per renderlo visibile. Nessun elemento o asset dello showcase viene inizializzato nell'esperienza normale.

Verifica mirata dello showcase: `NYMERIA_TEST_URL=http://127.0.0.1:8008 node tests/visual-showcase-browser.cjs` (server statico locale già avviato). Copre tutti i selettori, isolamento e persistenza dei dati di gioco, touch, reduced motion, assenza fuori da Test Mode e viewport 320/390/430 px, senza produrre artefatti.

### M6.5.1 — Distinct Equipment Visual Language

Il Custode dimostra ora **silhouette first** con 18 asset SVG ridisegnati sul rig esistente: Plate A slanciata; Plate B più larga e pesante in spalle, torso, cintura, gambe, guanti e stivali; Helmet A compatto e verticale, Helmet B largo con cresta e protezioni laterali; Sword A lunga e stretta, Sword B più corta/larga con guardia ricurva; Shield A kite verticale, Shield B rotondo. Entrambi gli elmi chiusi nascondono capelli, volto, occhi e orecchie; rimuoverli ripristina l'aspetto. Mapping item, statistiche e salvataggi invariati.

**Qualità onesta:** questi nuovi asset Custode sono **pipeline/proxy assets**, dichiarati `quality: "proxy"` nel manifest. Dimostrano silhouette, mapping e composizione; **non sono production-ready e non raggiungono ancora il target semi-realistico illustrato**. Cacciatore, appearance e nemici restano il vertical slice vettoriale M6.5; i fallback restano placeholder. Non sono stati usati ritagli di concept sheet o immagini complete di combinazioni.

Nel DEBUG Showcase (`?test=1`) ci sono gruppi ARMOR, HELMET (incluso Nessuno), WEAPON e SHIELD. ARMOR cambia soltanto il gruppo torso/spalle, gambe, guanti, stivali e cintura; non cambia elmo, arma, supporto, mantello o aspetto. I selettori elmo/arma/scudo sostituiscono soltanto il rispettivo item. I preset completi M6.5 restano in una sezione distinta. **Confronto A/B** confronta un elemento alla volta sulla stessa preparazione: switch immediato a dimensione piena a 320–430 px, due renderer affiancati quando lo spazio consente (da 700 px); posa ferma, stessa scala, nessuna modifica allo stato di gioco. “Silhouette nera” è un controllo DEBUG per confrontare le forme, non un sistema di equipaggiamento/tintura.

I sublayer esistenti sono conservati. Gli spallacci sono asset separati, ancora collegati al torso nel catalogo attuale; non è stato aggiunto un diciassettesimo slot. Guanti, cintura, gambe, stivali e mantello sono item indipendenti. Un futuro slot spalle potrà usare il layer già esistente senza immagini precalcolate. Nessun nuovo sistema di rarità o cambiamento a proficiency, Gear Advisor, formule, progressione, mondo, quest o spedizioni.

Test aggiuntivo: `NYMERIA_TEST_URL=http://127.0.0.1:8009/nymeria node tests/visual-language-browser.cjs`. Verifica sostituzioni limitate ai layer previsti, sei combinazioni, A/B, geometrie senza colore, isolamento/persistenza, viewport 320/390/430 e desktop 800, touch, assenza overflow/errori. Proof salvate fuori dal checkout in `/workspace/nymeria-preview/m651` (`NYMERIA_PROOF_DIR` configurabile). Cache dei documenti/script e asset personaggio aggiornata a `m651-1` per la futura validazione Pages; nessuna pubblicazione automatica.

### M7.0 — Guild Foundation (branch `m7-guilds`, in review)

**Non ancora completato o validato.** La Gilda è una pagina secondaria **Menu → Gilda → Indietro** nello stack M6.2; bottom navigation sempre a quattro destinazioni. Nome/motto locali, tre sigilli SVG originali, unico Fondatore/Maestro, Ufficiali e Membri demo **esplicitamente simulati**, XP/livello e tesoreria sono prototipali. Non c'è multiplayer, backend o contenuto M7.1.

`guild-data.js` contiene catalogo e limiti; `guild-system.js` possiede soltanto `nymeria.guild.v1`, con normalizzazione e operazioni asincrone testabili; `guild-ui.js` presenta il ledger senza dipendere dalle proprietà `window` delle dichiarazioni `const`. I nomi materiali della UI provengono da `ProgressionData.materialNames`; il livello del fondatore è una proiezione in sola lettura di `ProgressionStore.state.level`, non una seconda progressione. I tre script defer caricano in ordine data → system → UI; i bootstrap esistenti e `ProgressionStore` restano invariati. Versione documenti/script `m70-review-1` per evitare cache miste nel branch.

**Contributi isolati:** “Simula contributo” aggiunge unità alla sola tesoreria della gilda; **non sottrae né assegna Corone/materiali del personaggio**, non concede XP personale. Ogni contributo valido assegna `max(1, floor(quantità / 5))` XP di gilda. Non è una transazione economica tra due ledger. Il livello è derivato da XP totale, con soglie `300 + (livello - 1) × 250`, cap 20 e XP corrente 0 al cap; XP oltre il cap non accumulata. Importi interi 1–9999; saldi e totale individuale limitati a 1 miliardo. Importi negativi/zero/non finiti/frazionari/esponenziali/assurdi e overflow vengono rifiutati senza modifiche parziali.

**Persistenza:** ogni operazione rilegge il record più recente, applica il cambiamento a una copia e pubblica lo stato soltanto dopo `setItem` riuscito. Le scritture fallite restano ritentabili. Web Locks (`nymeria-guild-writer`, distinto da `nymeria-progression`) assegna una lease di scrittura alla prima scheda che tenta una modifica, fino a chiusura/reload (`pagehide`). Le altre schede sono consultabili ma le modifiche vengono rifiutate con messaggio; gli eventi storage aggiornano la loro UI in modo asincrono. Questo evita di promettere serializzazione economica sicura con semplici lock per operazione: processi diversi possono avere cache localStorage obsolete anche dopo il rilascio del lock. Alla chiusura della scheda scrivente, un'altra può acquisire la lease e rileggere lo stato. Senza Web Locks la UI chiede di usare una sola scheda; si garantiscono coda e rilettura nella singola istanza, **non modifiche simultanee fra schede/processi**. Unico fondatore locale `player`, ID membri unici, ruoli validi, massimo 30 membri; tutti gli altri membri sono marcati simulati. Nessuna API di prelievo o di gestione ranghi aggiunta.

I salvataggi M7.0 precedenti con `level/xp` sono letti come XP totale equivalente, senza cambiare ID, identità, tesoreria o contributi validi. Campi mancanti/non validi sono ricostruiti, i membri invalidi scartati, il fondatore ripristinato. La normalizzazione è idempotente. JSON corrotto permette di ripartire dalla sola gilda vuota con avviso; non viene cancellata alcuna chiave del personaggio. Nessuna scrittura distruttiva automatica durante il caricamento. Versioni future non riconosciute sono protette da sovrascrittura; storage negato non interrompe navigazione e sistemi precedenti. Questa riparazione locale non è un backup: dati assenti da JSON irrecuperabile non possono essere ricostruiti.

**Collegamento economico futuro consigliato (non implementato):** riunire risorse personali e tesoreria/contributi di gilda nello **stesso record canonico**, tramite migrazione additiva coordinata con `ProgressionStore.transact`. Un reducer puro valida saldo/quantità/cap e aggiorna entrambe le parti della stessa copia; una sola scrittura atomica include ricevuta/ID dell'operazione per idempotenza, sotto lo stesso lock del ledger. Due `setItem` separati, anche sotto un lock, non garantiscono atomicità in caso di crash/quota: evitare debit-first, credit-first o rollback “di sicurezza”. I saldi simulati M7.0 non devono diventare valuta reale durante questa migrazione. Eventuale multiplayer futuro richiederà un'autorità server e una transazione nel database, non localStorage condiviso.

Test nuovi: `node tests/guild-engine.cjs` e `NYMERIA_TEST_URL=http://127.0.0.1:8009/nymeria node tests/guild-browser.cjs`, con server statico montato sul sottopercorso Pages. Coprono creazione/doppia creazione, normalizzazione/corruzione/schema futuro, storage negato/quota/retry, limiti/invarianti, XP/cap, isolamento dei ledger, reload, due tab (scrittore unico, lettura sincronizzata e passaggio di ownership), fallback senza Web Locks, Menu/Gilda/Indietro e touch/overflow a **320/375/390/430 px**. Test fisico Safari/iPhone ancora necessario per form, tastiera numerica, sigilli, scroll/back/focus, persistenza e interazione fra schede.

### M7.1 — Guild Projects: technical review

Faro del Vespro e Carte delle Brume usano il ledger separato `nymeria.guild-projects.v1`: ogni requisito ha il proprio avanzamento, limitato alla quantità richiesta. Il completamento è derivato da tutti i requisiti e salvato con un timestamp nella stessa scrittura; un progetto completato non accetta altri contributi. Le descrizioni degli sblocchi sono feedback del prototipo, non ricompense economiche o nuove funzionalità. Nessuna risorsa personale, XP personale o tesoreria M7.0 viene consumata.

Il caricamento recupera JSON corrotto e strutture incomplete senza scritture automatiche. Letture negate, versioni future e scritture fallite impediscono l'applicazione dell'operazione; il ledger già caricato viene conservato se una lettura fallisce. La coda locale e il lease Web Locks M7.0 impediscono scritture concorrenti fra schede; senza Web Locks rimane necessario usare una sola scheda. Nessun multiplayer reale. La UI dei progetti viene rimontata dopo ogni ricostruzione dell'hub Gilda, inclusa la creazione nella stessa sessione e il cambio di livello del personaggio.

Test: `node tests/guild-project-engine.cjs` e `NYMERIA_TEST_URL=http://127.0.0.1:8009/nymeria node tests/guild-project-browser.cjs`. Coprono validazione, requisiti/cap, completamento unico, persistenza, normalizzazione, storage corrotto/negato/quota, lock rifiutato, isolamento, mount nuovo/esistente, navigazione, sync/handoff fra schede, touch target e overflow a 320/375/390/430 px, errori runtime e rejection. Il test browser serve una risposta vuota per il solo favicon automatico del browser, assente dal server statico locale. La verifica automatica Chromium non sostituisce il test fisico Safari/iPhone della M7.1.

### M7.2 — World Discovery: technical review

`vesper-watchtower` completato sblocca Vesper Outpost tramite il ledger separato `nymeria.world-discovery.v1`. Il motore World e la UI usano la stessa condizione: progetto completato e discovery salvata. Prima dello sblocco il luogo non è mostrato né visitabile, anche se un vecchio salvataggio contiene un flag di accesso. La mappa illustrata e le sue sei coordinate restano invariate; il luogo scoperto ha un collegamento di viaggio accanto alla mappa e una destinazione da Veyra. Contenuto previsto: Frontier Board, senza nuovi sistemi. La prima visita salva soltanto il normale contesto World/flag di visita per conservare il luogo dopo reload; tale flag da solo non autorizza l'accesso. Corone, materiali, XP, Guild Projects e tesoreria non vengono consumati/modificati dalla discovery.

La riconciliazione gestisce anche progetti già completati in M7.1, DOMContentLoaded, storage e pageshow. Schema/ID/timestamp sono normalizzati; JSON corrotto viene ricostruito dal progetto sorgente senza modificarlo, versioni future sono protette. Memoria e accesso vengono aggiornati solo dopo scrittura riuscita. Lettura negata/quota non cancellano il progetto: riaprire la pagina permette di ritentare. Discovery e acknowledgement usano la coda e il lease Web Locks M7 della stessa scheda scrittrice; i no-op non acquisiscono il lease. Senza Web Locks resta necessario usare una sola scheda.

`WORLD UPDATED — Vesper Outpost discovered` riserva l'acknowledgement persistente **prima** di mostrare il feedback, evitando duplicati anche al refresh prima di Open Map o fra schede. Se il salvataggio dell'ack fallisce, non viene mostrato feedback non registrato. La garanzia privilegia assenza di replay: una chiusura/crash nell'intervallo fra ack e rendering può perdere il solo feedback temporaneo, mai lo sblocco. La distruzione manuale del ledger può perdere anche la ricevuta della notifica; il progetto permette di ricostruire l'accesso, non una ricevuta cancellata. Nessun secondo toast areaUnlocked alla prima visita. Open Map seleziona il tab Mondo e apre la mappa; Back/visita riportano alla schermata del luogo corrente, senza lasciare Menu selezionato.

Test specifici: `node tests/world-discovery-engine.cjs` e `NYMERIA_TEST_URL=http://127.0.0.1:8009/nymeria node tests/world-discovery-browser.cjs`. Coprono gating prima/dopo, completamento reale, migrazione M7.1, visita/Frontier Board, persistenza/reopen, notifica unica, acknowledgement, corruzione/storage negato/quota/retry, due schede, pageshow, isolamento dei ledger/risorse, touch e layout 320/375/390/430 px, console/rejection e caricamento sotto `/nymeria/`. La validazione fisica Safari/iPhone resta necessaria per tastiera/focus del feedback, Back, ripresa da sospensione/bfcache e passaggio fra schede.

### M7.3 — Professions & Crafting: technical review

Le tre professioni, ricette e siti di raccolta esistenti restano invariati. Il ledger `nymeria.professions.v1` è isolato da risorse personali, tesoreria, progetti e discovery M7.2. Ogni operazione rilegge il salvataggio sotto la politica di scrittura: costi, prodotti, XP e scoperta della ricetta sono salvati in un solo record; quota/lettura negata non applicano modifiche parziali. La posizione è aggiornata sotto il lock di Progression e letta dal contesto World corrente, non da un argomento fornito a `gather`: nodo corretto, luogo realmente accessibile e nessun incontro attivo sono richiesti anche chiamando direttamente il motore. Le ricette non dichiarano una postazione geografica specifica: restano utilizzabili nei luoghi accessibili fuori dagli incontri.

Gli XP professionali sono canonici (`totalXP` per professione); livello/XP residui sono ricostruiti deterministicamente, livello massimo 20 con XP residui zero. I salvataggi v1 precedenti con `level/xp` sono convertiti senza scritture automatiche. Materiali e scoperte usano ID del catalogo; stock massimo 1.000.000, overflow rifiutato prima di addebitare costi. Il chart già assemblato non consuma altri frammenti né assegna di nuovo XP. Raccolta ripetuta e crafting ripetuto di materiali restano permessi, con normali controlli di posizione, quantità, livello e costi; nessun cooldown/stamina introdotto.

JSON corrotto/incompleto recupera i dati validi disponibili o riparte dal solo ledger professioni vuoto; versioni future sono protette dalla sovrascrittura. Il lease Web Locks dedicato alla scheda scrittrice, la coda locale e storage/pageshow impediscono aggiornamenti obsoleti fra schede; senza Web Locks usare una sola scheda. La UI conserva feedback di successo/errore, blocca azioni non valide/in corso e aggiorna materiali/professioni al cambio di contesto.

Test specifici: `node tests/profession-engine.cjs` e `NYMERIA_TEST_URL=http://127.0.0.1:8009/nymeria node tests/profession-browser.cjs`. Coprono guardie del motore, crafting atomico/insufficienza/overflow, ripetizioni, XP/cap/migrazione, corruzione/schema futuro/lettura negata/quota, navigazione Menu/World/Back, persistenza, due schede e handoff, isolamento dei ledger, console/rejection, touch e overflow a 320/375/390/430 px. Safari/iPhone richiede ancora test fisico di tap rapidi, focus/scroll dopo i feedback, Back e ripresa da sospensione/bfcache. Nessuna distribuzione DEV automatica.

### DEV mobile quest clarity

On `dev/kaelith-modular-character`, the initial journey remains MQ01 → MQ02 →
MQ03 → Elar, with the optional Bram preparation and equipment comparison intact.
The main tracker shows one objective/progress line and one next action. Journal
and tracker distinguish active, ready-to-claim and claimed/completed missions
with text, borders and a completion check, not colour alone. Main-story targets
stay marked even when a secondary quest is tracked. The latest equipment reward comparison stays in the World tracker after reload,
without automatically equipping it; the claim receipt avoids duplicating that
comparison in the same World view. In quest detail it precedes the next-mission action. Quest buttons carry a diamond marker and mobile
primary controls retain at least 48px touch height, with wrapping at 320px.

These are presentation changes only: no quest prerequisites, NPC requirements,
rewards, XP, combat rules, storage schemas or character rendering have changed.
Claims continue to work wherever the existing engine permits; no extra return
trip to the quest giver is implied. Tests: `tests/mobile-quest-clarity-browser.cjs`
and the existing quest/journey/reward/World regressions. Physical Safari/iPhone
verification remains required for scroll/focus, rapid taps and browser resume.

### Sprint 1 — mobile usability (DEV)

The existing mission shortcut in the new top-bar control is available from every
main screen and opens the actual main quest; Back names its return screen and
keeps the navigation stack. The journal distinguishes story, side quests and
professional delivery activities using existing quest objectives, without adding
quests or prerequisites. World actions name their NPC, enemy or collected item.
Inline feedback reports objective completion and claim readiness from the state
before/after a successful action, without a new notification queue or save writes.

Inventory cards show category and a compact preview of existing stats. The detail
sheet summarizes the existing class/build advice and preserves full stat deltas;
technical scoring is expandable. Nothing equips automatically. Mobile controls,
wrapping and dialog safe-area padding are refined; transient notice feedback does
not capture taps. Frozen character assets and renderer files remain untouched.

Verification includes 320/375/390/430 × 844 touch contexts, normal-mode entry at
Veyra, optional Bram gathering/crafting/delivery, combat preparation, Cervo, Elar,
reward comparison and reload. `tests/sprint1-mobile-browser.cjs` checks the global
quest shortcut, Back, categories, non-mutating comparison and inline completion
feedback; existing journey/reward tests cover the actual combat path. Real Safari
and physical iPhone are unavailable here: scrolling/focus, safe-area on device and
resume from suspension remain physical validation items. No manual DEV deployment.

### Sprint 1.1 — fixed-screen mobile interface (DEV)

`fixed-screens.js` is a presentation adapter loaded after the existing UI modules.
It retains the real DOM nodes and their listeners, measures the current visual
viewport, reserves space for safe areas, navigation and creator actions, then
paginates the rendered content. No engine, reward, XP curve, save schema or frozen
character asset/renderer changes are involved. The shell uses `dvh` with a
`visualViewport.height` fallback/update for browser bars and the software keyboard.
Overflow is constrained only after content is split into accessible pages; it is
not used to discard content. Back, the four navigation destinations, and page
controls remain outside the content pages. In a short viewport, Back and the
mission shortcut share a row and decorative navigation glyphs are omitted while
labels and targets remain available.

Converted content includes initial World/locations and map, creator/character,
main/side/profession quest journal, profession activities, inventory categories,
equipment and item comparison dialog, class/build/strategy, expeditions, Guild
and Menu. Quest categories have separate tabs; inventory keeps its actual category
filters. Long logs and expanded details are paginated rather than internally
scrolled. World combat keeps player/enemy HP, class resource and all existing
controls together; optional arena art/history occupy additional pages. Results,
quest receipts and progression data use the same page system. Form validation
reveals the page containing the invalid field, and input focus is retained across
viewport resize. Creator confirmation is visible only in Character and still
uses the existing persistence/lock implementation.

The latest equipment reward prompt is now shown only for an owned, unequipped,
class-compatible item which the existing Gear Advisor considers an improvement.
It disappears when equipped or superseded; nothing equips automatically and
comparison does not write game state. The next-quest receipt names the existing
quest giver and location, explains the current action, and opens the real quest
with its existing travel/interaction controls. It adds no destinations or NPCs.

Run a static server from the repository and use `NYMERIA_TEST_URL` for another
origin or subpath. The five behavior suites are:

- `node tests/fixed-screens-browser.cjs`: 320/375/390/430 × 568/667/844;
  every page, readable content/control bounds, quest categories, strategy,
  new/existing Guild, comparison modal, invalid form, 375px keyboard viewport,
  browser-height contraction/expansion, console/runtime errors and asset requests.
- `node tests/fixed-battle-browser.cjs`: four widths × 375/508/568/667/844;
  simultaneous essential combat information/controls and no content overflow.
- `node tests/fixed-feedback-browser.cjs`: creator confirmation/reload, category
  filtering without save writes and level feedback in the five tested heights.
- `node tests/fixed-reward-prompts.cjs`: useful upgrade shown, equipped/incompatible
  items suppressed, state/storage unchanged.
- `node tests/fixed-screens-journey.cjs`: four widths × Custode/Cacciatore;
  normal mode Veyra/Bram → gathering/crafting/delivery → reward/equipment →
  story combats → Cervo at level 2 → Elar unlock → reload. Test-only engine
  advancement skips waiting for automatic combat; it changes no production rules.

All fourteen existing engine suites are also run. Legacy browser tests which
assume every long-page control is simultaneously visible need the pagination
fixture when reused; their direct-scroll assumptions are not a fixed-screen test.
Chromium touch emulation is available; real Safari/iPhone and WebKit are not.
Physical validation remains required for actual browser chrome/keyboard,
safe-area insets, focus and suspend/resume. No manual deployment is performed.
