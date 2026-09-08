import {getMap} from './maps.js';
export const TICK = 1 / 60;
export const MATCH_SECONDS = 600;
export const WEAPONS = {
  vektor: {name: 'Vektor AK', type: 'RIFLE', damage: 30, interval: .115, mag: 30, reserve: 120, reload: 2.4, recoil: .017, spread: .009, range: 100, auto: true, color: 0xb87543},
  sentinel: {name: 'Sentinel M4', type: 'RIFLE', damage: 25, interval: .09, mag: 30, reserve: 120, reload: 2.1, recoil: .012, spread: .006, range: 100, auto: true, color: 0x718075},
  breaker: {name: 'Breaker 12', type: 'SHOTGUN', damage: 15, interval: .85, mag: 8, reserve: 40, reload: 2.8, recoil: .05, spread: .075, pellets: 8, range: 30, auto: false, color: 0xb69a6d},
  longshot: {name: 'Longshot .308', type: 'SNIPER', damage: 85, interval: 1.35, mag: 5, reserve: 25, reload: 3, recoil: .055, spread: .027, range: 120, auto: false, color: 0x9da681},
  pistol: {name: 'Kestrel 9', type: 'PISTOL', damage: 24, interval: .23, mag: 15, reserve: 75, reload: 1.5, recoil: .022, spread: .012, range: 65, auto: false, color: 0x8b9391},
  knife: {name: 'Field knife', type: 'MELEE', damage: 55, interval: .55, mag: 0, reserve: 0, reload: 0, recoil: .02, spread: 0, range: 2.5, auto: false, color: 0xc3cdcc},
};
export const PRIMARIES = ['vektor', 'sentinel', 'breaker', 'longshot'];
// Original map geometry. The server and renderer share every solid collider.
export const BOXES = getMap('port').boxes;
export const SPAWNS = getMap('port').spawns;
export const eyeHeight = p => p.crouch ? 1.03 : 1.62;
export const playerHeight = p => p.crouch ? 1.25 : 1.85;
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export function direction(yaw,pitch) {return {x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};}
export function overlaps(p, box, h = playerHeight(p)) {
  return p.x + .32 > box.x-box.w/2 && p.x-.32 < box.x+box.w/2 && p.z+.32 > box.z-box.d/2 && p.z-.32 < box.z+box.d/2 && p.y+h > box.y-box.h/2+.001 && p.y < box.y+box.h/2-.001;
}
export function move(p,input,dt,boxes=BOXES) {
  const wasGrounded=p.grounded;
  p.yaw=input.yaw; p.pitch=input.pitch;
  if(input.crouch) p.crouch=true;
  else if(!boxes.some(b=>overlaps(p,b,1.85))) p.crouch=false;
  const speed=p.crouch?2.6:input.aim?3.3:input.run?7.5:5.2;
  let f=(input.forward?1:0)-(input.back?1:0), s=(input.right?1:0)-(input.left?1:0);
  const len=Math.hypot(f,s)||1; f/=len;s/=len;
  const tx=(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)*speed;
  const tz=(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)*speed;
  const accel=wasGrounded?Math.min(1,18*dt):Math.min(1,3*dt);
  p.vx+=(tx-p.vx)*accel;p.vz+=(tz-p.vz)*accel;
  if(input.jump && !p.jumpHeld && p.grounded){p.vy=7;p.grounded=false;}
  p.jumpHeld=!!input.jump;
  p.vy-=20*dt;
  for(const axis of ['x','z']) {
    const old=p[axis];p[axis]+=p[axis==='x'?'vx':'vz']*dt;
    const blocked=boxes.filter(b=>overlaps(p,b));
    if(blocked.length){
      const top=Math.max(...blocked.map(b=>b.y+b.h/2));
      const step={...p,y:top};
      if(wasGrounded&&top-p.y<=.3&&!boxes.some(b=>overlaps(step,b))){p.y=top;p.vy=0;}
      else{p[axis]=old;p[axis==='x'?'vx':'vz']=0;}
    }
  }
  const oldY=p.y;p.y+=p.vy*dt;p.grounded=false;
  for(const b of boxes) if(overlaps(p,b)){
    if(p.vy<=0 && oldY>=b.y+b.h/2-.06){p.y=b.y+b.h/2;p.grounded=true;}
    else p.y=oldY;
    p.vy=0;
  }
  if(p.y<=0){p.y=0;p.vy=0;p.grounded=true;}
  p.x=clamp(p.x,-31.6,31.6);p.z=clamp(p.z,-26.6,26.6);
}
export function rayBox(o,d,b) {
  let near=0, far=Infinity;
  for(const [axis,size] of [['x','w'],['y','h'],['z','d']]){
    const min=b[axis]-b[size]/2,max=b[axis]+b[size]/2;
    if(Math.abs(d[axis])<1e-8){if(o[axis]<min||o[axis]>max)return Infinity;continue;}
    let a=(min-o[axis])/d[axis],c=(max-o[axis])/d[axis];if(a>c)[a,c]=[c,a];near=Math.max(near,a);far=Math.min(far,c);
    if(near>far)return Infinity;
  }
  return near;
}
export function wallDistance(o,d,boxes=BOXES){return Math.min(d.y<0?-o.y/d.y:Infinity,...boxes.map(b=>rayBox(o,d,b)));}
export function emptyInput(){return {forward:false,back:false,left:false,right:false,jump:false,run:false,crouch:false,shoot:false,aim:false,yaw:0,pitch:0};}
