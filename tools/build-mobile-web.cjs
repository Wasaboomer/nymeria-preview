/* Package existing local web assets. No transformation of game code, artwork or saves. */
const fs=require('node:fs/promises'),path=require('node:path'),{build}=require('esbuild');
const root=path.resolve(__dirname,'..'),out=path.join(root,'www');
(async()=>{
 await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
 const entries=await fs.readdir(root);
 for(const name of entries.filter(name=>name.endsWith('.js')||name.endsWith('.css')||name==='index.html'))await fs.copyFile(path.join(root,name),path.join(out,name));
 // Root JS/CSS include isolated debug adapters. Their local assets must also resolve offline.
 for(const directory of ['assets','vendor'])await fs.cp(path.join(root,directory),path.join(out,directory),{recursive:true});
 await build({entryPoints:[path.join(root,'mobile/native-entry.js')],bundle:true,format:'iife',platform:'browser',target:['safari15','chrome89'],outfile:path.join(out,'native-bridge.js'),minify:true});
 const html=await fs.readFile(path.join(out,'index.html'),'utf8');
 if (/https?:\/\/[^"\s]+\.(?:js|css)/.test(html))throw new Error('Remote runtime dependency in entry point');
 if (!html.includes('native-bootstrap.js'))throw new Error('Missing native bootstrap');
 console.log('Packaged local entry, JS/CSS and assets in www; no remote server.url.');
})().catch(error=>{console.error(error);process.exitCode=1;});
