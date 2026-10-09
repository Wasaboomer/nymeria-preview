import { App } from '@capacitor/app';
import { handleBack } from './back-controller.cjs';
import { pauseExistingCombats } from './lifecycle-controller.cjs';
// WebView document.hidden is not a reliable native activity lifecycle signal.
App.addListener('appStateChange',({isActive})=>{
  if (isActive !== false) return;
  try {
    pauseExistingCombats({document,
      worldEngine:typeof WorldUI==='undefined'?null:WorldUI.engine,
      combatEngine:typeof CombatUI==='undefined'?null:CombatUI.engine});
  } catch (error) { console.error('Native background pause failed',error); }
}).catch(error=>console.error('Native lifecycle registration failed',error));
// The existing App plugin also handles Android Back; no additional plugin needed.
if (window.Capacitor?.getPlatform()==='android') {
  App.addListener('backButton',()=>{
    try {
      handleBack({document,navigation:window.NymeriaNavigation,
        minimize:()=>{App.minimizeApp().catch(error=>console.error('Native minimize failed',error));}});
    } catch (error) { console.error('Native Back failed',error); }
  }).catch(error=>console.error('Native Back registration failed',error));
}
