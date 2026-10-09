/* Native background uses the existing Pause controls, never rewards or auto-resume. */
function pauseExistingCombats({document, worldEngine, combatEngine}) {
  for (const [engine,id] of [[worldEngine,'world-battle-pause'],[combatEngine,'combat-pause']]) {
    if (engine?.status !== 'running') continue;
    const button = document.getElementById(id);
    if (button && !button.disabled) button.click();
  }
}
module.exports = {pauseExistingCombats};
