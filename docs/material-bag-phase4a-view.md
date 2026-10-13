# Borsa dei materiali — Fase 4A

Vista di sola consultazione nel filtro **Materiali** dell'Inventario, senza nuova
rotta o navigazione principale. La lista mostra solo quantità positive, nome e
quantità, con il dettaglio risorsa preesistente ancora accessibile al tocco.

`MaterialBagView.read` usa `ProgressionStore.readSnapshot`,
`ProfessionUI.engine.readSnapshot` e `MaterialBagStore.read`: nessuna inizializzazione
persistente dei metadati, nessuna copia delle quantità e nessun lock di scrittura.
La capacità assente viene proiettata come 40; concessioni registrate portano a
50–100. Errori di lettura, dati sconosciuti e versioni future mostrano un errore,
non una Borsa vuota né saldi parziali. Una successiva lettura valida ripristina
la vista senza riparare o riscrivere i record.

Il contratto non definisce categorie merceologiche: si riutilizza il proprietario
Progressione/Professioni come raggruppamento. Non si inventano categorie nuove.
Ferro del Vespro, Ferro grezzo e Ferro forgiato conservano chiavi e nomi distinti.
Corone e oggetti di missione restano fuori da questa vista e dagli slot; sono
ancora consultabili negli altri filtri esistenti dell'Inventario.

Messaggi dedicati per vuota, piena e oltre capacità, con indicazione esplicita
che il limite non è attivo. Nessuna azione di ampliamento o attivazione in UI.
Stili confinati a #material-bag-view, senza nuovi asset o branding gameplay.
Aggiornamento su notifiche dei due motori, ritorno in Inventario, pageshow e
storage (altra scheda). La lettura sequenziale non è una transazione atomica
multi-registro: la vista è consultiva e non autorizza mutazioni.

## Verifica

Test engine: catalogo reale, identità simili, zero/quantità elevate, capacità
40/50/100, errori/corruzione/versioni future e nessuna scrittura. Occupazioni
39/40/41/45 simulate con catalogo esplicito nel test puro: nel catalogo attuale
esistono solo otto materiali e tali occupazioni non sono raggiungibili realmente.
Nessun materiale sintetico viene aggiunto al runtime o ai salvataggi di gioco.

Test browser: 320/375/390/430 px, touch alle coordinate della scheda Materiali,
entrambi i registri, dettaglio risorsa preservato, quantità elevate, ampliamenti,
reload, dati illeggibili e recupero, vuota, aggiornamento dopo raccolta e crafting
sui singleton reali, filtro Equipaggiamento/Indietro, assenza di overflow e di
scritture causate dalla consultazione. Fixture in context isolati, non salvataggi
reali. La regressione storica interface-refinement viene eseguita senza cambiarne
le aspettative. Suite engine di capacità/runtime/oltre-capacità, packaging,
build e 90.000 snapshot legacy inclusi nella validazione mirata.

Safari iPhone fisico non verificato. Per una prova fisica servirà un'anteprima DEV
pubblicata con autorizzazione separata, oppure un server locale raggiungibile
sulla stessa rete dell'iPhone. Questa fase resta locale, senza commit/push/deploy.

Esito locale: 8 suite pertinenti distinte superate, 0 fallite (nuova vista engine,
nuova vista browser, interface-refinement browser, runtime/capacity/overcapacity
engine, mobile-foundation engine, specialization engine). Build riuscita;
90.000 snapshot identici. La suite globale completa non è stata rieseguita in
questa fase; la nuova suite browser è registrata nel runner globale.

## Preparazione anteprima (nessun deploy in questo consolidamento)

Workflow remoto letto il 2026-10-13:
`Wasaboomer/nymeria-dev-preview/.github/workflows/publish-dev.yml`, nome
`Publish NYMERIA DEV preview`. Sorgente fissata a
`Wasaboomer/nymeria-preview:dev/kaelith-modular-character`; input manuale
`source_sha`, ambiente `github-pages`, concorrenza con cancellazione del job
precedente. Verifica HEAD, opt-out, test job riuscito e HEAD ancora corrente
prima del deploy. Non è presente schedule nella versione remota letta.

Il consolidamento senza deploy include obbligatoriamente `[skip dev deploy]`:
il dispatch automatico è disabilitato e il workflow di destinazione rifiuta
anche un dispatch manuale per questo SHA. Per pubblicare successivamente sarà
necessaria un'autorizzazione esplicita a un nuovo commit DEV pubblicabile senza
quel marker (anche senza cambiamenti al codice); i test devono riuscire su quel
nuovo SHA. Non rimuovere o aggirare il controllo opt-out del workflow.

Dopo tale autorizzazione, il push pubblicabile utilizza il flusso automatico.
Fallback, soltanto se non c'è già un deploy in corso:

```sh
gh workflow run publish-dev.yml --repo Wasaboomer/nymeria-dev-preview --ref main -f source_sha=SHA_DEV_PUBBLICABILE
```

Il ref main qui è quello del repository separato di pubblicazione, non quello
sorgente del gioco. Destinazione: https://wasaboomer.github.io/nymeria-dev-preview/.
Verificare il workflow riuscito e poi che `dev-preview-version.txt` riporti
`DEV SHA_DEV_PUBBLICABILE`, con fetch non cacheata; un job verde non basta.
Infine aprire Inventario → Materiali su Safari iPhone. Nessun comando di deploy
è stato eseguito in questa fase.

## Validazione finale per consolidamento — 2026-10-13

Suite globale completa (engine e browser): **75 superate, 0 fallite**.
Equivalenza deterministica: **90.000 snapshot legacy identici**.
Build finale riuscita; successivamente ripetute vista engine, runtime engine,
mobile-foundation engine, vista browser e interface-refinement browser:
**5 superate, 0 fallite**.

Il test browser della vista verifica ora esplicitamente Inventario → Materiali
→ dettaglio → ritorno tramite touch, con nessuna scrittura di consultazione.
Per 39/40/41 tipi sostituisce soltanto la risposta del modulo nel browser di test
con una proiezione sintetica controllata: verifica anche i testi piena e oltre
capacità senza nuovi oggetti persistiti o flag nel runtime. I casi vuota,
illeggibile, quantità, aggiornamento dopo raccolta/crafting e reload restano
verificati sulle istanze reali. Nessun logo aggiunto; capacità sempre inattiva.

Diff limitato agli otto file approvati di schermata, test e documentazione.
Consolidamento sul solo DEV con `[skip dev deploy]`; nessun workflow di
pubblicazione avviato. Collaudo Safari fisico ancora da effettuare.
