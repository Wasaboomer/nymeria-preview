/* Native Back changes UI context only; existing game controls own combat exit. */
function handleBack({document,navigation,minimize}) {
  const dialogs=document.querySelectorAll('dialog[open]');
  if (dialogs.length) { dialogs[dialogs.length-1].close(); return 'dialog'; }
  const back=document.getElementById('navigation-back');
  if (back && back.disabled) {
    const abandon=document.getElementById('world-battle-abandon');
    if (abandon && !abandon.disabled) abandon.click();
    return 'combat-confirmation';
  }
  if (navigation.depth>0) { navigation.back(); return 'context'; }
  minimize(); return 'background';
}
module.exports={handleBack};
