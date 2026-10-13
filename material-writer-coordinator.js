/* One participating browser writer per origin. No retries and no multi-record atomicity. */
const MaterialWriterCoordinator = (() => {
  let owned=false, release=null, pending=Promise.resolve(), epoch=0, suspended=false, executing=0, invoking=0;
  const failure=message=>({ok:false,message});
  const acquisitions=new Set();
  function suspend(){epoch++;suspended=true;owned=false;for(const controller of acquisitions)controller.abort();if(release)release();}
  if(typeof window!=='undefined') {
    window.addEventListener('pagehide',suspend);
    window.addEventListener('pageshow',()=>{suspended=false;});
  }
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')suspend();else suspended=false;
  });
  // A pending callback is not evidence that the current caller is recursive.
  // Track only the synchronous invocation stack; unrelated tasks must queue.
  function call(operation) { invoking++; try { return operation(); } finally { invoking--; } }
  async function invoke(operation) { executing++; try { return await call(operation); } finally { executing--; } }
  function run(operation, queueTimeoutMs = 5000) {
    if(invoking>0)return Promise.resolve({ok:false,code:'nested-coordination-rejected',message:'Acquisizione ricorsiva rifiutata: nessuna modifica applicata.'});
    const requestEpoch=epoch;
    let expired=false, started=false, resolveTimeout;
    const timedOut=new Promise(resolve=>resolveTimeout=resolve);
    const queueTimer=setTimeout(()=>{
      if(!started){expired=true;resolveTimeout(failure('Richiesta scaduta in coda: nessuna mutazione avviata.'));}
    },queueTimeoutMs);
    const result=pending.then(async()=>{
      started=true;clearTimeout(queueTimer);
      if(suspended || requestEpoch!==epoch || (typeof document!=='undefined' && document.visibilityState==='hidden'))return failure('Pagina sospesa: richiesta annullata, nessuna mutazione avviata.');
      if(expired)return failure('Richiesta scaduta: nessuna mutazione avviata.');
      if(typeof navigator==='undefined'||!navigator.locks)return failure('Scritture sospese: sincronizzazione sicura fra schede non disponibile.');
      if(owned)return invoke(operation);
      return new Promise(resolve=>{
        navigator.locks.request('nymeria-material-writer',{ifAvailable:true},async lock=>{
          if(!lock){resolve(failure('Materiali gestiti in un’altra scheda: chiudila o mettila in background e riprova.'));return;}
          owned=true;const lifetime=new Promise(done=>release=done);
          try {
            await new Promise(done=>setTimeout(done,0));
            resolve(owned&&!suspended&&requestEpoch===epoch?await invoke(operation):failure('Scheda sospesa: nessuna operazione applicata.'));
            await lifetime;
          } catch {resolve(failure('Operazione non confermata: rileggi lo stato prima di riprovare.'));}
          finally {owned=false;release=null;}
        }).catch(()=>resolve(failure('Coordinamento non disponibile: nessuna scrittura avviata.')));
      });
    }).catch(()=>failure('Operazione non confermata: rileggi lo stato prima di riprovare.'));
    pending=result.then(()=>undefined);
    // Timeout returns early only while queued; the expired task checks before calling the mutator.
    return Promise.race([result,timedOut]);
  }
  async function progression(operation, timeoutMs = 5000) {
    if(typeof navigator==='undefined'||!navigator.locks)return failure('Sincronizzazione sicura non disponibile.');
    const requestEpoch=epoch;
    const controller=new AbortController();acquisitions.add(controller);
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try { return await navigator.locks.request('nymeria-progression',{signal:controller.signal},()=>{
      if(suspended || requestEpoch!==epoch)return failure('Pagina sospesa: operazione annullata prima della scrittura.');
      return call(operation);
    }); }
    catch { return failure('Accesso al salvataggio scaduto o rifiutato: rileggi e riprova.'); }
    finally {clearTimeout(timer);acquisitions.delete(controller);}
  }
  return {run,progression,isCoordinated:()=>owned && !suspended && executing > 0,isInvoking:()=>invoking>0};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=MaterialWriterCoordinator;
