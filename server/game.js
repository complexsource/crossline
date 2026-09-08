import {randomBytes} from 'node:crypto';
import {getMap,validMap} from '../shared/maps.js';
import {WEAPONS, PRIMARIES, TICK, MATCH_SECONDS, move, direction, eyeHeight, playerHeight, rayBox, wallDistance, emptyInput, clamp} from '../shared/game.js';

export class Game {
  constructor(emit, {duration=MATCH_SECONDS, now=()=>performance.now()/1000, random=Math.random}={}) {
    this.rooms=new Map();this.members=new Map();this.emit=emit;this.now=now;this.random=random;this.duration=duration;
  }
  roomOf(id){return this.rooms.get(this.members.get(id));}
  player(id){return this.roomOf(id)?.players.get(id);}
  lobby(room){return {code:room.code,host:room.host,state:room.state,mapId:room.mapId,playerLimit:room.playerLimit,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,primary:p.primary})),scores:room.scores,results:room.results};}
  broadcast(room){this.emit(room.code,'room',this.lobby(room));}
  enter(id,name,code,options={}){
    if(this.members.has(id))throw Error('Leave your current room first.');
    if(typeof name!=='string'||!name.trim()||name.length>20)throw Error('Enter a player name (1–20 characters).');
    let room;
    if(code!==undefined){
      if(typeof code!=='string'||! /^[A-Z0-9]{6}$/.test(code.toUpperCase()))throw Error('Enter a six-character room code.');
      room=this.rooms.get(code.toUpperCase());if(!room)throw Error('Room not found. Check the code and try again.');
      if(room.state!=='lobby')throw Error('This match has already started. Join when your friends return to the room.');
      if(room.players.size>=room.playerLimit)throw Error(`This room is full (${room.playerLimit} players).`);
    }else{
      if(this.rooms.size>=1000)throw Error('The server is full. Try again soon.');
      do{code=randomBytes(3).toString('hex').toUpperCase();}while(this.rooms.has(code));
      const mapId=options.mapId??'port',playerLimit=options.playerLimit??10;
      if(!validMap(mapId)||!Number.isInteger(playerLimit)||playerLimit<2||playerLimit>10)throw Error('Choose a valid map and a player limit from 2 to 10.');
      room={code,host:id,state:'lobby',mapId,playerLimit,players:new Map(),scores:{red:0,blue:0},grenades:[],results:null};this.rooms.set(code,room);
    }
    const red=[...room.players.values()].filter(p=>p.team==='red').length;
    const player={id,name:name.trim().replace(/[\x00-\x1f\x7f]/g,''),team:red<=room.players.size-red?'red':'blue',primary:'vektor',kills:0,deaths:0,input:emptyInput(),ack:0,lastInput:0,spawnId:0};
    room.players.set(id,player);this.members.set(id,room.code);return room;
  }
  leave(id){
    const room=this.roomOf(id);if(!room)return;
    room.players.delete(id);this.members.delete(id);
    room.grenades=room.grenades.filter(g=>g.owner!==id);
    if(!room.players.size){this.rooms.delete(room.code);return;}
    if(room.host===id)room.host=room.players.keys().next().value;
    if(room.state==='playing'&&!['red','blue'].every(t=>[...room.players.values()].some(p=>p.team===t)))this.finish(room,'A team left the match.');
    this.broadcast(room);
  }
  choose(id,{team,primary}={}){
    const room=this.roomOf(id),p=this.player(id);if(!room||room.state!=='lobby')throw Error('Loadouts and teams can only change in the waiting room.');
    if(team!==undefined){if(!['red','blue'].includes(team))throw Error('Invalid team.');p.team=team;}
    if(primary!==undefined){if(!PRIMARIES.includes(primary))throw Error('Invalid primary.');p.primary=primary;}
    this.broadcast(room);
  }
  configure(id,{mapId,playerLimit}={}){
    const room=this.roomOf(id);if(!room||room.host!==id||room.state!=='lobby')throw Error('Only the host can change map settings before the match.');
    const nextMap=mapId??room.mapId,nextLimit=playerLimit??room.playerLimit;
    if(!validMap(nextMap)||!Number.isInteger(nextLimit)||nextLimit<2||nextLimit>10||nextLimit<room.players.size)throw Error('Choose a valid map and enough player slots for everyone.');
    room.mapId=nextMap;room.playerLimit=nextLimit;this.broadcast(room);
  }
  start(id){
    const room=this.roomOf(id);if(!room||room.host!==id)throw Error('Only the host can start the game.');
    if(room.state==='playing')throw Error('The match is already running.');
    if(room.players.size<2)throw Error('Invite at least one friend to start.');
    const counts=()=>['red','blue'].map(t=>[...room.players.values()].filter(p=>p.team===t));
    let teams=counts();while(Math.abs(teams[0].length-teams[1].length)>1){const big=teams[0].length>teams[1].length?0:1;teams[big].at(-1).team=big===0?'blue':'red';teams=counts();}
    room.state='playing';room.scores={red:0,blue:0};room.results=null;room.endsAt=this.now()+this.duration;room.grenades=[];
    for(const p of room.players.values()){p.kills=0;p.deaths=0;this.spawn(room,p);}
    this.broadcast(room);this.snapshot(room);
  }
  returnRoom(id){const room=this.roomOf(id);if(!room||room.host!==id||room.state!=='results')throw Error('The host can return everyone after the match.');room.state='lobby';room.grenades=[];this.broadcast(room);}
  spawn(room,p){
    const enemies=[...room.players.values()].filter(e=>e.team!==p.team&&e.hp>0);
    const spots=getMap(room.mapId).spawns[p.team].map(s=>({...s,rank:Math.min(100,...enemies.map(e=>Math.hypot(e.x-s.x,e.z-s.z)))+this.random()*8})).sort((a,b)=>b.rank-a.rank);
    Object.assign(p,{x:spots[0].x,z:spots[0].z,y:0,vx:0,vy:0,vz:0,yaw:p.team==='red'?-Math.PI/2:Math.PI/2,pitch:0,hp:100,grounded:true,crouch:false,jumpHeld:false,weapon:p.primary,ammo:{},reloadAt:0,nextFire:0,respawnAt:0,protectedUntil:this.now()+1.5,grenadeCount:1,input:emptyInput(),wasShooting:false,lastInput:this.now()});
    for(const w of [p.primary,'pistol','knife'])p.ammo[w]={mag:WEAPONS[w].mag,reserve:WEAPONS[w].reserve};
    p.spawnId++;p.input.yaw=p.yaw;
  }
  input(id,data){
    const p=this.player(id),room=this.roomOf(id);if(!p||room.state!=='playing'||p.hp<=0)return;
    if(!data||!Number.isSafeInteger(data.seq)||data.seq<=p.ack||data.seq>p.ack+10000||data.spawnId!==p.spawnId)return;
    if(!Number.isFinite(data.yaw)||!Number.isFinite(data.pitch))return;
    const input=emptyInput();for(const k of Object.keys(input))if(typeof input[k]==='boolean')input[k]=data[k]===true;
    input.yaw=((data.yaw%(Math.PI*2))+Math.PI*2)%(Math.PI*2);input.pitch=clamp(data.pitch,-1.48,1.48);
    p.input=input;p.receivedSeq=data.seq;p.lastInput=this.now();
  }
  action(id,type,value){
    const p=this.player(id),room=this.roomOf(id);if(!p||room.state!=='playing'||p.hp<=0)return;
    if(type==='switch'&&[p.primary,'pistol','knife'].includes(value)&&p.weapon!==value){p.weapon=value;p.reloadAt=0;p.nextFire=Math.max(p.nextFire,this.now()+.2);p.wasShooting=true;}
    if(type==='reload'){const w=WEAPONS[p.weapon],a=p.ammo[p.weapon];if(p.weapon!=='knife'&&!p.reloadAt&&a.mag<w.mag&&a.reserve>0){p.reloadAt=this.now()+w.reload;this.emit(room.code,'fx',{type:'reload',id,weapon:p.weapon});}}
    if(type==='grenade'&&p.grenadeCount>0){
      p.grenadeCount--;p.protectedUntil=0;const d=direction(p.input.yaw,p.input.pitch);
      room.grenades.push({id:randomBytes(4).toString('hex'),owner:id,team:p.team,x:p.x,y:p.y+eyeHeight(p),z:p.z,vx:d.x*13,vy:d.y*13+4,vz:d.z*13,explodeAt:this.now()+2});
    }
  }
  damage(room,target,amount,shooter,weapon,headshot=false){
    if(target.hp<=0||target.protectedUntil>this.now()||(target.team===shooter.team&&target!==shooter))return;
    target.hp=Math.max(0,target.hp-Math.round(amount));
    this.emit(target.id,'hurt',{hp:target.hp,headshot});
    if(target!==shooter)this.emit(shooter.id,'hit',{headshot,killed:target.hp===0});
    if(!target.hp){
      target.deaths++;target.respawnAt=this.now()+3;target.reloadAt=0;target.input=emptyInput();
      if(target!==shooter){shooter.kills++;room.scores[shooter.team]++;}
      this.emit(room.code,'fx',{type:'kill',killer:shooter.name,victim:target.name,weapon,headshot,id:target.id,team:shooter.team});
    }
  }
  fire(room,p){
    const now=this.now(),w=WEAPONS[p.weapon],ammo=p.ammo[p.weapon];
    if(now<p.nextFire||p.reloadAt||(!ammo.mag&&p.weapon!=='knife'))return;
    p.nextFire=now+w.interval;p.protectedUntil=0;if(p.weapon!=='knife')ammo.mag--;
    const origin={x:p.x,y:p.y+eyeHeight(p),z:p.z},ends=[];
    for(let i=0;i<(w.pellets||1);i++){
      const moving=Math.hypot(p.vx,p.vz)>1;const spread=w.spread*(p.input.aim?(p.weapon==='longshot'?.025:.55):1)*(moving?2:1)*(p.grounded?1:3);
      const d=direction(p.yaw+(this.random()-.5)*spread*2,p.pitch+(this.random()-.5)*spread*2);
      const solids=getMap(room.mapId).boxes,wall=wallDistance(origin,d,solids);
      let distance=Math.min(w.range,wall),hit=null,head=false;
      for(const t of room.players.values()){
        if(t===p||t.hp<=0||t.team===p.team||t.protectedUntil>now)continue;
        const h=playerHeight(t),headD=rayBox(origin,d,{x:t.x,y:t.y+h-.2,z:t.z,w:.44,h:.4,d:.44});
        const bodyD=rayBox(origin,d,{x:t.x,y:t.y+(h-.4)/2,z:t.z,w:.62,h:h-.4,d:.62});
        const td=Math.min(headD,bodyD);if(td<distance){distance=td;hit=t;head=headD<=bodyD;}
      }
      if(hit)this.damage(room,hit,w.damage*(head?2.5:1),p,p.weapon,head);
      const end={x:origin.x+d.x*distance,y:origin.y+d.y*distance,z:origin.z+d.z*distance,hit:!!hit};
      if(!hit&&wall<=w.range){
        end.normal={x:0,y:1,z:0};
        const solid=solids.find(b=>Math.abs(rayBox(origin,d,b)-wall)<.001);
        if(solid){let closest=Infinity;for(const [a,s] of [['x','w'],['y','h'],['z','d']])for(const sign of [-1,1]){const delta=Math.abs(end[a]-solid[a]-sign*solid[s]/2);if(delta<closest){closest=delta;end.normal={x:0,y:0,z:0,[a]:sign};}}}
      }
      ends.push(end);
    }
    this.emit(room.code,'fx',{type:'shot',id:p.id,weapon:p.weapon,origin,ends});
  }
  tick(){
    const now=this.now();
    for(const room of this.rooms.values()){
      if(room.state!=='playing')continue;
      if(now>=room.endsAt){this.finish(room);continue;}
      for(const p of room.players.values()){
        if(p.hp<=0){if(now>=p.respawnAt)this.spawn(room,p);continue;}
        if(now-p.lastInput>.25)p.input={...emptyInput(),yaw:p.yaw,pitch:p.pitch};
        move(p,p.input,TICK,getMap(room.mapId).boxes);if(p.receivedSeq)p.ack=p.receivedSeq;
        if(p.reloadAt&&now>=p.reloadAt){const a=p.ammo[p.weapon],count=Math.min(WEAPONS[p.weapon].mag-a.mag,a.reserve);a.mag+=count;a.reserve-=count;p.reloadAt=0;}
        if(p.input.shoot&&(WEAPONS[p.weapon].auto||!p.wasShooting))this.fire(room,p);
        p.wasShooting=p.input.shoot;
      }
      for(const g of room.grenades){
        g.vy-=16*TICK;
        for(const a of ['x','y','z']){const old=g[a];g[a]+=g['v'+a]*TICK;if(getMap(room.mapId).boxes.some(b=>Math.abs(g.x-b.x)<b.w/2+.12&&Math.abs(g.y-b.y)<b.h/2+.12&&Math.abs(g.z-b.z)<b.d/2+.12)){g[a]=old;g['v'+a]*=-.55;}}
        if(g.y<.13){g.y=.13;g.vy=Math.abs(g.vy)*.4;g.vx*=.94;g.vz*=.94;}
        if(now>=g.explodeAt){
          const owner=room.players.get(g.owner);if(owner)for(const p of room.players.values()){
            const v={x:p.x-g.x,y:p.y+.8-g.y,z:p.z-g.z},distance=Math.hypot(v.x,v.y,v.z);
            if(distance<8&&wallDistance(g,{x:v.x/(distance||1),y:v.y/(distance||1),z:v.z/(distance||1)},getMap(room.mapId).boxes)>=distance-.1)this.damage(room,p,120*(1-distance/8),owner,'grenade');
          }
          this.emit(room.code,'fx',{type:'explosion',x:g.x,y:g.y,z:g.z});
        }
      }
      room.grenades=room.grenades.filter(g=>g.explodeAt>now);
    }
  }
  snapshot(room){
    const now=this.now();this.emit(room.code,'state',{time:now,remaining:Math.max(0,room.endsAt-now),scores:room.scores,grenades:room.grenades.map(({id,x,y,z})=>({id,x,y,z})),players:[...room.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,x:p.x,y:p.y,z:p.z,vx:p.vx,vy:p.vy,vz:p.vz,yaw:p.yaw,pitch:p.pitch,crouch:p.crouch,grounded:p.grounded,jumpHeld:p.jumpHeld,hp:p.hp,weapon:p.weapon,primary:p.primary,ammo:p.ammo[p.weapon],reload:Math.max(0,p.reloadAt-now),respawn:Math.max(0,p.respawnAt-now),protected:p.protectedUntil>now,kills:p.kills,deaths:p.deaths,ack:p.ack,spawnId:p.spawnId,grenadeCount:p.grenadeCount}))});
  }
  finish(room,reason='Time is up.'){
    room.state='results';room.grenades=[];
    room.results={winner:room.scores.red===room.scores.blue?'draw':room.scores.red>room.scores.blue?'red':'blue',reason,scores:{...room.scores},players:[...room.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,kills:p.kills,deaths:p.deaths,score:p.kills*100})).sort((a,b)=>b.score-a.score)};
    this.broadcast(room);
  }
}
