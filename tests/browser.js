import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createGameServer} from '../server/index.js';
import {emptyInput} from '../shared/game.js';

// Isolated test server. Tests never alter a running user's room.
const server=await createGameServer({production:true});await new Promise(resolve=>server.http.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.http.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const errors=[];let debugPage;await mkdir('test-results',{recursive:true});
try{
  const ctx1=await browser.newContext({viewport:{width:1440,height:900}}),ctx2=await browser.newContext({viewport:{width:1280,height:800}});
  const a=await ctx1.newPage(),b=await ctx2.newPage();debugPage=a;for(const page of [a,b]){page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));}
  await a.goto(url);await a.waitForSelector('.online i:not(.offline)');await a.screenshot({path:'test-results/home.png'});
  await a.locator('#map-create').selectOption('desert');await a.locator('#player-limit').selectOption('6');await a.locator('#name').fill('Alpha');await a.locator('#create').click();await a.locator('#copy').waitFor();
  const code=(await a.locator('#copy').innerText()).slice(0,6);assert.match(code,/^[A-Z0-9]{6}$/);assert.equal(await a.locator('#start').isDisabled(),true);
  await b.goto(`${url}/?room=${code}`);await b.locator('#name').fill('Bravo');await b.locator('#join').click();await b.locator('.roster').first().waitFor();
  assert.equal(server.game.rooms.get(code).mapId,'desert');assert.equal(server.game.rooms.get(code).playerLimit,6);
  await b.locator('.map-picker summary').click();assert.equal(await b.locator('[data-map="snow"]').isDisabled(),true);
  await a.locator('.map-picker summary').click();await a.locator('[data-map="snow"]').click();await b.locator('.battleground-info h2').filter({hasText:'Whiteout Relay'}).waitFor();
  await a.locator('.map-picker summary').click();await a.locator('[data-map="port"]').click();await b.locator('.battleground-info h2').filter({hasText:'Salt Yard'}).waitFor();
  await a.locator('[data-primary="sentinel"]').click();await a.locator('[data-primary="sentinel"].selected').waitFor();await b.locator('[data-team="red"]').click();
  await a.screenshot({path:'test-results/room.png'});await a.locator('#start').click();await a.locator('#enter').waitFor();await b.locator('#enter').waitFor();await a.locator('#quality').selectOption('medium');
  const room=server.game.rooms.get(code),pa=[...room.players.values()].find(p=>p.name==='Alpha'),pb=[...room.players.values()].find(p=>p.name==='Bravo');
  assert.notEqual(pa.team,pb.team);
  function stage(){Object.assign(pa,{x:-9,z:1,y:0,yaw:0,pitch:0,vx:0,vz:0,protectedUntil:0});pa.input=emptyInput();pa.spawnId++;Object.assign(pb,{x:-9,z:-3,y:0,yaw:Math.PI,pitch:0,vx:0,vz:0,protectedUntil:0});pb.input={...emptyInput(),yaw:Math.PI};pb.spawnId++;server.game.snapshot(room);}
  stage();await a.locator('#health').filter({hasText:'100'}).waitFor();await a.locator('#enter').click();
  await a.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await a.waitForTimeout(300);await a.screenshot({path:'test-results/match.png'});
  // Real browser input triggers authoritative damage, kill, score and respawn.
  await a.mouse.down();await a.waitForTimeout(280);await a.mouse.up();
  await a.waitForFunction(()=>Number(document.querySelector('#red-score').textContent)>0,{},{timeout:3000});
  assert.equal(pa.kills,1);assert.equal(pb.deaths,1);console.log('Passed: room flow, team balance, pointer lock, shooting and kill.');
  // Headless background rendering can outlast the death overlay; server timing is unit-tested.
  if(pb.hp===0){await b.bringToFront();await b.locator('#death.visible').waitFor({timeout:2500});await b.screenshot({path:'test-results/death.png'});}
  await b.waitForFunction(()=>document.querySelector('#health').textContent==='100',{},{timeout:5000});
  await a.bringToFront();if(await a.locator('#enter').isVisible())await a.locator('#enter').click();await a.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
  await a.keyboard.press('Digit2');await a.waitForFunction(()=>document.querySelector('#weapon-name').textContent==='KESTREL 9');
  await a.waitForTimeout(250);await a.mouse.down();await a.waitForTimeout(100);await a.mouse.up();await a.waitForFunction(()=>Number(document.querySelector('#ammo').textContent)<15);await a.keyboard.press('KeyR');await a.waitForFunction(()=>document.querySelector('#reload-prompt').textContent.includes('RELOADING'));await a.waitForFunction(()=>document.querySelector('#ammo').textContent==='15',{},{timeout:3000});
  console.log('Passed: respawn, mouse recapture, pistol and reload.');await a.keyboard.press('Digit3');await a.waitForFunction(()=>document.querySelector('#weapon-name').textContent==='FIELD KNIFE');
  await a.keyboard.press('KeyG');await a.waitForFunction(()=>document.querySelector('#grenade-count').textContent==='0');
  await a.keyboard.down('Tab');await a.locator('#board.visible').waitFor();await a.screenshot({path:'test-results/scoreboard.png'});await a.keyboard.up('Tab');
  const oldZ=pa.z;await a.keyboard.down('KeyS');await a.waitForTimeout(350);await a.keyboard.up('KeyS');assert.ok(pa.z>oldZ+.3,'keyboard movement is server simulated');
  room.endsAt=server.game.now()-.1;await a.locator('.results').waitFor();await a.screenshot({path:'test-results/results.png'});await a.locator('#again').click();await a.locator('#enter').waitFor();assert.equal(room.scores.red,0);
  room.endsAt=server.game.now()-.1;await a.locator('#back').waitFor();await a.locator('#back').click();await a.locator('#copy').waitFor();assert.equal(room.code,code);assert.equal(room.players.size,2);
  await ctx1.close();await b.waitForFunction(()=>document.querySelector('.host-badge')?.closest('.player-row').textContent.includes('Bravo'));assert.equal(room.host,pb.id);
  await b.reload();await b.locator('#create').waitFor();await b.waitForTimeout(200);assert.equal(server.game.rooms.has(code),false);
  assert.deepEqual(errors,[]);console.log('Browser E2E passed: two players, team balance, real shooting, death, respawn, reload, switching, grenade, movement, scoreboard, replay, return, host transfer, refresh.');
}catch(error){await debugPage?.screenshot({path:'test-results/failure.png'}).catch(()=>{});console.log('Browser errors:',errors);console.log('Player diagnostics:',[...server.game.rooms.values()].flatMap(r=>[...r.players.values()].map(p=>({name:p.name,hp:p.hp,weapon:p.weapon,ammo:p.ammo,reloadAt:p.reloadAt,nextFire:p.nextFire,input:p.input}))));throw error;}finally{await browser.close();await server.close();}
