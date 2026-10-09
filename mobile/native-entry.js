import { App } from '@capacitor/app';
import { handleBack } from './back-controller.cjs';
// App plugin is needed solely for Android Back; no storage/network/account plugins.
if (window.Capacitor?.getPlatform()==='android') {
  App.addListener('backButton',()=>{
    try {
      handleBack({document,navigation:window.NymeriaNavigation,
        minimize:()=>{App.minimizeApp().catch(error=>console.error('Native minimize failed',error));}});
    } catch (error) { console.error('Native Back failed',error); }
  }).catch(error=>console.error('Native Back registration failed',error));
}
