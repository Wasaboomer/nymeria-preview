# F1 — contratti cooperativi e attributi (inattivi)

## Ambito

`combat-contracts.js` e `attribute-schema.js` non sono inclusi in index.html, non importano il motore né store e non modificano profili, formule, statistiche o attività. Sono contratti puri/CommonJS utilizzabili nei test, non un combattimento cooperativo attivo. Non creano classi, cure, minaccia, provocazioni o assorbimenti. La UI e tutti gli ID persistiti restano quelli legacy.

## Attori, squadre e azioni

`roster(teams, actors)` valida ID espliciti/stabili (mai ricavati dal nome o dall'ordine dell'array), unicità e riferimenti alle squadre. Gli attori conservano `id`, `teamId`, `lifeState`, `hp`, `maxHp`; alive richiede HP positivi, dead richiede zero. Non sono stati introdotti stati di resurrezione o incapacità. Il risultato è una copia congelata e non modifica l'input.

`actionIntent(raw, roster)` descrive ID dell'azione e dell'abilità, fonte, bersaglio singolo, categoria damage/heal/protection/effect e relazione self/ally/enemy. Rigetta attori assenti/morti e relazioni incoerenti. NON esegue l'azione, controlla costi, calcola cure, determina effetti o impone nuove regole alle abilità legacy. Una futura definizione dell'abilità deve specificare quali relazioni consente: la categoria da sola non autorizza un bersaglio. Multibersaglio, neutralità/ostilità fra squadre, incapacità e resurrezione sono decisioni successive.

## Ordine e RNG

Il descrittore legacy riporta il passo corrente di 0,05 s e l'ordine effettivo: risorsa → tick/scadenza effetti giocatore → tick/scadenza effetti nemico → controllo morte → azione giocatore → controllo morte → azione nemico → controllo morte. I tick DoT possono avvenire esattamente alla scadenza; poi l'effetto viene rimosso. Nel singolo attacco i modificatori, il critico, la mitigazione e il danno restano nell'ordine implementato oggi.

Attacco giocatore: roll critico, quindi roll dei soli item hook ammissibili nell'ordine corrente dell'inventario, soltanto se il nemico sopravvive. Attacco nemico: roll schivata, anche se la probabilità è zero; roll blocco soltanto se il colpo non è schivato e blockChance > 0. Buff, aggiornamenti di risorse e tick effetti non consumano RNG. La generazione del seed avviene fuori da questa sequenza. Nessuna estrazione è aggiunta o rimossa.

Il contratto futuro `futureOrder.orderedEvents` ordina per tick intero, fase (resource/periodic/expiry/action/terminal), ID fonte con confronto di codice stabile (non locale), sequenza locale. Chiavi ambigue e ID evento duplicati sono rifiutati. È una proposta di protocollo futura, NON applicata al loop legacy; tick e scadenze simultanei devono essere definiti prima dell'attivazione.

`plannedDraws` elenca le estrazioni dichiarate negli eventi già ammissibili: flusso seeded unico, eventi nell'ordine canonico, etichette nell'ordine dichiarato. Nessun RNG viene eseguito. Gate e probabilità delle future abilità sono ancora da definire; un gate respinto non deve dichiarare estrazioni. Il piano richiede eventi normalizzati dal futuro scheduler, non è un replay completo né un'autorizzazione client.

## Versionamento dei replay

`rulesForReplay` riconosce il solo motore eseguibile attuale `legacy-1v1`, versione 1. L'assenza di `simulationRules` denota i replay legacy; metadata espliciti devono usare `{id:'legacy-1v1', version:1}`. `rulesVersion` delle spedizioni NON è trattato come versione del motore. Versioni ignote, metadata null e motori cooperativi sono rifiutati senza riscrivere il ticket.

Il resolver è inattivo: non viene collegato a World/Expedition in F1, quindi non promette nuovi controlli runtime già applicati. Prima di cambiare il motore, collegare un dispatcher ai ticket e conservare un interprete legacy separato. Il descrittore non congela il codice e non certifica replay di release storiche diverse. Il vecchio snapshot completo, seed, clock/pausa, profilo, strategia e politica del loot devono rimanere intatti; le attività iniziate non vanno rieseguite col profilo corrente.

## Schema approvato degli attributi

Primari: strength/FOR (potenza fisica), agility/AGI (attacchi agili/schivata), stamina/STA (HP/resistenza), intellect/INT (magia/cure), spirit/SPI (rigenerazione/risorse).

Secondari: critical, haste, accuracy, armor, parry, block, magicResistance. Il nuovo schema è inattivo, senza default numerici, crescita, pesi, formule, conversioni o cap. Le unità dei secondari restano undecided. Il validatore accetta soltanto envelope versione 1 `status:unassigned`, con valori parziali finiti/non negativi eventualmente forniti dal chiamante; valori omessi restano omessi, mai zero implicito. Gli esempi numerici dei test sono fixture, non valori di bilanciamento.

| Legacy | Candidato futuro | Vincolo |
|---|---|---|
| force | strength | Identità semantica, coefficienti futuri non decisi |
| agility | agility | Oggi influenza anche critico e GCD: non copiare automaticamente |
| vigor | stamina | HP simili, ma nessun modello generale di resistenza; non è un alias attivo |
| spirit | spirit | Incompatibilità semantica: oggi entra nel danno, in futuro governa risorse |
| critical | critical | Oggi punti/100 più AGI; unità e conversione da decidere |
| speed | haste | Oggi influenza GCD; celerità futura non definita |
| armor | armor | Mitigazione attuale conservata, distinzione magica da decidere |
| — | intellect/accuracy/parry/magicResistance | Nessuna equivalenza numerica esistente |
| blockChance/blockReduction del profilo | block | Modificatori di specializzazione, non statistiche dell'oggetto |

Non trasferire SPI legacy a INT, non duplicarlo in entrambe, non rinominare vigor negli oggetti. Schivata resta una statistica derivata potenziale, non un sesto primario approvato. Critico/armatura e speed sono già usati dal legacy, ma lo schema futuro non li attiva né li sostituisce.

## Piano di migrazione successivo (non implementato)

1. Decidere formule, unità/cap e assegnazione per classe, oggetti e crescita; nessuna conversione autorizzata ora.
2. Preparare una proiezione parallela `attributes` con schema/versione e provenienza `migrationId`, preservando integralmente i campi legacy e i byte dei salvataggi precedenti finché non è necessaria una nuova scrittura.
3. Personaggi: nuova proiezione dai dati di origine, non dai totali già comprensivi di equipaggiamento. Non convertire automaticamente INT/SPI. Non cambiare classe o selezioni.
4. Catalogo: mapping separato/versionato per ID oggetto esistente; gli item già posseduti non sono rimossi/duplicati. Equipaggiamento attivo e glamour restano distinti. Il catalogo nuovo non deve reinterpretare gli snapshot salvati.
5. Progressione: crescita futura derivata da livello e classe; niente applicazione incrementale o doppio conteggio. XP, livello e curva rimangono invariati. HP futuri solo dopo approvazione delle formule.
6. Persistenza: idempotenza tramite versione e migrationId, senza ricalcolare una migrazione già riconosciuta. Versioni future ignote: read-only con errore esplicito, niente downgrade/reset. Su corruzione/errore di storage conservare l'originale, non dichiarare migrazione riuscita. Strategie AUTO/PERSONALIZZATE restano nelle chiavi attuali.
7. Effettuare ogni passaggio nella transazione dello store proprietario. Nessuna atomicità implicita fra Equipment/Class/Progression separati; prima di attivarli insieme serve un envelope canonico o protocollo di recovery, da approvare separatamente. Provare crash tra scritture e retry.
8. Ticket e replay già iniziati continuano con statistiche/profile legacy e interprete legacy. Ricompense una sola volta, Smart Loot legato alla preparazione. Proiezioni nuove non modificano attività correnti.
9. Solo dopo test/migrazione approvata attivare lettura del nuovo schema, separatamente dalla Foundation.

## Test e criteri

Nuovi test: `combat-contracts-engine.cjs`, `attribute-schema-engine.cjs`; il runner esistente li rileva come engine suite. Nessuna modifica a runner, HTML, workflow o salvataggi.

Confrontare `specialization-engine.cjs`: sei profili byte-equivalenti e 90.000 snapshot contro digest congelati. Eseguire anche combat/class-build/offensive/avenger/mage/stat-growth/manual-rewards/progression/armor-loot/offline engine per strategie, persistente preparazione, risorse, loot, ricompense uniche e HP. Build web per verificare compatibilità; nessuna nuova UI richiede collaudo visuale in F1.

Decisioni aperte: unità/cap dei secondari, formule INT/SPI/STA, resistenza fisica/magica, semantica parata/blocco, condizioni su alleati, multi-target e resurrezione, ordine fra fonti/scadenze, versionamento/interpreti e persistenza autorevole multiplayer. Nulla di questo è attivato qui.
