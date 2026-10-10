# Sprint 2.8.2 — consolidamento UX mobile

Le modifiche sono soltanto presentazione: nessuna modifica a motori, dati di gioco,
formato dei salvataggi, ricompense, professioni o Paper Doll.

- Indietro elimina dalla propria destinazione le entry che rappresentano già la
  schermata corrente. La cronologia rimane interna all'app, senza browser history.
- Le notifiche usano lo stesso servizio, queue e dismiss. Occupano spazio misurato
  nel contenitore verticale invece di coprire navigazione e azioni. Nei dialoghi
  restano dentro il dialogo e il budget della paginazione ne considera l'altezza.
  Dettagli molto lunghi possono scorrere nel banner; chiusura touch sempre disponibile.
- I pager con una sola pagina scompaiono e restituiscono spazio al pannello.
- Vittoria legge il progresso degli obiettivi reali active/completed che riguardano
  il nemico o i campioni realmente ottenuti. Nessun contatore o reward aggiuntivo.
- Incontri indica «Missione» quando il prossimo obiettivo richiede un nemico locale.
  Non si aggiungono incontri o attività. La voce vuota sui drop viene omessa.
- Incarico/committente e luogo dell'obiettivo sono distinti; una missione completa
  indica la riscossione dal Diario, senza introdurre consegne o viaggi obbligatori.

## Audit app iOS/Android

| Aspetto | Esito e limiti |
| --- | --- |
| Touch e verticale | Controlli esistenti conservati; dismiss almeno 44 px; test 320/375/390/430. |
| Safe area | Shell mantiene env(safe-area-inset-top/bottom); banner in-flow dentro la shell. Test degli inset simulati, non certificazione notch/Dynamic Island. |
| Altezza e tastiera | Budget usa visualViewport con fallback innerHeight e shell dinamica. Layout provato con altezze ridotte; IME e keyboard native richiedono dispositivo. |
| Navigazione | Stack app interno; nessun nuovo requisito di history API, URL o pulsante Back del browser. Hardware Back Android richiede collaudo del contenitore già esistente. |
| Browser/native | DOM/SVG e layout esistenti; nessuna nuova dipendenza Safari. Il pacchetto mobile esistente non viene migrato o riscritto. |
| Distribuzione store | Nessun nuovo impedimento introdotto dalla UX. Build native, signing, privacy, backend autorevole e review store restano verifiche separate; build web non ne dimostra la prontezza. |

Il sistema locale non è autorevole rispetto a modifiche di orologio/salvataggi:
limite preesistente importante per il multiplayer, da risolvere con backend e non
con un refactoring UX. Nessun cambiamento in questo sprint.

## Verifica

La nuova suite percorre mq04 → mq05 → sblocco Torre con claim e combattimenti
reali, consulta la corazza senza equipaggiarla automaticamente, verifica progressi
1/3, 2/3, 3/3, comandante, persistenza, riscossione unica, layout/banner e touch.
Le fixture sono isolate e non toccano i salvataggi dell'utente.
Il risultato dell'intera suite e build viene riportato solo dopo l'esecuzione.

Safari/iPhone e Android fisici non verificati: da collaudare separatamente.
Nessun deploy manuale o modifica ai workflow.

Risultati effettivi:

- Nuova suite isolata: 4/4 larghezze passate.
- Suite feedback isolata: 4/4 larghezze passate, fino a 375 px di altezza.
- Prima suite completa: 41 passate, 1 fallita per la frase attesa nel test
  mobile-polish-engine. Corretta la formulazione UI senza cambiare il test.
- Nuova suite completa `npm test`: **42 passate, 0 fallite, exit 0**;
  build web di produzione riuscita. Include le regressioni dei sistemi precedenti.

Il limite del salvataggio locale ha gravità alta per una futura economia multiplayer;
la proposta è validazione/transazioni lato backend autorevole. Non blocca il
collaudo di questo prototipo UX e non viene affrontato in questo sprint.
