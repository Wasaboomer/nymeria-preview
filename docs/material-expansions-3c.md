# Fase 3C — metadati coordinati, gameplay inattivo

Le mutazioni browser di MaterialBagStore (`initialize`, `grantExpansion`) usano per default il MaterialWriterCoordinator comune: lease `nymeria-material-writer`, coda comune, lock breve `nymeria-progression`, rilettura dei metadati, una sola scrittura. Non acquisiscono il vecchio lock separato dei metadati. Il caricamento del modulo e `read()` non inizializzano nulla.

La Fase 3B continua a leggere i metadati nella callback già coordinata tramite `readMetadata`. Non deve chiamare initialize o grantExpansion dentro un'operazione materiali. Una mutazione ricorsiva viene rifiutata con `nested-coordination-rejected`, senza entrare in coda e senza scrivere. Per conservazione, anche una richiesta esterna durante una callback asincrona già attiva può essere rifiutata: richiede retry esplicito dopo la conclusione, non un retry interno. Questa politica evita di dichiarare reentrancy o recupero automatico che non esistono.

Gli ID delle concessioni, la capacità 40/+10/100 e lo schema v1 rimangono invariati. Concessioni ripetute non aggiungono slot; richieste accodate rileggono l'elenco aggiornato. Scrittura rifiutata o record corrotto/futuro mantengono i byte originali. La modifica non scrive quantità, progressione, equipaggiamento o altri record legacy.

`withMaterialWriter(common)` permette di usare lo stesso adapter nei factory di test. Il default Node e createCoordinator restano helper locali compatibili con i test delle Fasi 1–2: non garantiscono coordinamento fra processi né con motori non partecipanti. Le integrazioni Node devono iniettare lo stesso coordinatore per materiali e metadati. Un adapter iniettato arbitrariamente o un vecchio client non partecipante non può essere reso sicuro dal protocollo browser.

Due schede: soltanto la proprietaria può scrivere; l'altra riceve il rifiuto già previsto dal coordinatore. Pagehide/visibilitychange rilasciano la lease secondo il protocollo esistente; non viene forzato alcun takeover. Senza Web Locks o senza il coordinatore comune le mutazioni browser vengono rifiutate. Nessuna nuova transazione multi-registro o journal.

La capacità non è attivata nel gameplay: index.html non carica ancora MaterialBagStore o il validatore, nessuna UI/missione concede ampliamenti e non esiste un flag persistente/URL di attivazione. Restano il recupero multi-registro di Bram e il collegamento autorizzato dei singleton, oltre al collaudo fisico Safari/iPhone. Le concessioni dei test sono fixture, non nuove fonti di ricompensa.

## Verifiche locali preliminari

- 34 suite engine superate, inclusi ampliamenti sotto coordinamento comune, metadati legacy, capacità, sicurezza e 90.000 snapshot legacy identici.
- 5 suite browser pertinenti superate: ampliamenti, capacità, sicurezza materiali, professioni e ricompense pendenti. Nuovi casi a 320/375/390/430 px; due schede, reload, quota, versioni future, nested refusal e assenza Web Locks.
- Primo gruppo: 38 suite superate e 1 fallita per un monitor di rejection installato soltanto nella prima scheda della nuova fixture. Installazione spostata sul contesto condiviso e nuova suite ripetuta integralmente, exit 0. Nessuna modifica a runtime, timeout o aspettative per risolvere quel difetto.
- Build riuscita, diff check pulito. Suite globale browser e Safari/iPhone fisico non eseguiti. Nessun commit, push o deploy.

## Validazione finale per il consolidamento

- Suite globale `npm test`: 66 suite superate, 0 fallite (34 engine e 32 browser del runner); 90.000 snapshot legacy identici.
- Build rigenerata e 16 suite pertinenti ripetute dopo la generazione degli asset: 10 engine e 6 browser, tutte superate, incluse sicurezza materiali e Torre Silente.
- Modello 40/+10/100, duplicate grants, richieste concorrenti, reload, storage rifiutato, versioni future, rifiuto delle acquisizioni ricorsive e conservazione dei salvataggi verificati. Nessuna regressione rilevata nel gruppo globale o nei controlli successivi.
- Nessuna attivazione via URL/salvataggio/UI: modulo ancora assente dal caricamento del gameplay; nessuna fonte di ampliamenti o hook di capacità nei singleton. Restano recupero multi-registro di Bram, collegamento autorizzato dei singleton e Safari/iPhone fisico.
- Consolidamento autorizzato soltanto su DEV con `[skip dev deploy]`, senza merge o pubblicazione.
