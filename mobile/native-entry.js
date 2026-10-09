import { App } from '@capacitor/app';
import { handleBack } from './back-controller.cjs';
import { pauseExistingCombats } from './lifecycle-controller.cjs';
const registrations=[];
// Native activity state is separate from document visibility.
registrations.push(App.addListener('appStateChange',({isActive})=>{
  if (isActive !== false) return;
  try {
    pauseExistingCombats({document,
      worldEngine:typeof WorldUI==='undefined'?null:WorldUI.engine,
      combatEngine:typeof CombatUI==='undefined'?null:CombatUI.engine});
  } catch (error) { console.error('Native background pause failed',error); }
}));
// The existing App plugin also handles Android Back; no additional plugin needed.
if (window.Capacitor?.getPlatform()==='android') {
  registrations.push(App.addListener('backButton',()=>{
    try {
      handleBack({document,navigation:window.NymeriaNavigation,
        minimize:()=>{App.minimizeApp().catch(error=>console.error('Native minimize failed',error));}});
    } catch (error) { console.error('Native Back failed',error); }
  }));
}

// Native-only readiness: asset readiness does not acknowledge plugin listeners.
window.NymeriaNativeReady=Promise.all(registrations).then(async()=>{
  // getState is a native round-trip after listener calls on the plugin queue.
  await App.getState();
  return true;
});
window.NymeriaNativeReady.catch(error=>console.error("Native adapter registration failed",error));
