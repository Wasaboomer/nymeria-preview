import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
await build({entryPoints:[root+'public/client.mjs'],bundle:true,platform:'browser',format:'esm',target:['safari15','chrome100'],outfile:root+'.generated/client.js',plugins:[{name:'lab-memory-only-sdk-storage',setup(plugin){plugin.onResolve({filter:/^\.\/Storage\.mjs$/},args=>args.importer.includes('/@colyseus/sdk/')?{path:root+'public/memory-storage.mjs'}:undefined)}}]});
