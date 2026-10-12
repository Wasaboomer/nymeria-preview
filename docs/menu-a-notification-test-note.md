# Menu A — test storico delle notifiche

`tests/notifications-browser.cjs` non appartiene alla lista browser del runner globale corrente. Esegue il browser con orologio Playwright installato e sospeso, poi naviga fra tab e ricompense.

Nella verifica della rimozione del titolo fallisce a `notifications-browser.cjs:24`, tramite `mobile-navigation-fixture.cjs`: timeout sul tap di `#tab-inventory`, che risulta fuori viewport. Lo stesso errore è stato riprodotto servendo i file originali di HEAD c5f7b306702d76bf8ba0951be63e245d4a0874ea, senza cambiare test o working tree. Non è stata dimostrata la causa interna; resta un problema preesistente di layout/automazione da analizzare separatamente.

Il completamento Menu A confronta nuovamente la medesima suite con HEAD originale. Non corregge né forza il tap, non modifica timer o test per aggirare il fallimento. Il test si arresta al timeout, quindi gli scenari successivi non sono considerati verificati.

La navigazione corrente viene verificata separatamente senza orologio sospeso da `menu-phase1-browser.cjs`, con tocchi sulle coordinate, ritorno/focus/scorrimento, storage invariato e controlli durante gli incontri. La nota non equivale a dichiarare verde la suite storica o a certificare Safari fisico.

Esito locale Menu A: `menu-phase1-browser.cjs` e `torre-silente-v1-browser.cjs` superati. La suite notifiche corrente e la baseline HEAD originale falliscono entrambe sul medesimo `locator('#tab-inventory')`, con elemento fuori viewport, a `notifications-browser.cjs:24:4`. Non sono stati rilevati fallimenti diversi prima di questo punto; gli scenari successivi restano non verificati. Build web riuscita. Nessun commit/push/deploy eseguito.
