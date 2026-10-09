/* Regional travel catalogue. Test routes only: no new geography or racial effects. */
const TravelData = (() => {
  const routes = [
    {id:'test-veyra-path', originId:'veyra', destinationId:'broken-path', durationMs:90000,
      name:'Rotta di prova · Sentiero Spezzato', description:'Prova tecnica di viaggio regionale. Nessun premio.',
      testOnly:true, environment:'land', baseDurationMs:90000, available:true,
      environmentRequirements:{capabilities:[],tools:[],assistance:[]}, requirements:{minimumLevel:1}},
    {id:'test-path-veyra', originId:'broken-path', destinationId:'veyra', durationMs:120000,
      name:'Rotta di prova · Ritorno a Veyra', description:'Prova tecnica di ritorno. Nessun premio.',
      testOnly:true, environment:'coastal', baseDurationMs:120000, available:true,
      environmentRequirements:{capabilities:[],tools:[],assistance:[]}, requirements:{minimumLevel:1}},
  ];
  return {version:1, maxDurationMs:604800000, routes, get:id=>routes.find(r=>r.id===id)};
})();
if (typeof module !== 'undefined' && module.exports) module.exports=TravelData;
