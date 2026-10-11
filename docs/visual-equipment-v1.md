# Equipaggiamento visivo modulare V1 — prova locale isolata

Pagina: `visual-equipment-v1.html`, servita dalla radice del checkout con un server HTTP locale. Nessun collegamento aggiunto al gioco, nessun push/deploy previsto.

## Componenti riutilizzati

- `equipment.js` già separa equipaggiamento/statistiche da appearance e glamour; non viene caricato dalla prova perché inizializza lo stato persistente.
- `equipment-data.js`: catalogo originale, ID, slot e metadati appearance.
- `items.js`: palette, capelli e volto già presenti.
- `visual-manifest.js`: rig 360×640, layer, associazioni oggetti/asset, regole di occultamento e fallback.
- `visual-renderer.js`: composizione SVG asincrona per layer e provider esplicito del modello. L'unica modifica condivisa protegge l'accesso a Equipment nella diagnostica quando il renderer è usato senza gameplay.

La prova mantiene soltanto selezioni visive in memoria. Non usa localStorage, non equipaggia oggetti, non calcola statistiche né verifica kit giocabili. Il catalogo include oggetti non posseduti: questa è una verifica grafica, non l'inventario del giocatore. Refresh ripristina il modello visivo vuoto.

## Disponibilità reale

Testa, torso, gambe, stivali, guanti, mantello, arma e supporto hanno moduli esistenti. Plate A/B, Mail A, spade A/B, scudi A/B, arco/faretra e mantelli provengono dal manifest originale. Il torso può aggiornare anche le spalle associate; gli elmi possono nascondere capelli/volto secondo le regole esistenti. Il supporto viene nascosto con una vera arma 2H.

Le armature Plate sono dichiarate proxy; non sono asset definitivi. Gli oggetti senza mapping dedicato possono utilizzare rappresentazioni condivise/fallback, esplicitamente indicate nell'audit. Le asce e i martelli 2H (incluse controparti narrative) hanno appearance.unavailable e nessun modulo visualizzato. La lancia usa il bastone condiviso, non una silhouette dedicata. Lo spadone possiede l'asset esistente. Nessun asset viene creato o modificato.

## Verifica

- `node tests/visual-manifest.cjs`: manifest, file, rig, mapping, alternative e compatibilità dati.
- `node tests/visual-equipment-v1-browser.cjs`: richiede Playwright/Chromium e server sulla porta 8026; controlla gli otto cambi A/B, conservazione del nodo pelle, tutti gli oggetti degli otto slot a 390 px, cambi consecutivi, asset assenti/404, layout e touch 320/375/390/430 px, reload e isolamento localStorage.
- `npm run build:web`: verifica build del gioco invariato. La pagina isolata non è inclusa nell'entry mobile confezionata: non è un'integrazione nel gioco.

Il collaudo Chromium non certifica Safari/iPhone fisico. Prima di integrare la prova, validare sul dispositivo e decidere quali mapping condivisi richiedano veri asset dedicati.

## Esito del ciclo locale

134 controlli mirati superati; 7 verifiche del manifest superate; build riuscita. Controllata anche una schermata Plate a 390×844. La suite storica `visual-browser.cjs` passa i primi 7 scenari a 320 px e fallisce sull'aspettativa che il filtro inventario nasconda armature incompatibili (riga 293). Lo stesso fallimento è riprodotto servendo il renderer originale di HEAD tramite intercettazione Playwright, senza modificare sorgenti: non è una regressione di questa prova. Il test storico non è stato aggiornato perché fuori ambito. Suite globale non eseguita; nessuna certificazione Safari fisico.
