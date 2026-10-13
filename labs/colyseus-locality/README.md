# Località Colyseus — laboratorio separato

Esperimento locale, non integrazione NYMERIA. Due connessioni reali condividono una sola località testuale. Nessun renderer, account reale, database, combattimento, premio, gilda o gruppo.

## Avvio e arresto

Prerequisiti: Node >=22 e npm. Verificato con Node 24.19.0.

Dalla radice del repository:

```sh
cd labs/colyseus-locality
npm ci --ignore-scripts
npm start
```

Aprire `http://127.0.0.1:8036/` in due schede e premere **Entra** in ciascuna. Il server assegna due identità ospite diverse. Inviare un messaggio, premere **Esci**, oppure **Prova disconnessione** e poi **Riconnetti** entro 8 secondi. Un terzo ospite contemporaneo è rifiutato.

Arresto: `Ctrl+C` nel terminale del server; il processo chiude le connessioni e la località. `LAB_PORT=8037 npm start` cambia soltanto la porta del laboratorio. Il bind resta 127.0.0.1: questa non è una preview pubblica né un URL raggiungibile direttamente dall'iPhone. Nessun deploy configurato.

## Test

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm test
```

Nell'ambiente di sviluppo con Chromium di sistema:

```sh
NYMERIA_CHROMIUM=/usr/bin/chromium npm test
```

I test avviano server su porte libere, li chiudono nel cleanup e non usano la porta 8018 di NYMERIA. Due scenari automatici:

1. Client SDK reali: ticket monouso, identità/ID contraffatti rifiutati, una sola località, massimo due ospiti, chat bidirezionale, input invalidi/canali non autorizzati, tre messaggi in due secondi, rate limit conservato durante riconnessione, identità conservata, uscita e token scaduto. Il server dei test riduce la finestra di riconnessione a un secondo; il server avviato normalmente usa otto secondi.
2. Due pagine Chromium reali a 390×844: ingresso/presenza, invio dal form, HTML visualizzato letteralmente senza esecuzione, drop/riconnessione, uscita. Tutti i metodi Storage sono bloccati e contati: zero accessi; nessun pageerror o Promise rejection non gestita. Nessun collaudo Safari/iPhone fisico dichiarato.

I messaggi diagnostici Colyseus relativi ad autenticazioni e riconnessioni rifiutate sono attesi nelle prove negative. Non indicano il successo di una richiesta rifiutata.

## Protocollo e confini

- `/api/ticket` emette un ospite fittizio, con nome e ID generati dal server. Il client non può scegliere nome, ID o ruolo. Ticket casuale, monouso e valido per 60 secondi; massimo 32 ticket pendenti. L'endpoint è volutamente aperto per prove locali: non è autenticazione di produzione.
- Il server autorizza il solo canale `localita-di-prova`, identifica l'autore dalla sessione e accetta soltanto `text`/`channel`. Testo non vuoto, massimo 200 caratteri UTF-16, senza caratteri di controllo. Le stringhe HTML restano testo nel DOM.
- Presenza deriva dalle connessioni effettive. Durante un drop l'ospite è segnato offline con posto riservato; la riconnessione mantiene identità e finestra di rate limit. Dopo scadenza il server rimuove l'ospite. Dopo reload della pagina serve una nuova identità: i token non sono salvati.
- History massima 20 messaggi, solo in memoria. Shutdown/restart eliminano history, ticket e prenotazioni. Nessuna promessa di persistenza offline o di recupero dopo riavvio del server.
- Il rate limit è per ospite in memoria. Ottenere una nuova identità permette di ripartire: prima della produzione servono autenticazione reale, limiti per account/IP, autorizzazioni, TLS, moderazione e monitoraggio.

## Dipendenze e licenze

Versioni fissate nel package e nel lockfile:

| Dipendenza | Versione | Licenza dichiarata |
|---|---|---|
| @colyseus/core | 0.18.18 | MIT |
| @colyseus/ws-transport | 0.18.4 | MIT |
| @colyseus/sdk | 0.18.5 | MIT |
| esbuild (sviluppo) | 0.25.12 | MIT |
| playwright (test) | 1.58.2 | Apache-2.0 |

`THIRD_PARTY.json` registra nomi/versioni/licenze dei 125 record di dipendenze nel lockfile, incluse le varianti opzionali di piattaforma: MIT, Apache-2.0, ISC, BSD-3-Clause e 0BSD. Non sono 125 pacchetti necessariamente installati sul sistema. Conservare licenze e notifiche applicabili quando si distribuiscono pacchetti/bundle; questo inventario non sostituisce un audit legale o delle vulnerabilità. Nessun asset artistico esterno introdotto.

## Accesso implicito dell'SDK allo storage

Client/Auth dell'SDK inizializza `colyseus-auth-token` anche per ospiti. Per rispettare l'isolamento il build del laboratorio sostituisce **solo** l'import interno SDK `Storage.mjs` con `public/memory-storage.mjs`. Nessun file node_modules viene modificato e nessun oggetto Storage globale viene sostituito dal prodotto; il blocco globale esiste soltanto nei test. Questa dipendenza da un percorso interno è intenzionalmente fissata alla versione 0.18.5 e va rivalidata ad ogni aggiornamento. Non è una caratteristica standard di Colyseus né una soluzione definitiva per account reali.

## Isolamento e ripristino

Il package e node_modules sono separati da quelli di NYMERIA. `.generated/` e node_modules sono ignorati; nessun import da index.html, script di gioco o test runner ordinario. La build principale copia solo file JS/CSS di radice, assets e vendor: non include labs. Verificato rigenerando la build principale e controllando l'assenza di www/labs e di diff nei file tracciati del gioco.

Per eliminare l'esperimento: arrestare il server e rimuovere questa sola cartella. Non esistono migrazioni, chiavi nei salvataggi o servizi esterni da ripristinare.

## Esito e integrazione futura

Node/core/transport/SDK si avviano e comunicano realmente nelle versioni fissate. I due scenari finali sono superati. I difetti locali di bootstrap, serving del bundle, cleanup di socket disconnessi e storage implicito SDK emersi durante lo sviluppo sono stati corretti senza toccare NYMERIA.

Prima di integrare: audit della dipendenza di storage privata, scelta dell'identità/account, mapping delle località e diritti di accesso, reconnect mobile/Safari, persistenza autorevole e idempotenza delle attività offline. Una stanza online non sostituisce quel backend. La prima consegna era locale; il successivo consolidamento è limitato al laboratorio e non autorizza deploy o integrazione nel gameplay.

## Validazione per il consolidamento DEV

- Confermati 11 file soltanto in questa cartella, senza file generati, segreti, credenziali reali o dati personali rilevati.
- `npm ci --ignore-scripts` ripetuto: lockfile e inventario dei 125 record rimangono identici; tutte le dipendenze hanno checksum e licenza dichiarata.
- Build dedicata e due scenari automatici superati, 0 falliti. Nessun accesso allo storage browser.
- Build principale riuscita; 6 suite pertinenti superate (mobile foundation engine/browser, capacità, ampliamenti, professioni e incontri). Nessun import del laboratorio o cartella www/labs. Suite globale completa non rieseguita in questo consolidamento isolato.
- Commit/push autorizzati soltanto su DEV con `[skip dev deploy]`. Nessun file tracciato di NYMERIA o dipendenza principale modificato.
- Ticket, presenza, chat e rate limit restano in memoria; laboratorio non adatto alla produzione. Adapter privato dell'SDK da rivalidare aggiornando dipendenze; Safari/iPhone fisico non verificato.
