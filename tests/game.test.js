import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../server/game.js';
import {BOXES,SPAWNS,WEAPONS,move,overlaps,emptyInput,TICK} from '../shared/game.js';

function fixture(){let time=100;const events=[];const game=new Game((target,type,data)=>events.push({target,type,data}),{now:()=>time,random:()=>.5,duration:10});const room=game.enter('a','Alpha');game.enter('b','Bravo',room.code);return {game,room,events,advance:n=>{time+=n;}};}
function lineUp(f){f.game.start('a');const a=f.game.player('a'),b=f.game.player('b');Object.assign(a,{x:-9,y:0,z:0,yaw:0,pitch:0,protectedUntil:0});Object.assign(b,{x:-9,y:0,z:-3,protectedUntil:0});a.input={...emptyInput()};return {a,b};}
test('rooms: six-character codes, name validation, host-only start, capacity, balancing',()=>{
  const {game,room}=fixture();assert.match(room.code,/^[A-Z0-9]{6}$/);assert.throws(()=>game.start('b'),/host/);assert.throws(()=>game.enter('z',''),/name/);assert.throws(()=>game.enter('z','z','BAD123'),/not found/);assert.throws(()=>game.enter('a','duplicate'),/Leave/);
  for(let i=2;i<10;i++)game.enter(String(i),'Player '+i,room.code);
  assert.throws(()=>game.enter('extra','extra',room.code),/full/);
  for(const p of room.players.values())game.choose(p.id,{team:'red'});
  game.start('a');assert.equal([...room.players.values()].filter(p=>p.team==='red').length,5);assert.equal(room.state,'playing');assert.throws(()=>game.choose('a',{team:'blue'}),/waiting/);assert.throws(()=>game.enter('late','late',room.code),/already started/);
});
test('all spawns are free of collisions and team players receive valid loadouts',()=>{
  for(const spawns of Object.values(SPAWNS))for(const s of spawns)assert.equal(BOXES.some(b=>overlaps({...s,y:0,crouch:false},b)),false,JSON.stringify(s));
  const {game,room}=fixture();game.start('a');for(const p of room.players.values()){assert.equal(p.hp,100);assert.equal(p.ammo[p.primary].mag,30);assert.equal(p.grenadeCount,1);}
});
test('authoritative hits: headshot multiplier, fire interval, kill score, three-second respawn',()=>{
  const f=fixture(),{a,b}=lineUp(f);f.game.fire(f.room,a);assert.equal(b.hp,25);assert.equal(a.ammo.vektor.mag,29);
  f.game.fire(f.room,a);assert.equal(b.hp,25);f.advance(.12);f.game.fire(f.room,a);assert.equal(b.hp,0);assert.equal(a.kills,1);assert.equal(b.deaths,1);assert.equal(f.room.scores.red,1);
  f.advance(2.9);f.game.tick();assert.equal(b.hp,0);f.advance(.11);f.game.tick();assert.equal(b.hp,100);assert.equal(b.spawnId,2);assert.equal(b.kills,0);assert.equal(b.deaths,1);
});
test('body hits, walls, friendly fire and spawn protection',()=>{
  const f=fixture(),{a,b}=lineUp(f);a.pitch=-.2;f.game.fire(f.room,a);assert.equal(b.hp,70);
  f.advance(.2);a.pitch=0;b.protectedUntil=1000;f.game.fire(f.room,a);assert.equal(b.hp,70);b.protectedUntil=0;
  f.advance(.2);b.team=a.team;f.game.fire(f.room,a);assert.equal(b.hp,70);b.team='blue';
  f.advance(.2);Object.assign(a,{x:0,z:4});Object.assign(b,{x:0,z:-4});a.pitch=-.12;f.game.fire(f.room,a);assert.equal(b.hp,70,'center crate blocks shot');
});
test('ammo, reload completion, cancellation, invalid weapon and grenade limits',()=>{
  const f=fixture(),{a}=lineUp(f);a.ammo.vektor.mag=0;f.game.fire(f.room,a);assert.equal(a.ammo.vektor.mag,0);
  f.game.action('a','reload');assert.ok(a.reloadAt);f.advance(2.5);f.game.tick();assert.equal(a.ammo.vektor.mag,30);assert.equal(a.ammo.vektor.reserve,90);
  a.ammo.vektor.mag=10;f.game.action('a','reload');f.game.action('a','switch','pistol');assert.equal(a.reloadAt,0);f.game.action('a','switch','longshot');assert.equal(a.weapon,'pistol');
  f.game.action('a','grenade');f.game.action('a','grenade');assert.equal(f.room.grenades.length,1);assert.equal(a.grenadeCount,0);
});
test('grenade explosion is server-owned, obeys line of sight, and awards an enemy kill once',()=>{
  const f=fixture(),{a,b}=lineUp(f);Object.assign(a,{x:-6,z:8});Object.assign(b,{x:-6,z:0,hp:10});
  f.room.grenades.push({id:'test',owner:'a',team:'red',x:-6,y:1,z:0,vx:0,vy:0,vz:0,explodeAt:100});f.game.tick();assert.equal(b.hp,0);assert.equal(a.kills,1);assert.equal(f.room.grenades.length,0);f.game.tick();assert.equal(a.kills,1);
});
test('all weapons have distinct server firing behavior and the knife is range-limited',()=>{
  for(const id of Object.keys(WEAPONS)){
    const f=fixture(),{a,b}=lineUp(f);a.weapon=id;a.ammo[id]={mag:WEAPONS[id].mag,reserve:WEAPONS[id].reserve};if(id==='knife')b.z=-1.5;
    f.game.fire(f.room,a);assert.ok(b.hp<100,id+' deals damage');
  }
  const f=fixture(),{a,b}=lineUp(f);a.weapon='knife';b.z=-5;f.game.fire(f.room,a);assert.equal(b.hp,100);
});
test('movement collision, jump, crouch, speed and client-state tampering',()=>{
  const f=fixture(),{a}=lineUp(f);Object.assign(a,{x:0,z:3});for(let i=0;i<120;i++)move(a,{...emptyInput(),forward:true},TICK);assert.ok(a.z>=1.8,'cannot cross crate');
  Object.assign(a,{x:-6,z:0,grounded:true});move(a,{...emptyInput(),jump:true},TICK);assert.ok(a.y>0);for(let i=0;i<120;i++)move(a,emptyInput(),TICK);assert.equal(a.y,0);
  move(a,{...emptyInput(),crouch:true},TICK);assert.equal(a.crouch,true);
  const before=a.x;f.game.input('a',{seq:1,spawnId:a.spawnId,yaw:NaN,pitch:0,x:999,hp:999});assert.equal(a.x,before);assert.equal(a.hp,100);
  f.game.input('a',{seq:1,spawnId:a.spawnId,...emptyInput(),x:999,hp:999});f.game.tick();assert.notEqual(a.x,999);assert.equal(a.hp,100);
});
test('match results, same-room replay, host transfer and room cleanup',()=>{
  const f=fixture();f.game.start('a');f.room.scores.blue=3;f.advance(11);f.game.tick();assert.equal(f.room.results.winner,'blue');assert.equal(f.room.state,'results');assert.throws(()=>f.game.returnRoom('b'),/host/);
  f.game.returnRoom('a');assert.equal(f.room.state,'lobby');f.game.start('a');assert.equal(f.room.scores.blue,0);assert.equal(f.room.players.size,2);
  f.game.leave('a');assert.equal(f.room.host,'b');assert.equal(f.room.state,'results');f.game.leave('b');assert.equal(f.game.rooms.size,0);assert.equal(f.game.members.size,0);
});
