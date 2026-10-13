# Borsa dei materiali — Fase 1, contratto inattivo

`material-bag-contract.js` non è importato dal gioco. Non accede a DOM, storage, orologio o RNG; nessuna migrazione o applicazione della capacità è attiva.

## Identità e proprietà

Il catalogo comprende i tre materiali di ProgressionData e i cinque di ProfessionData, incluso il Rinforzo della Frontiera: è un prodotto materiale, non equipaggiamento. Ogni riga conserva ID esistente, proprietario e percorso della quantità. La chiave comune è `owner:id`; iron e raw-iron non sono sinonimi. Valute, equipaggiamento e supplies delle missioni sono fuori dal conteggio. I materiali restano nei registri originali: le proiezioni restituite sono temporanee, non un nuovo salvataggio.

## API

- `capacityFor(expansions=0)`: 40 + 10 per ampliamento, massimo 100 (0–6 ampliamenti interi). Input non validi generano RangeError; nessun clamp silenzioso.
- `inspect({progression, profession}, options)`: riceve snapshot dei registri e conta tipi con quantità positiva. Proprietari assenti significano snapshot vuoti, non autorizzano a trattare un errore di lettura storage come assenza. Restituisce occupati, disponibili e overCapacity. Non elimina scorte oltre la capacità.
- `plan(ledgers, {consumes, produces}, options)`: righe `{key, quantity}`. Aggrega righe ripetute, verifica disponibilità dei consumi prima delle produzioni e verifica la capacità soltanto sul risultato finale. La produzione non può finanziare ingredienti mancanti. Zero è valido e non occupa slot. Interi sicuri non negativi; overflow, tipi sconosciuti e dati malformati bloccano la pianificazione.
- `options.entries`: catalogo esplicito per estensioni future e fixture, senza aggiungere contenuti al gioco. Identità duplicate/non valide sono errori di contratto.

Un rifiuto `capacity-exceeded` ha `retryable:true` e non restituisce uno stato parzialmente applicato. La futura riscossione deve mantenere premio e ricevuta intatti e ritentare con stato aggiornato. Questo modulo non garantisce unicità o atomicità di riscossione: restano responsabilità del proprietario della transazione. Nessun ampliamento viene assegnato da questa API.

Dati sconosciuti, anche a quantità zero, producono un errore esplicito invece di sparire dalla proiezione. Non viene effettuata alcuna riparazione. Uno stato già oltre capacità è diagnosticato; piani che lo lasciano oltre capacità sono rifiutati, senza perdita delle scorte. La politica di recupero di eventuali futuri stati sovracapienza resta da definire prima dell'attivazione.

## Confini futuri

La validazione pura non coordina due scritture localStorage, non consuma cariche dei nodi e non implementa deposito. Prima dell'attivazione servono coordinamento dei registri, migrazione additiva dei metadati e integrazione delle ricevute delle ricompense.

Test: `node tests/material-bag-contract-engine.cjs`. Le fixture sintetiche per 40/100 tipi non sono oggetti di gioco. I test confrontano il catalogo con i dati reali e verificano esclusioni, identità, crafting sullo stato finale, premi ritentabili, input invalidi, quantità limite e immutabilità.

# Fase 2 — Metadati e coordinamento, ancora non integrati nel gameplay

`material-bag-store.js` aggiunge infrastruttura esplicita; non viene caricato da index.html o dai motori. Il record viene scritto solo quando un futuro chiamante invoca `initialize()` o un'assegnazione autorizzata, non all'importazione o alla costruzione dello store.

## Record e migrazione additiva

Chiave dedicata `nymeria.material-bag.v1`:

```json
{"version":1,"baseCapacity":40,"expansionIds":[]}
```

La capacità deriva da 40 + 10 × numero delle ricevute, massimo sei ampliamenti/100 slot. Il record non contiene quantità, duplicati dell'inventario, timestamp o stato di missioni. Gli ID delle ricevute devono essere stabili e univoci per concessione, non generati a ogni tentativo. `grantExpansion(id)` è un'API infrastrutturale riservata: non è collegata a premi, UI, artigiani o Debug.

`initialize()` rilegge il record e inizializza soltanto una chiave assente. Completa i campi mancanti di un record v1/versionless riconoscibile, preservando le ricevute; non riscrive un record completo a ogni riavvio. Non legge, modifica o normalizza i salvataggi legacy di progressione, professioni o equipaggiamento.

JSON corrotto, shape invalida, ricevute duplicate, più di sei ricevute, campi extra o versione sconosciuta bloccano le scritture senza sostituire i byte originali. Una capacità isolata priva di ricevute non viene reinterpretata. Nessun recupero distruttivo automatico o backup implicito: la riparazione di record invalidi richiederà una procedura separata approvata. Storage assente/negato e quota producono errori; nessuna cache espone un ampliamento non salvato. Un retry rilegge il record. ID già concesso non aggiunge capacità, anche al limite massimo.

## Garanzie del coordinatore

`createCoordinator({locks})` fornisce `run(operation)`, coda asincrona e gestione dei fallimenti. La coda condivisa predefinita serializza gli store partecipanti nella stessa istanza JavaScript. Uno store rilegge i metadati dentro la sezione coordinata prima di ogni scrittura. Il coordinatore può ricevere esplicitamente `navigator.locks`, per usare il lock nominato `nymeria-material-bag-coordinator` tra contesti partecipanti dello stesso origin. Il modulo non accede implicitamente a navigator o localStorage. Il campo `coordinationScope` dichiara il livello effettivo; senza Web Locks non esiste garanzia fra schede/processi.

Il callback deve concludersi e non richiamare ricorsivamente lo stesso coordinatore. Non sono implementati lease di durata, timeout, rollback o compensazione di eventuali scritture del callback. Gli errori non avvelenano la coda; non annullano scritture già effettuate dal chiamante.

**Non è una transazione multi-record.** La serializzazione è valida solo per scrittori partecipanti. ProgressionStore e ProfessionEngine usano lock/protocolli distinti e restano invariati. Non si garantisce ancora un controllo globale della capacità, né una mutazione atomica tra quantità, ricompense e metadati. Con due setItem può verificarsi un aggiornamento parziale o un crash intermedio, anche mantenendo un lock.

## Intervento successivo separato

Prima di attivare i limiti: definire un coordinamento comune di tutti gli ingressi/uscite materiali, ordine dei lock compatibile con le lease esistenti e rilettura affidabile degli snapshot tra processi. Non annidare semplicemente il nuovo lock sui lock esistenti: serve verificare deadlock e visibilità delle cache. Le operazioni su più registri richiedono una scelta esplicita fra transazioni effettive e protocollo journal recuperabile/idempotente. Nessuno dei due è introdotto qui. Va inoltre definita la conservazione dei premi non riscossi a capacità piena.

Test aggiuntivo: `node tests/material-bag-store-engine.cjs`, con storage in memoria e fallimenti iniettati; nessun salvataggio reale viene modificato.
