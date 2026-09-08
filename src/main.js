import {io} from 'socket.io-client';
import {MAPS,getMap} from '../shared/maps.js';
import {materialsReady} from './materials.js';
import {Renderer} from './renderer.js';
import {Sound} from './audio.js';
import {WEAPONS,PRIMARIES,TICK,move,emptyInput} from '../shared/game.js';
import './style.css';

const app=document.querySelector('#app'),canvas=document.querySelector('#game');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let graphics;
try{graphics=new Renderer(canvas);}catch(e){app.innerHTML='<main class="fatal"><h1>WebGL is unavailable</h1><p>Crossline needs browser hardware acceleration. Enable it in your browser settings, then reload.</p><button onclick="location.reload()">TRY AGAIN</button></main>';throw e;}
const sound=new Sound(),socket=io({reconnection:true,reconnectionAttempts:5,timeout:8000});
let room=null,snapshot=null,local=null,seq=0,pending=[],input=emptyInput(),playing=false,locked=false,scoreboard=false,resultsDismissed=false;
let last=performance.now(),accumulator=0,hudAt=0,fxAt=0,stepAt=0,latency=0,fps=60,lastPrimary='vektor',name='';
let correction={x:0,y:0,z:0},feed=[],hitUntil=0,hurtUntil=0,sensitivity=.0021;
try{name=localStorage.getItem('crossline-name')||'';}catch{}
let selectedMap='port',playerLimit=10;
const mapName=()=>esc(getMap(room?.mapId||selectedMap).name.toUpperCase());
const qualityOptions=()=>['low','medium','high','ultra'].map(q=>`<option value="${q}" ${graphics.quality===q?'selected':''}>${q.toUpperCase()}</option>`).join('');
const mapOptions=id=>MAPS.map(m=>`<option value="${m.id}" ${m.id===id?'selected':''}>${m.name} · ${m.category}</option>`).join('');
function mapThumb(m){return `<img src="/previews/${m.id}.webp" alt="${esc(m.name)} — actual map preview" loading="lazy">`;}
const invite=new URLSearchParams(location.search).get('room')||'';
const logo='<div class="brand"><span class="brand-symbol">╱╱</span> CROSSLINE<span class="version">01</span></div>';
const arrow='<span aria-hidden="true">↗</span>';
const controls='<div class="key-grid"><span><kbd>W A S D</kbd> Move</span><span><kbd>MOUSE</kbd> Look</span><span><kbd>LMB</kbd> Shoot</span><span><kbd>RMB</kbd> Aim / scope</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>SHIFT</kbd> Run</span><span><kbd>CTRL</kbd> Crouch</span><span><kbd>R</kbd> Reload</span><span><kbd>1 2 3</kbd> Weapons</span><span><kbd>G</kbd> Grenade</span><span><kbd>TAB</kbd> Scoreboard</span><span><kbd>ESC</kbd> Release mouse</span></div>';
function toast(message){let el=document.querySelector('#toast');if(!el){el=document.createElement('div');el.id='toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),4200);}
function call(event,data={}){return new Promise(resolve=>socket.timeout(5000).emit(event,data,(error,result)=>{if(error){toast('Connection timed out. Please try again.');resolve(null);}else if(!result?.ok){toast(result?.error||'Something went wrong. Try again.');resolve(null);}else resolve(result);}));}
function pageChrome(content){return `<div class="shell"><header>${logo}<div class="online"><i class="${socket.connected?'':'offline'}"></i>${socket.connected?'SERVER ONLINE':'CONNECTING…'}</div></header>${content}<footer><span>ORIGINAL MAP <b>${mapName()}</b></span><span>DESKTOP · KEYBOARD + MOUSE</span><span>TEAM DEATHMATCH <b>V1.0</b></span></footer></div>`;}
function showHome(){
  playing=false;app.innerHTML=pageChrome(`<main class="home"><section class="intro"><div class="eyebrow"><span class="dash"></span> FRIENDS. TWO TEAMS. EIGHT BATTLEGROUNDS.</div><h1>HOLD YOUR<br><em>GROUND.</em></h1><p>A room code is all it takes.<br>Bring your friends. Pick a side. Make every shot count.</p><div class="map-note"><img id="selected-preview" src="/previews/${selectedMap}.webp" alt="Selected map preview"><span>${mapName()}</span><small>${esc(getMap(selectedMap).category)} · RECOMMENDED ${getMap(selectedMap).recommended} PLAYERS</small><div class="map-bars"><i></i><i></i><i></i><i></i><i></i></div></div></section><section class="entry panel"><div class="panel-top"><span>DEPLOY WITH FRIENDS</span><span class="status-tag">2–10 PLAYERS</span></div><h2>Get your squad in.</h2><label for="name">PLAYER NAME</label><input id="name" maxlength="20" autocomplete="nickname" placeholder="Your callsign" value="${esc(name)}"><div class="create-settings"><small class="mode-label">GAME MODE · TEAM DEATHMATCH</small><label for="map-create">BATTLEGROUND</label><select id="map-create">${mapOptions(selectedMap)}</select><div class="settings-pair"><label>PLAYER LIMIT<select id="player-limit">${Array.from({length:9},(_,i)=>`<option ${i+2===playerLimit?'selected':''}>${i+2}</option>`).join('')}</select></label><label>GRAPHICS<select id="home-quality">${qualityOptions()}</select></label></div></div><button id="create" class="primary">CREATE ROOM ${arrow}</button><div class="divider"><span>HAVE A ROOM CODE?</span></div><label for="code">ROOM CODE</label><div class="join-row"><input id="code" maxlength="6" placeholder="ABCD12" value="${esc(invite.toUpperCase().slice(0,6))}" autocomplete="off" spellcheck="false"><button id="join">JOIN ${arrow}</button></div><div class="entry-foot"><span class="tiny-cross">+</span><p>No accounts. No downloads.<br>Just you and your friends.</p></div></section></main>`);
  graphics.setMap(selectedMap);graphics.clearPlayers();
  document.querySelector('#map-create').onchange=e=>{selectedMap=e.target.value;graphics.setMap(selectedMap);document.querySelector('.map-note span').textContent=getMap(selectedMap).name.toUpperCase();document.querySelector('.map-note small').textContent=`${getMap(selectedMap).category} · RECOMMENDED ${getMap(selectedMap).recommended} PLAYERS`;document.querySelector('#selected-preview').src=`/previews/${selectedMap}.webp`;};
  document.querySelector('#player-limit').onchange=e=>playerLimit=Number(e.target.value);
  document.querySelector('#home-quality').onchange=e=>graphics.setQuality(e.target.value);
  const getName=()=>{name=document.querySelector('#name').value.trim();if(!name){document.querySelector('#name').focus();toast('Enter your player name first.');return false;}try{localStorage.setItem('crossline-name',name);}catch{}return true;};
  document.querySelector('#create').onclick=async()=>{if(getName()){sound.unlock();await call('create',{name,mapId:selectedMap,playerLimit});}};
  document.querySelector('#join').onclick=async()=>{if(getName()){sound.unlock();await call('join',{name,code:document.querySelector('#code').value.trim().toUpperCase()});}};
  document.querySelector('#code').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''));
  document.querySelector('#code').onkeydown=e=>{if(e.key==='Enter')document.querySelector('#join').click();};
  document.querySelector('#name').onkeydown=e=>{if(e.key==='Enter')document.querySelector(invite?'#join':'#create').click();};
}
function teamPanel(team){const players=room.players.filter(p=>p.team===team);return `<section class="team-panel ${team}"><div class="team-title"><span><i></i> ${team.toUpperCase()} TEAM</span><b>${players.length}<small>/ ${Math.ceil(room.playerLimit/2)}</small></b></div><div class="roster">${players.map(p=>`<div class="player-row"><span class="avatar">${esc(p.name.charAt(0).toUpperCase())}</span><span><b>${esc(p.name)}${p.id===socket.id?' <small>YOU</small>':''}</b><small>${esc(WEAPONS[p.primary].name)}</small></span>${p.id===room.host?'<span class="host-badge">HOST</span>':'<span class="ready-dot"></span>'}</div>`).join('')}${Array.from({length:Math.max(0,Math.ceil(room.playerLimit/2)-players.length)},()=>'<div class="empty-slot"><span>+</span> Waiting for player</div>').join('')}</div><button class="team-button" data-team="${team}" ${room.state!=='lobby'?'disabled':''}>${room.players.find(p=>p.id===socket.id)?.team===team?'✓ YOUR TEAM':'JOIN '+team.toUpperCase()+' TEAM'}</button></section>`;}
function showRoom(){
  playing=false;document.exitPointerLock?.();const self=room.players.find(p=>p.id===socket.id),host=room.host===socket.id;lastPrimary=self.primary;
  app.innerHTML=pageChrome(`<main class="lobby"><div class="lobby-heading"><div><div class="eyebrow">${mapName()} / TEAM DEATHMATCH</div><h1>ASSEMBLE YOUR TEAM<span>.</span></h1></div><button id="leave" class="subtle">LEAVE ROOM ↗</button></div><div class="room-strip"><div><small>ROOM CODE</small><button id="copy" title="Copy invite link">${room.code}<span>⧉</span></button></div><p>Share this code with your friends.<br><small>Teams are balanced when the match starts.</small></p><span class="room-count">${room.players.length}<small>/${room.playerLimit} PLAYERS</small></span></div><div class="battleground-strip panel"><img class="room-map-image" src="/previews/${room.mapId}.webp" alt="${esc(getMap(room.mapId).name)} preview"><div class="battleground-info"><small>SELECTED BATTLEGROUND · TEAM DEATHMATCH</small><h2>${esc(getMap(room.mapId).name)}</h2><p>${esc(getMap(room.mapId).tagline)}</p><small>RECOMMENDED ${getMap(room.mapId).recommended} PLAYERS · ${host?'HOST CONTROLS MAP':'CHOSEN BY HOST'}</small></div><details class="map-picker"><summary>${host&&room.state==='lobby'?'CHANGE MAP':'VIEW MAPS'} <span>↗</span></summary><div class="map-gallery">${MAPS.map(m=>`<button class="map-card ${room.mapId===m.id?'selected':''}" data-map="${m.id}" ${!host||room.state!=='lobby'?'disabled':''}>${mapThumb(m)}<span>${m.category}</span><b>${m.name}</b><small>${m.recommended} PLAYERS</small></button>`).join('')}</div></details></div><div class="teams">${teamPanel('red')}${teamPanel('blue')}</div><div class="loadout-row panel"><div><small>YOUR PRIMARY WEAPON</small><div class="weapon-options">${PRIMARIES.map(id=>`<button class="weapon-choice ${self.primary===id?'selected':''}" data-primary="${id}" ${room.state!=='lobby'?'disabled':''}><span>${WEAPONS[id].type}</span>${WEAPONS[id].name}</button>`).join('')}</div><p class="loadout-note">Pistol, knife & one grenade included. Refilled on respawn.</p></div><div class="deploy"><span>10-MINUTE MATCH · 3-SECOND RESPAWN</span><button id="start" class="primary" ${!host||room.players.length<2?'disabled':''}>${host?'START GAME':'WAITING FOR HOST'} ${arrow}</button><small>${room.players.length<2?'Invite a friend to start.':host?'Everyone ready? Let’s go.':'The host will start the match.'}</small></div></div></main>`);
  document.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>call('configure',{mapId:b.dataset.map}));
  document.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>call('choose',{team:b.dataset.team}));document.querySelectorAll('[data-primary]').forEach(b=>b.onclick=()=>call('choose',{primary:b.dataset.primary}));
  document.querySelector('#start').onclick=()=>{sound.unlock();call('start');};
  document.querySelector('#leave').onclick=async()=>{if(await call('leave')){room=null;local=null;showHome();}};
  document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}/?room=${room.code}`);toast('Invite link copied. Send it to your friends.');}catch{toast(`Room code: ${room.code}`);}};
}
function rows(players){return players.map(p=>`<tr class="${p.id===socket.id?'self':''}"><td><i class="team-dot ${p.team}"></i>${esc(p.name)}${p.id===socket.id?' <small>YOU</small>':''}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.score??p.kills*100}</td></tr>`).join('');}
const table=players=>`<table><thead><tr><th>PLAYER</th><th>KILLS</th><th>DEATHS</th><th>SCORE</th></tr></thead><tbody>${rows(players)}</tbody></table>`;
function showResults(){
  playing=false;document.exitPointerLock?.();const r=room.results,host=room.host===socket.id;
  app.innerHTML=pageChrome(`<main class="results panel"><div class="eyebrow">MATCH COMPLETE / ${mapName()}</div><h1 class="${r.winner}">${r.winner==='draw'?'A DRAW.':r.winner.toUpperCase()+' TEAM WINS.'}</h1><div class="result-scores"><span class="red">RED <b>${r.scores.red}</b></span><span>—</span><span class="blue"><b>${r.scores.blue}</b> BLUE</span></div><p>${esc(r.reason)}</p>${table(r.players)}<div class="result-actions"><button id="again" class="primary" ${!host||room.players.length<2?'disabled':''}>${host?'PLAY AGAIN':'WAITING FOR HOST'} ${arrow}</button><button id="back">RETURN TO ROOM</button></div></main>`);
  document.querySelector('#again').onclick=()=>{sound.unlock();call('start');};document.querySelector('#back').onclick=()=>{if(host)call('return');else{resultsDismissed=true;showRoom();}};
}
function showMatch(){
  playing=true;resultsDismissed=false;scoreboard=false;feed=[];pending=[];local=null;input=emptyInput();
  app.innerHTML=`<div class="hud"><div class="map-label"><b>${mapName()}</b><span id="connection-stats">TEAM DEATHMATCH</span></div><div class="match-score"><div class="score red"><span>RED</span><b id="red-score">0</b></div><div class="clock"><small>TEAM DEATHMATCH</small><b id="timer">10:00</b></div><div class="score blue"><b id="blue-score">0</b><span>BLUE</span></div></div><div id="kill-feed"></div><div id="crosshair"><i></i><i></i><i></i><i></i></div><div id="scope"><div></div></div><div id="hitmarker">×</div><div id="damage-flash"></div><div id="death"><small>YOU DIED</small><h2>BACK IN <span id="respawn">3</span></h2><p>Respawning at your team’s position</p></div><div class="hud-bottom"><div class="health-block"><span class="health-icon">+</span><div><small>HEALTH</small><b id="health">100</b><div class="health-bar"><i id="health-fill"></i></div></div></div><div class="weapon-slots"><span id="slot-primary" class="active"><kbd>1</kbd> PRIMARY</span><span id="slot-pistol"><kbd>2</kbd> PISTOL</span><span id="slot-knife"><kbd>3</kbd> KNIFE</span><span><kbd>G</kbd> FRAG <b id="grenade-count">1</b></span></div><div class="ammo-block"><small id="weapon-name">VEKTOR AK</small><div><b id="ammo">30</b><span>/ <span id="reserve">120</span></span></div><small id="reload-prompt">R TO RELOAD</small></div></div><div class="hud-help">SHIFT RUN <span>·</span> CTRL CROUCH <span>·</span> TAB SCOREBOARD <span>·</span> ESC PAUSE</div><div id="board" class="scoreboard panel"></div></div><div id="pause" class="pause-screen"><section class="pause-card panel"><div class="eyebrow">${room.players.find(p=>p.id===socket.id)?.team.toUpperCase()} TEAM / ${mapName()}</div><h2 id="pause-title">Ready to deploy?</h2><p>Click below to capture your mouse.<br>Press Escape to release it at any time.</p><button id="enter" class="primary">ENTER MATCH ${arrow}</button>${controls}<div class="pause-settings"><label>Mouse sensitivity<input id="sensitivity" type="range" min=".0005" max=".005" step=".0001" value="${sensitivity}"></label><label>Audio volume<input id="volume" type="range" min="0" max="1" step=".05" value="${sound.volume}"></label><label class="quality">Graphics preset<select id="quality">${qualityOptions()}</select></label></div><button id="exit-match" class="subtle">LEAVE MATCH</button></section></div>`;
  document.querySelector('#enter').onclick=async()=>{
    await sound.unlock();
    try{await canvas.requestPointerLock({unadjustedMovement:true});}catch{try{await canvas.requestPointerLock();}catch{toast('Mouse capture was blocked. Click Enter match again.');}}
  };
  document.querySelector('#sensitivity').oninput=e=>sensitivity=Number(e.target.value);
  document.querySelector('#volume').oninput=e=>{sound.volume=Number(e.target.value);if(sound.master)sound.master.gain.value=sound.volume;};
  document.querySelector('#quality').onchange=e=>graphics.setQuality(e.target.value);
  document.querySelector('#exit-match').onclick=async()=>{if(await call('leave')){room=null;local=null;playing=false;document.exitPointerLock?.();showHome();}};
}
socket.on('connect',()=>{if(!room)showHome();});
socket.on('connect_error',()=>toast('Can’t reach the server. Check your connection and try again.'));
socket.on('disconnect',()=>{room=null;local=null;snapshot=null;playing=false;locked=false;input=emptyInput();document.exitPointerLock?.();showHome();toast('Disconnected. You have left the room. Rejoin with its code.');});
socket.on('room',data=>{
  const oldState=room?.state;room=data;graphics.setMap(data.mapId);selectedMap=data.mapId;
  if(data.state==='playing'){if(oldState!=='playing')showMatch();}
  else if(data.state==='results'){if(resultsDismissed)showRoom();else showResults();}
  else{resultsDismissed=false;showRoom();}
});
socket.on('state',state=>{
  snapshot=state;const own=state.players.find(p=>p.id===socket.id);if(!own)return;graphics.sync(state,socket.id);
  if(!local||local.spawnId!==own.spawnId){local={...own};seq=own.ack;pending=[];input.yaw=own.yaw;input.pitch=own.pitch;correction={x:0,y:0,z:0};fxAt=0;}
  else{
    const old={x:local.x,y:local.y,z:local.z};pending=pending.filter(c=>c.seq>own.ack);local={...own};
    if(local.hp>0)for(const cmd of pending)move(local,cmd,TICK,getMap(room.mapId).boxes);
    const distance=Math.hypot(old.x-local.x,old.y-local.y,old.z-local.z);
    if(distance<1){correction.x+=old.x-local.x;correction.y+=old.y-local.y;correction.z+=old.z-local.z;}else correction={x:0,y:0,z:0};
    if(local.hp>0){local.yaw=input.yaw;local.pitch=input.pitch;}
  }
});
socket.on('fx',event=>{
  graphics.fx(event,socket.id);
  if(event.type==='kill'){feed.unshift({...event,at:performance.now()});feed=feed.slice(0,5);}
  if(event.type==='reload'&&event.id===socket.id)sound.play('reload',{weapon:event.weapon});
  if(event.type==='shot'&&event.id!==socket.id||event.type==='explosion'){
    const p=event.origin||event;const dx=(p.x||0)-(local?.x||0),dz=(p.z||0)-(local?.z||0),distance=Math.hypot(dx,dz);const pan=local?Math.max(-1,Math.min(1,(dx*Math.cos(local.yaw)-dz*Math.sin(local.yaw))/(distance||1))):0;
    sound.play(event.type==='explosion'?'explosion':event.weapon,{volume:Math.max(.02,1-distance/65),pan});
  }
});
socket.on('hit',data=>{hitUntil=performance.now()+150;document.querySelector('#hitmarker')?.classList.toggle('headshot',data.headshot);});
socket.on('hurt',()=>hurtUntil=performance.now()+230);
setInterval(()=>{if(socket.connected){const start=performance.now();socket.timeout(2500).emit('pingCheck',()=>latency=Math.round(performance.now()-start));}},2000);
function resetInput(){const {yaw,pitch}=input;input={...emptyInput(),yaw,pitch};}
document.addEventListener('pointerlockchange',()=>{
  locked=document.pointerLockElement===canvas;const pause=document.querySelector('#pause');if(pause)pause.style.display=locked?'none':'grid';if(!locked){resetInput();const title=document.querySelector('#pause-title');if(title)title.textContent='Back in the action.';}
});
window.addEventListener('blur',resetInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInput();});
document.addEventListener('mousemove',e=>{if(!locked||!playing||!local||local.hp<=0)return;const factor=input.aim?(local.weapon==='longshot'?.28:.7):1;input.yaw-=e.movementX*sensitivity*factor;input.pitch=Math.max(-1.48,Math.min(1.48,input.pitch-e.movementY*sensitivity*factor));});
document.addEventListener('contextmenu',e=>{if(playing)e.preventDefault();});
document.addEventListener('mousedown',e=>{if(!locked||!playing)return;if(e.button===0)input.shoot=true;if(e.button===2)input.aim=true;});
document.addEventListener('mouseup',e=>{if(e.button===0)input.shoot=false;if(e.button===2)input.aim=false;});
const keys={KeyW:'forward',KeyS:'back',KeyA:'left',KeyD:'right',Space:'jump',ShiftLeft:'run',ShiftRight:'run',ControlLeft:'crouch',ControlRight:'crouch'};
document.addEventListener('keydown',e=>{
  if(!playing)return;
  if(e.code==='Tab'){e.preventDefault();scoreboard=true;return;}
  if(!locked)return;
  if(keys[e.code]){e.preventDefault();input[keys[e.code]]=true;}
  if(e.repeat)return;
  if(e.code==='KeyR')socket.emit('action',{type:'reload'});
  if(e.code==='KeyG')socket.emit('action',{type:'grenade'});
  if(['Digit1','Digit2','Digit3'].includes(e.code)){input.aim=false;input.shoot=false;socket.emit('action',{type:'switch',value:e.code==='Digit1'?lastPrimary:e.code==='Digit2'?'pistol':'knife'});}
});
document.addEventListener('keyup',e=>{if(keys[e.code])input[keys[e.code]]=false;if(e.code==='Tab'){scoreboard=false;if(playing)e.preventDefault();}});
function updateHud(now){
  if(!playing||!local||!snapshot)return;
  const text=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  const secs=Math.max(0,Math.ceil(snapshot.remaining));text('timer',`${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`);
  text('red-score',snapshot.scores.red);text('blue-score',snapshot.scores.blue);text('health',local.hp);text('ammo',local.weapon==='knife'?'∞':local.ammo.mag);text('reserve',local.ammo.reserve);text('weapon-name',WEAPONS[local.weapon].name.toUpperCase());text('grenade-count',local.grenadeCount);text('respawn',Math.max(1,Math.ceil(local.respawn)));text('connection-stats',`${Math.round(fps)} FPS / ${latency} MS`);
  text('reload-prompt',local.reload>0?`RELOADING ${local.reload.toFixed(1)}s`:local.protected?'SPAWN PROTECTION':local.weapon==='knife'?'CLOSE QUARTERS':local.ammo.mag===0?'EMPTY · PRESS R':'R TO RELOAD');
  document.querySelector('#health-fill').style.width=`${local.hp}%`;document.querySelector('#death').classList.toggle('visible',local.hp<=0);
  document.querySelector('#scope').classList.toggle('visible',input.aim&&local.weapon==='longshot'&&local.hp>0&&locked);
  document.querySelector('#crosshair').classList.toggle('hidden',local.hp<=0||!locked||input.aim&&local.weapon==='longshot');
  document.querySelector('#crosshair').style.setProperty('--gap',`${input.aim?3:Math.hypot(local.vx,local.vz)>1?10:5}px`);
  document.querySelector('#board').classList.toggle('visible',scoreboard);if(scoreboard)document.querySelector('#board').innerHTML=`<div class="board-title">${mapName()} <span>ROOM ${room.code}</span></div>${table([...snapshot.players].sort((a,b)=>b.kills-a.kills))}`;
  for(const id of ['primary','pistol','knife'])document.querySelector('#slot-'+id).classList.toggle('active',id==='primary'?PRIMARIES.includes(local.weapon):id===local.weapon);
  feed=feed.filter(f=>now-f.at<6500);document.querySelector('#kill-feed').innerHTML=feed.map(f=>`<div><b class="${f.team}">${esc(f.killer)}</b><span>${f.headshot?'⌖ ':''}${esc(f.weapon==='grenade'?'FRAG':WEAPONS[f.weapon]?.name)}</span><b>${esc(f.victim)}</b></div>`).join('');
}
let wasFiring=false;
function frame(now){
  const elapsed=(now-last)/1000,dt=Math.min(.05,elapsed);last=now;fps+=(1/Math.max(.001,elapsed)-fps)*.04;
  if(playing&&local){
    accumulator+=dt;
    while(accumulator>=TICK){accumulator-=TICK;if(local.hp>0){const cmd={...input,seq:++seq,spawnId:local.spawnId};socket.volatile.emit('input',cmd);move(local,cmd,TICK,getMap(room.mapId).boxes);pending.push(cmd);if(pending.length>90)pending.shift();}}
    local.reload=Math.max(0,local.reload-dt);local.respawn=Math.max(0,local.respawn-dt);if(snapshot)snapshot.remaining=Math.max(0,snapshot.remaining-dt);
    if(locked&&input.shoot&&local.hp>0&&!local.reload&&(local.ammo.mag>0||local.weapon==='knife')){
      const w=WEAPONS[local.weapon];if(now>=fxAt&&(w.auto||!wasFiring)){graphics.localShot(local.weapon);sound.play(local.weapon);input.pitch=Math.min(1.48,input.pitch+w.recoil*(input.aim?.7:1));fxAt=now+w.interval*1000;}
    }
    wasFiring=input.shoot;
    if(local.hp>0&&local.grounded&&Math.hypot(local.vx,local.vz)>2&&now>stepAt){sound.play('step',{volume:local.crouch?.25:.7});stepAt=now+(input.run?300:400);}
    const decay=Math.exp(-15*dt);for(const a of ['x','y','z'])correction[a]*=decay;
  }
  graphics.render(dt,local?{...local,x:local.x+correction.x,y:local.y+correction.y,z:local.z+correction.z}:null,playing,input.aim&&locked);
  if(now>hudAt){updateHud(now);hudAt=now+80;}
  const hit=document.querySelector('#hitmarker');if(hit)hit.style.opacity=now<hitUntil?'1':'0';const hurt=document.querySelector('#damage-flash');if(hurt)hurt.style.opacity=now<hurtUntil?'.7':'0';
  requestAnimationFrame(frame);
}
showHome();materialsReady.then(()=>document.body.classList.add('materials-ready'));requestAnimationFrame(frame);
