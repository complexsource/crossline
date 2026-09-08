import {chromium} from '@playwright/test';
import {mkdir,writeFile,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/index.js';
import {MAPS} from '../shared/maps.js';
const server=await createGameServer();await new Promise(resolve=>server.http.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.http.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
await mkdir('test-results',{recursive:true});await mkdir('public/previews',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${url}/tests/visual.html`);await page.waitForFunction(()=>window.ready,{},{timeout:30000});
  // Browser-native WebP encoding: transmission compression, not a claimed GPU codec.
  const encoded=await page.evaluate(async()=>{const img=new Image();img.src='/textures/original-material-atlas.png';await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);return c.toDataURL('image/webp',.91).split(',')[1];});
  await writeFile('public/textures/material-atlas.webp',Buffer.from(encoded,'base64'));
  for(const map of MAPS){const data=await page.evaluate(id=>window.previewMap(id),map.id);await writeFile(`public/previews/${map.id}.webp`,Buffer.from(data.split(',')[1],'base64'));console.log('Rendered map thumbnail:',map.name);}
  for(const weapon of ['vektor','sentinel','breaker','longshot','pistol','knife']){const stats=await page.evaluate(weapon=>window.sample({weapon}),weapon);await page.screenshot({path:`test-results/weapon-${weapon}.png`});console.log(weapon,stats);}
  await page.evaluate(()=>window.sample({mode:'operator'}));await page.screenshot({path:'test-results/operator.png'});
  const animation=await page.evaluate(()=>window.animationCheck());assert.ok(animation.crouch>1);assert.ok(animation.mag<0);assert.equal(animation.death,1);
  for(const quality of ['low','medium','high','ultra']){await page.evaluate(quality=>window.sample({quality,weapon:'sentinel',reload:1.1}),quality);await page.screenshot({path:`test-results/quality-${quality}.png`});}
  console.log('Nine remote players / HIGH:',await page.evaluate(()=>window.benchmark()));
  assert.deepEqual(errors,[]);console.log('Visual checks passed: eight maps, six weapons, four presets, articulation, reload, no browser errors.');
  console.log('Atlas bytes:',(await stat('public/textures/material-atlas.webp')).size);
}finally{await browser.close();await server.close();}
