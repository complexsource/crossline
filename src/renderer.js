import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildWorld} from './world.js';
import {makeGun,makePlayer,makeGrenade,material,radialTexture,animateGun,animatePlayer,disposeModel} from './models.js';
import {WEAPONS,eyeHeight} from '../shared/game.js';
export const QUALITY={low:{dpr:.85,shadow:0,particles:45,detail:24},medium:{dpr:1,shadow:1024,particles:100,detail:42},high:{dpr:1.5,shadow:2048,particles:180,detail:65},ultra:{dpr:2,shadow:4096,particles:260,detail:95}};
export class Renderer {
  constructor(canvas){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.info.autoReset=false;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(78,1,.06,190);this.camera.rotation.order='YXZ';this.scene.add(this.camera);
    this.gunCamera=new THREE.PerspectiveCamera(60,1,.025,10);this.gunCamera.layers.set(1);this.viewScene=new THREE.Scene();this.viewScene.add(new THREE.HemisphereLight(0xd9e9ff,0x756951,2));const light=new THREE.DirectionalLight(0xffebc6,3);light.position.set(-2,4,1);this.viewScene.add(light);this.viewScene.traverse(o=>o.layers.enable(1));
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.viewScene.environment=this.environment.texture;this.scene.environmentIntensity=.35;this.viewScene.environmentIntensity=.7;room.dispose();pmrem.dispose();
    this.players=new Map();this.grenades=new Map();this.effects=[];this.previews=new Map();this.time=0;this.flashUntil=0;this.kick=0;this.weapon='';this.spawnId=0;this.quality='high';try{this.quality=localStorage.getItem('crossline-quality')||'high';}catch{}if(!QUALITY[this.quality])this.quality='high';
    this.particleGeometry=new THREE.SphereGeometry(.05,6,4);this.casingGeometry=new THREE.CylinderGeometry(.018,.018,.07,6);this.decalGeometry=new THREE.PlaneGeometry(.16,.16);
    this.setMap('port');this.onResize=()=>this.resize();window.addEventListener('resize',this.onResize);this.setQuality(this.quality);
  }
  resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.gunCamera.aspect=w/h;this.gunCamera.updateProjectionMatrix();}
  setQuality(preset){if(!QUALITY[preset])preset='high';this.quality=preset;this.settings=QUALITY[preset];try{localStorage.setItem('crossline-quality',preset);}catch{}this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.settings.dpr));this.renderer.shadowMap.enabled=!!this.settings.shadow;if(this.world){const s=this.world.sun.shadow;s.map?.dispose();s.map=null;s.mapSize.set(this.settings.shadow||512,this.settings.shadow||512);}this.resize();}
  setMap(id){if(this.mapId===id)return;this.clearPlayers();this.clearEffects();this.world?.dispose();this.mapId=id;this.world=buildWorld(this.scene,id);if(this.settings)this.setQuality(this.quality);}
  clearPlayers(){for(const m of this.players?.values()||[]){this.scene.remove(m);m.userData.labelTexture.dispose();m.userData.label.material.dispose();disposeModel(m);}this.players?.clear();for(const m of this.grenades?.values()||[]){this.scene.remove(m);disposeModel(m);}this.grenades?.clear();}
  clearEffects(){for(const e of this.effects||[])this.removeEffect(e);if(this.effects)this.effects.length=0;}
  preview(){this.menuCamera();this.renderer.render(this.scene,this.camera);const c=document.createElement('canvas');c.width=640;c.height=360;c.getContext('2d').drawImage(this.renderer.domElement,0,0,640,360);return c.toDataURL('image/webp',.78);}
  menuCamera(){this.camera.fov=55;this.camera.updateProjectionMatrix();this.camera.position.set(34,27,37);this.camera.lookAt(0,0,-2);}
  setWeapon(id){if(id===this.weapon)return;this.weapon=id;if(this.gun){this.viewScene.remove(this.gun);disposeModel(this.gun);}this.gun=makeGun(id,true);this.viewScene.add(this.gun);}
  localShot(id){this.kick=1;this.flashUntil=this.time+.055;if(this.gun)this.gun.userData.flash.rotation.z=Math.random()*Math.PI;if(id!=='knife'){const p=this.camera.position.clone().add(new THREE.Vector3(.25,-.17,-.55).applyQuaternion(this.camera.quaternion));this.casing(p,this.camera.rotation.y);}}
  sync(state,id){
    const ids=new Set();for(const p of state.players){if(p.id===id)continue;ids.add(p.id);let mesh=this.players.get(p.id);if(!mesh){mesh=makePlayer(p.name,p.team);mesh.position.set(p.x,p.y,p.z);this.players.set(p.id,mesh);this.scene.add(mesh);}const u=mesh.userData;
      if(!u.state||u.state.spawnId!==p.spawnId){mesh.position.set(p.x,p.y,p.z);u.death=0;u.body.rotation.set(0,0,0);}u.previous=u.state?{x:mesh.position.x,y:mesh.position.y,z:mesh.position.z,yaw:mesh.rotation.y}:p;u.state=p;u.received=this.time;
      if(p.weapon!==u.weapon){if(u.gun){u.weaponPivot.remove(u.gun);disposeModel(u.gun);}u.gun=makeGun(p.weapon);u.weaponPivot.add(u.gun);u.weapon=p.weapon;}}
    for(const [key,m] of this.players)if(!ids.has(key)){this.scene.remove(m);m.userData.labelTexture.dispose();m.userData.label.material.dispose();disposeModel(m);this.players.delete(key);}
    const gs=new Set();for(const g of state.grenades){gs.add(g.id);let mesh=this.grenades.get(g.id);if(!mesh){mesh=makeGrenade();this.scene.add(mesh);this.grenades.set(g.id,mesh);}mesh.position.set(g.x,g.y,g.z);mesh.rotation.set(this.time*5,this.time*3,0);}for(const [key,m] of this.grenades)if(!gs.has(key)){this.scene.remove(m);disposeModel(m);this.grenades.delete(key);}
  }
  addEffect(mesh,life,extra={}){if(this.effects.length>=this.settings.particles){const e=this.effects.shift();this.removeEffect(e);}this.scene.add(mesh);this.effects.push({mesh,life,max:life,...extra});}
  removeEffect(e){this.scene.remove(e.mesh);if(e.dispose)e.mesh.geometry.dispose();if(!e.sharedMaterial)e.mesh.material?.dispose();}
  smoke(pos,size=.2,life=.7){if(this.quality==='low')return;const mesh=new THREE.Sprite(new THREE.SpriteMaterial({map:radialTexture('smoke'),color:0xaaa99d,transparent:true,opacity:.25,depthWrite:false}));mesh.position.set(pos.x,pos.y,pos.z);mesh.scale.setScalar(size);this.addEffect(mesh,life,{smoke:true,v:new THREE.Vector3(0,.35,0),opacity:.25});}
  casing(pos,yaw){const mesh=new THREE.Mesh(this.casingGeometry,material(0xb8a05f,.8));mesh.position.copy(pos);mesh.rotation.set(1,1,1);this.addEffect(mesh,1.1,{sharedMaterial:true,casing:true,v:new THREE.Vector3(Math.cos(yaw)*1.6,1.2,-Math.sin(yaw)*1.6)});}
  fx(event,localId){
    if(event.type==='shot'){
      const mesh=this.players.get(event.id);if(mesh)mesh.userData.flashAt=this.time+.08;
      for(const end of event.ends){
        const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(event.origin.x,event.origin.y,event.origin.z),new THREE.Vector3(end.x,end.y,end.z)]);const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xffd4a0,transparent:true,opacity:.4}));this.addEffect(line,.045,{dispose:true});
        if(end.normal){const decal=new THREE.Mesh(this.decalGeometry,new THREE.MeshBasicMaterial({map:radialTexture('impact'),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));const n=new THREE.Vector3(end.normal.x,end.normal.y,end.normal.z);decal.position.set(end.x,end.y,end.z).addScaledVector(n,.015);decal.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);decal.rotateZ(Math.random()*6);this.addEffect(decal,12,{decal:true});for(let i=0;i<3;i++)this.particle(end,0xd2c3a4,.22,1.2);this.smoke(end,.23,.7);}
      }
      if(event.weapon!=='knife'){this.smoke(event.origin,.2,.5);if(mesh)this.casing(new THREE.Vector3(event.origin.x,event.origin.y-.2,event.origin.z),mesh.rotation.y);}
    }
    if(event.type==='explosion'){for(let i=0;i<(this.quality==='low'?15:40);i++)this.particle(event,i%3===0?0x6b6b60:i%2?0xffbb52:0xe66b2f,.5+Math.random()*.5,8);for(let i=0;i<8;i++)this.smoke({x:event.x+(Math.random()-.5)*2,y:event.y+Math.random(),z:event.z+(Math.random()-.5)*2},2,2.3);const light=new THREE.PointLight(0xffa533,45,12);light.position.set(event.x,event.y+.5,event.z);this.addEffect(light,.25);}
  }
  particle(pos,color,life,speed){const mesh=new THREE.Mesh(this.particleGeometry,new THREE.MeshBasicMaterial({color,transparent:true}));mesh.position.set(pos.x,pos.y,pos.z);mesh.scale.setScalar(speed>2?1+Math.random()*4:.6);this.addEffect(mesh,life,{v:new THREE.Vector3((Math.random()-.5)*speed,Math.random()*speed,(Math.random()-.5)*speed)});}
  render(dt,local,playing,aim){
    this.renderer.info.reset();this.time+=dt;const t=this.time;this.kick*=Math.exp(-15*dt);for(const p of this.players.values())p.visible=playing;
    if(playing&&local){
      this.camera.position.set(local.x,local.y+eyeHeight(local)+(local.hp>0?Math.sin(t*11)*Math.min(.022,Math.hypot(local.vx,local.vz)*.004):-.5),local.z);this.camera.rotation.set(local.pitch,local.yaw,local.hp>0?0:.2,'YXZ');
      const fov=aim&&local.hp>0?(local.weapon==='longshot'?23:55):78;this.camera.fov+=(fov-this.camera.fov)*Math.min(1,dt*14);this.camera.updateProjectionMatrix();this.setWeapon(local.weapon);const bob=Math.sin(t*9)*Math.min(.012,Math.hypot(local.vx,local.vz)*.002),reload=local.reload>0?Math.sin(Math.min(1,local.reload/WEAPONS[local.weapon].reload)*Math.PI):0;
      this.gun.scale.setScalar(.85);this.gun.position.set(aim?.008:.25,aim?-.11:-.25+bob-reload*.14,-.83+this.kick*.05);this.gun.rotation.set(this.kick*.1-reload*.45,0,reload*.55);this.gun.visible=local.hp>0&&!(aim&&local.weapon==='longshot');this.gun.userData.flash.visible=this.flashUntil>t&&local.weapon!=='knife';animateGun(this.gun,local.weapon,local.reload,this.kick);
    }else this.menuCamera();
    for(const m of this.players.values()){
      const u=m.userData,p=u.state;if(!p)continue;const alpha=Math.min(1,(t-u.received)/.075);m.position.set(THREE.MathUtils.lerp(u.previous.x,p.x,alpha),THREE.MathUtils.lerp(u.previous.y,p.y,alpha),THREE.MathUtils.lerp(u.previous.z,p.z,alpha));let diff=p.yaw-m.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));m.rotation.y+=diff*Math.min(1,dt*20);animatePlayer(m,p,t,dt);
      // Distant opponents retain their silhouette; only their costly tiny gear is culled.
      const distance=m.position.distanceTo(this.camera.position);for(const part of u.lodMeshes)part.geometry=distance>(this.quality==='low'?10:24)?part.userData.lowGeometry:part.userData.highGeometry;u.gun.visible=distance<this.settings.detail;u.label.visible=p.hp>0&&distance<35;
    }
    for(const detail of this.world.details.children){const d=detail.position.distanceTo(this.camera.position);detail.visible=d<this.settings.detail+(playing?0:40);}
    for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;if(e.life<=0){this.removeEffect(e);this.effects.splice(i,1);}else{if(e.v){if(!e.smoke)e.v.y-=9*dt;e.mesh.position.addScaledVector(e.v,dt);if(e.casing){e.mesh.rotation.x+=dt*15;if(e.mesh.position.y<.04){e.mesh.position.y=.04;e.v.multiplyScalar(.4);e.v.y=Math.abs(e.v.y);}}}if(e.smoke)e.mesh.scale.multiplyScalar(1+dt*.9);if(e.mesh.material&&!e.sharedMaterial)e.mesh.material.opacity=e.decal?Math.min(1,e.life/2):(e.opacity??1)*e.life/e.max;if(e.mesh.isPointLight)e.mesh.intensity=45*e.life/e.max;}}
    this.renderer.autoClear=true;this.renderer.render(this.scene,this.camera);if(playing&&local?.hp>0){this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.viewScene,this.gunCamera);this.renderer.autoClear=true;}
  }
}
