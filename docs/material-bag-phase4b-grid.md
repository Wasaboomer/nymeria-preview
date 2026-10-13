# Borsa — Fase 4B, griglia locale provvisoria

Cinque colonne per ciascun raggruppamento esistente; solo materiali con quantità
positive. Ordine immutato: quello del catalogo Fase 4A, con registro Progressione
prima delle Professioni. Lettura, capacità e metadati non modificati.

Non sono disponibili asset dedicati ai materiali: simboli SVG schematici inline
(lingotto, minerale, incudine, fibre, cristallo, erbe, mappa, rinforzo) sono
segnaposto di presentazione, non artwork definitivi. Nessuna emoji/dipendenza.
Nome completo nell'etichetta accessibile; quantità nell'angolo inferiore destro.
Quantità grandi in notazione compatta italiana: il valore esatto resta nel titolo,
nell'etichetta accessibile e nel dettaglio esistente. Nessuna arrotondatura dei dati.

Lo slot riutilizza data-stack-key e il dettaglio risorsa originale. Il dettaglio
aperto dalla Borsa ora legge la medesima proiezione sicura della griglia, evitando
quantità obsolete nella cache delle Professioni dopo modifiche in altra scheda.
Errori di lettura sono mostrati anche nel dettaglio, senza copie persistenti.

Il layout modale esistente rimuove temporaneamente lo scorrimento del pannello:
si salva soltanto la posizione/focus della Borsa in memoria alla sua apertura e
si ripristina dopo il ritorno del layout, con due requestAnimationFrame. Nessuna
modifica a navigazione globale, fixed-screens o altri dettagli. Nessun drag,
pressione prolungata o ordine manuale. CSS confinato a #material-bag-view.

## Verifiche

Il primo test ha rilevato perdita dello scroll (442 → 0); corretto il ritorno
solo della Borsa. Il test esteso a tutte le otto identità ha poi rilevato una
quantità cache obsoleta nel dettaglio; corretto usando il lettore Fase 4A.
I fallimenti iniziali sono reali e non sono stati mascherati con timeout.

Test finale browser passato a 320/375/390/430 px: cinque colonne, tutti gli otto
slot toccati alle coordinate, dettagli corretti, touch >=48x48, quantità elevate,
scroll/focus ripristinati, ordine stabile dopo reload, stati vuota/piena/oltre
capacità/illeggibile, aggiornamento sui singleton dopo raccolta/crafting,
nessuna scrittura di consultazione, capacità inattiva e nessun overflow.
Piena/oltre capacità restano proiezioni isolate: catalogo reale di otto tipi.

Safari fisico non verificato. Icone provvisorie e quantità abbreviate richiedono
collaudo visivo reale. Nessun commit/push/deploy; il blocco [skip dev deploy]
resta intatto. Nessuna modifica a main, Colyseus o capacità.

Esito finale: 6 suite pertinenti distinte superate (vista engine/browser,
interface-refinement browser, runtime engine, mobile-foundation engine,
specialization engine). Nessun fallimento residuo; 90.000 snapshot legacy
identici. Build riuscita dopo le correzioni, verificata anche la corrispondenza
esatta degli asset confezionati. Suite globale completa non rieseguita in 4B.

## Validazione finale e autorizzazione pubblicazione DEV

Eseguita una sola suite globale completa: **75 suite superate, 0 fallite**,
con **90.000 snapshot legacy identici**. Build finale riuscita; dopo build,
vista engine/browser, runtime engine, mobile-foundation engine e
interface-refinement browser: **5 suite superate, 0 fallite**.
Verificati otto materiali, cinque colonne, scroll/focus, quantità aggiornate,
reload e quattro viewport; nessuna scrittura di consultazione o attivazione
ordinaria della capacità. Nessuna modifica a main o Colyseus.

La successiva autorizzazione permette ora commit senza marker opt-out e push
DEV, con pubblicazione automatica subordinata alla CI. Workflow remoto
`Publish NYMERIA DEV preview` letto e verificato: checkout soltanto del branch
DEV sorgente, test job riuscito richiesto, confronto source_sha/HEAD e controllo
anti-obsolescenza prima del deploy. Destinazione esclusiva github-pages del
repository separato nymeria-dev-preview. Nessuna pubblicazione su main del gioco
o store. Non avviare workflow alternativi se l'automatismo fallisce.
L'esito CI/deploy e lo SHA online devono essere verificati dopo il push;
questi risultati locali non dimostrano da soli una pubblicazione riuscita.
