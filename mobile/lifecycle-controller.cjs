/* Interactive arena is paused; automatic World activity stops rendering only. */
function pauseExistingCombats({document, worldUI, combatEngine}) {
  worldUI?.suspend();
  if (combatEngine?.status !== 'running') return;
  const button = document.getElementById('combat-pause');
  if (button && !button.disabled) button.click();
}
module.exports = {pauseExistingCombats};
