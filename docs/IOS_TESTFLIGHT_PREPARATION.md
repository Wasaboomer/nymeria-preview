# NYMERIA — percorso verso il primo test su iPhone

Questa è una guida preparatoria. Non sono configurati firma, upload, account o
segreti; i workflow attuali non distribuiscono su TestFlight o sugli store.
Consultare prima [visione permanente](NYMERIA_PROJECT_VISION.md).

## Decisioni e operazioni del proprietario (anche da Safari su iPhone)

1. Iscrivere l'account al [programma Apple Developer](https://developer.apple.com/programs/enroll/).
   Occorrono Apple Account con autenticazione a due fattori, verifica dell'identità
   e accettazione degli accordi; le organizzazioni hanno requisiti aggiuntivi.
   L'iscrizione standard costa **99 USD/anno**, con prezzo locale e possibili
   esenzioni da verificare sul portale Apple. Nessun pagamento è autorizzato qui.
2. In Developer → Certificates, Identifiers & Profiles → Identifiers, registrare
   il Bundle ID definitivo e confermare la proprietà del Team. `com.nymeria.game`
   è soltanto provvisorio: cambiarlo dopo l'installazione può creare un'app/sandbox
   diversa e non trasferisce i salvataggi. Il proprietario deve decidere l'ID prima
   della prima distribuzione firmata.
3. In [App Store Connect](https://appstoreconnect.apple.com/) → My Apps → “+” →
   New App, creare il record iOS usando quell'ID, nome, lingua e SKU scelti dal
   proprietario. Accettare eventuali accordi richiesti e confermare i permessi.
4. Preparare un certificato **Apple Distribution con relativa chiave privata**
   e un provisioning profile App Store Connect per lo stesso Team/Bundle ID.
   Un certificato `.cer` o un profile da solo non basta: il runner deve poter
   firmare con la chiave privata, normalmente importata come `.p12` protetto.
5. App Store Connect → Users and Access → Integrations/App Store Connect API:
   un amministratore autorizzato può creare una chiave con il ruolo strettamente
   necessario alla futura automazione. Annotare Key ID e Issuer ID e custodire
   il `.p8`, scaricabile una sola volta. La chiave API per l'upload **non sostituisce
   la chiave privata del certificato di firma**.

Safari/iPhone può gestire iscrizione, portali, approvazioni, segreti GitHub e test.
Generare un CSR e esportare un `.p12` non è un'operazione nativa di quei portali:
può richiedere una configurazione iniziale su un Mac affidabile/da un tecnico,
oppure una futura procedura CI sicura espressamente autorizzata. Non imporre
l'uso quotidiano di un computer, ma non fingere che Safari esporti la chiave.
Non inviare password, certificati, `.p8` o chiavi private nella conversazione.

## Futura automazione GitHub — non implementata

Nel repository → Settings → Environments creare un ambiente dedicato alla
distribuzione, limitato al branch autorizzato e con approvazione del proprietario
quando disponibile. In Environment secrets inserire tramite l'interfaccia sicura:

| Nome previsto | Contenuto / scopo |
| --- | --- |
| `IOS_DISTRIBUTION_P12_BASE64` | Certificato **e chiave privata** esportati in p12 |
| `IOS_DISTRIBUTION_P12_PASSWORD` | Password del p12 |
| `IOS_PROFILE_BASE64` | Provisioning profile valido per Team/Bundle ID |
| `ASC_API_PRIVATE_KEY` | File p8 dell'API App Store Connect |
| `ASC_API_KEY_ID` / `ASC_API_ISSUER_ID` | Identificativi dell'API |

Team ID, Bundle ID e nomi del profile sono configurazione, non password.
Base64 è una codifica, **non cifratura**: il contenuto deve restare nei Secrets.
Non conservarlo nel repository, in artifact, screenshot o log. I job di test,
le PR e i fork non devono ricevere credenziali di distribuzione.

Un futuro workflow manuale autorizzato potrà fare npm ci → packaging locale →
cap sync → regressioni → archive iPhoneOS su macOS → export IPA firmata → upload
autenticato App Store Connect. Userà un keychain temporaneo, cleanup anche in
caso di errore, nessuna stampa delle chiavi e numero di build univoco. Una `.app`
per simulatore compilata senza firma non può essere trasformata direttamente in
un'IPA per iPhone: occorre compilare nuovamente per dispositivo e firmare.
Non attivare automaticamente distribuzioni ad ogni push DEV.

## Prima installazione TestFlight

Dopo upload e processing Apple: App Store Connect → app → TestFlight → scegliere
la build; compilare le informazioni richieste (compresa export compliance in base
al comportamento reale dell'app), assegnare un gruppo di tester e autorizzare
l'invio. I tester esterni possono richiedere Beta App Review; non promettere tempi.
Il proprietario installa [TestFlight](https://developer.apple.com/testflight/) su
iPhone e apre l'invito. Non occorre registrare l'UDID per TestFlight. Per sviluppo
locale/ad hoc i requisiti di firma/device/profile sono differenti.

TestFlight non equivale a una release App Store. I passaggi di iscrizione, accordi,
identità, ruoli, privacy/export compliance e approvazione della distribuzione
restano responsabilità del proprietario. Consultare la
[guida TestFlight Apple](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).

## Checklist prima di autorizzare una distribuzione

- Confermare Team/Bundle ID, certificato/profile e configurazione dei Secrets.
- Verificare la build per dispositivo, firma e provisioning effettivi.
- Sostituire in uno sprint autorizzato icone/splash template con branding approvato.
- Verificare fisicamente safe area/Dynamic Island, tastiera, touch e combat HUD.
- Verificare avvio offline, background, chiusura forzata e aggiornamento conservando
  dati locali. Nessuna promessa di persistenza dopo disinstallazione.
- Conservare origine nativa/Bundle ID; i salvataggi della preview Safari restano
  separati e non vengono importati automaticamente nell'app.
- Fornire istruzioni al tester, note della build e canale per i crash.

Le normali build e gli smoke test attuali usano runner standard GitHub per questo
repository pubblico; non è stato aggiunto alcun servizio a pagamento. Verificare
billing/limiti dell'account prima di scegliere runner più grandi o rendere privato
il repository.
