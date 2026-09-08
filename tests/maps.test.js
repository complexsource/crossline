import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,getMap} from '../shared/maps.js';
import {overlaps,move,emptyInput,TICK,wallDistance} from '../shared/game.js';
import {Game} from '../server/game.js';

test('eight original layouts have collision-free, mutually reachable team spawns',()=>{
  assert.equal(MAPS.length,8);assert.equal(new Set(MAPS.map(m=>JSON.stringify(m.boxes))).size,8);
  for(const m of MAPS){
    const spots=Object.values(m.spawns).flat();for(const p of spots)assert.equal(m.boxes.some(b=>overlaps({...p,y:0},b)),false,`${m.name}: spawn ${JSON.stringify(p)}`);
    // Conservative ground navigation: a one-metre grid with the actual player radius.
    const free=(x,z)=>Math.abs(x)<32&&Math.abs(z)<27&&!m.boxes.some(b=>overlaps({x,z,y:0},b));
    const visited=new Set(),queue=[[spots[0].x,spots[0].z]];for(let i=0;i<queue.length;i++){const [x,z]=queue[i],k=`${x}/${z}`;if(visited.has(k)||!free(x,z))continue;visited.add(k);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([x+dx,z+dz]);}
    for(const p of spots)assert.ok(visited.has(`${p.x}/${p.z}`),`${m.name}: isolated spawn ${JSON.stringify(p)}`);
  }
});
test('host map and player-limit configuration is validated and synchronized',()=>{
  const events=[],game=new Game((...args)=>events.push(args));const room=game.enter('host','Host',undefined,{mapId:'desert',playerLimit:2});game.enter('friend','Friend',room.code);
  assert.throws(()=>game.enter('third','Third',room.code),/full/);assert.throws(()=>game.configure('friend',{mapId:'snow'}),/host/);
  assert.throws(()=>game.configure('host',{mapId:'missing'}),/valid/);assert.throws(()=>game.configure('host',{playerLimit:1}),/valid/);assert.equal(room.mapId,'desert');
  game.configure('host',{mapId:'snow',playerLimit:4});assert.equal(events.at(-1)[2].mapId,'snow');assert.equal(events.at(-1)[2].playerLimit,4);
  game.start('host');assert.throws(()=>game.configure('host',{mapId:'port'}),/before/);
  for(const p of room.players.values())assert.equal(getMap('snow').boxes.some(b=>overlaps(p,b)),false);
  game.finish(room);game.returnRoom('host');assert.equal(room.mapId,'snow');assert.equal(room.playerLimit,4);
});
test('client prediction can use selected-map geometry and climb small steps',()=>{
  const p={x:0,y:0,z:1,vx:0,vy:0,vz:0,grounded:true,crouch:false},input={...emptyInput(),forward:true};
  const steps=[{x:0,y:.125,z:0,w:3,h:.25,d:1},{x:0,y:.25,z:-1,w:3,h:.5,d:1}];for(let i=0;i<32;i++)move(p,input,TICK,steps);assert.ok(p.y>=.25);assert.ok(p.z<.5);
  assert.equal(wallDistance({x:0,y:2,z:0},{x:0,y:-1,z:0},[]),2);
});
