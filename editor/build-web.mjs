import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// Keep the upstream build and its verification gates. Serialize phase jobs
// rather than running ten webpack instances on a small Railway builder.
const file='scripts/build-pipeline.js';
const source=readFileSync(file,'utf8'),needle='const running = taskSpecs.map(runTask);';
if(!source.includes(needle))throw Error('Pinned Euro-Office pipeline changed; review scheduling patch.');
writeFileSync(file,source.replace(needle,`const running = [];
    for (const spec of taskSpecs) {
        const current = runTask(spec);
        running.push(current);
        const result = await current.promise;
        if (result.code !== 0) process.exit(1);
    }`));
const result=spawnSync(process.execPath,['scripts/build-pipeline.js'],{stdio:'inherit',env:process.env});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status??1);
const final=spawnSync(process.execPath,['/tmp/finalize-interface.mjs',process.env.BUILD_ROOT||'/out','/tmp/brand'],{stdio:'inherit'});
if(final.error)throw final.error;
process.exit(final.status??1);
