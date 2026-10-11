// Test-only kit registration. No new production class, abilities or specialization.
module.exports = `
  ClassesData.classes.warden.specializationIds = [...ClassesData.classes.warden.buildIds, 'fixture-2h'];
  ClassesData.specializations['fixture-2h'] = CombatData.copy(ClassesData.specializations.bulwark);
  Object.assign(ClassesData.specializations['fixture-2h'], {
    id: 'fixture-2h', name: 'Kit 2H TEST', legacyBuildId: null,
    requirements: {weaponTypes:['greatsword','spear','greataxe','warhammer'], handedness:'2H',
      supportTypes:[], supportPolicy:'forbidden', label:'Arma a due mani senza supporto'}
  });
`;
