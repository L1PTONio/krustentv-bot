(async function(){
  const files = ['index.js','categories.js','youtube.js','w2g_push.js','w2g_history.js','queue_builder.js','interaction_utils.js','scripts/w2g_probe.js'];
  for (const f of files) {
    try {
      console.log('Importing', f);
      await import(`file://${process.cwd().replace(/\\/g,'/')}/${f}`);
      console.log('OK:', f);
    } catch (e) {
      console.error('ERROR importing', f, e && e.stack ? e.stack : e);
    }
  }
})();