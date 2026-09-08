import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {getMap} from '../shared/maps.js';
import {box,cylinder,ellipsoid,joint,material,bake,disposeModel} from './models.js';
import {surface} from './materials.js';

const signage=new Map();
function sign(parent,text,x,y,z,rotation=0,width=3){
  if(!signage.has(text)){const c=document.createElement('canvas');c.width=512;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle='#283735';ctx.fillRect(0,0,512,192);ctx.fillStyle='#d0a768';ctx.fillRect(12,12,8,168);ctx.font='600 55px Arial';ctx.fillStyle='#e5e4d7';ctx.textAlign='center';ctx.fillText(text,265,98);ctx.font='19px monospace';ctx.fillStyle='#9daa9d';ctx.fillText('C R O S S L I N E   /   0 1',265,145);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;signage.set(text,new THREE.MeshStandardMaterial({map:t,roughness:.8}));}
  const m=box(parent,x,y,z,width,width*.375,.015,signage.get(text));m.rotation.y=rotation;
}
function rod(parent,a,b,r,mat){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const m=cylinder(parent,0,0,0,r,delta.length(),mat);m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
function tree(parent,x,z,seed,palm=false,snow=false){
  const g=joint(parent,x,0,z);g.userData.lodDetail=true;const bark=surface('wood',0x82765c),green=material(snow?0x748777:0x596e3b);
  cylinder(g,0,3.6,0,palm?.18:.27,7.2,bark,false,.12);
  if(palm){for(let i=0;i<9;i++){const a=i*2.4;for(let j=0;j<3;j++){const leaf=ellipsoid(g,Math.cos(a)*(j+.4),6.7-j*.15,Math.sin(a)*(j+.4),.85,.065,.35,green);leaf.rotation.y=-a;leaf.rotation.z=j*.18;}}}
  else for(let i=0;i<10;i++){const a=i*2.4+seed,r=1.2+Math.sin(i*3)*.7;ellipsoid(g,Math.cos(a)*r,5+Math.sin(i)*1.3,Math.sin(a)*r,1.25,1.8,1.25,green);if(snow)ellipsoid(g,Math.cos(a)*r,6.2+Math.sin(i)*1.3,Math.sin(a)*r,1.1,.45,1.1,surface('snow'));}
  bake(g);return g;
}
function car(parent,b,truck=false){
  const g=joint(parent,b.x,0,b.z);if(b.turn)g.rotation.y=Math.PI/2;const paint=surface('steel',truck?0x76805e:0x799093),tire=surface('rubber',0x515653),glass=material(0x293b41,.65),steel=surface('steel');
  const scale=truck?1.45:1;g.scale.setScalar(scale);
  box(g,0,.59,0,1.8,.48,4.25,paint,0,.16);box(g,0,1.02,-.15,1.56,.67,2.2,paint,0,.15);box(g,0,1.115,-1.12,1.4,.45,.05,glass,0,.03).rotation.x=.35;box(g,0,1.115,.96,1.4,.4,.05,glass,0,.03).rotation.x=-.3;
  for(const s of [-1,1]){for(const z of [-1.3,1.3]){const wheel=cylinder(g,s*.91,.38,z,.36,.22,tire);wheel.rotation.z=Math.PI/2;const hub=cylinder(g,s*1.025,.38,z,.18,.012,steel);hub.rotation.z=Math.PI/2;}box(g,s*.791,1.1,-.18,.016,.37,1.66,glass,0,.035);box(g,s*.81,1.1,-.18,.02,.5,.05,paint);box(g,s*.86,.88,.52,.04,.026,.17,steel);box(g,s*.96,.96,-.98,.19,.13,.22,paint,0,.04);box(g,s*.59,.68,-2.12,.38,.14,.04,material(0xe3d8a9,.2),0,.025);}
  box(g,0,.46,-2.16,1.7,.11,.1,steel,0,.025);box(g,0,.64,-2.13,.7,.15,.035,0x172121);for(let i=0;i<6;i++)box(g,-.3+i*.12,.64,-2.155,.02,.12,.015,steel);bake(g);
}
function crate(parent,b){const wood=surface('wood'),strap=surface('steel',0x807e68);box(parent,b.x,b.y,b.z,b.w,b.h,b.d,wood,0,.035);for(const s of [-1,1]){box(parent,b.x+s*b.w*.37,b.y,b.z,b.w*.065,b.h+.05,b.d+.07,strap);box(parent,b.x,b.y-b.h*.38,b.z+s*b.d/2,b.w,.09,.07,wood);}box(parent,b.x,b.y-b.h/2+.06,b.z,b.w+.05,.12,b.d+.05,wood);}
function container(parent,b){
  const paint=surface('steel',b.color??0x6b807c),rim=surface('gun',0xa0aa9a);box(parent,b.x,b.y,b.z,b.w,b.h,b.d,paint,0,.04);
  for(const s of [-1,1]){for(let x=-b.w/2+.2;x<b.w/2;x+=.3)box(parent,b.x+x,b.y,b.z+s*(b.d/2+.015),.065,b.h-.22,.035,paint,0,.008);for(let z=-b.d/2+.2;z<b.d/2;z+=.3)box(parent,b.x+s*(b.w/2+.015),b.y,b.z+z,.035,b.h-.22,.065,paint,0,.008);for(const y of [-1,1])box(parent,b.x,b.y+y*(b.h/2-.045),b.z+s*b.d/2,b.w+.04,.12,.09,rim);}
  for(const side of [-1,1]){box(parent,b.x+side*b.w*.22,b.y,b.z+b.d/2+.057,.027,b.h-.14,.027,rim);box(parent,b.x+side*b.w*.22+.08,b.y-.12,b.z+b.d/2+.075,.2,.025,.025,rim);}
  sign(parent,'CL / FREIGHT',b.x,b.y+.4,b.z+b.d/2+.11,0,Math.min(2.1,b.w*.65));
}
function building(parent,b,map,index){
  const surf=surface(b.surface||map.wall,0xffffff,Math.max(1,Math.round(Math.max(b.w,b.d)/3))),trim=surface('concrete',0xa9aa9c),glass=material(0x384e54,.7);
  box(parent,b.x,b.y,b.z,b.w,b.h,b.d,surf);box(parent,b.x,b.y+b.h/2-.1,b.z,b.w+.08,.2,b.d+.08,trim);box(parent,b.x,b.y-b.h/2+.35,b.z,b.w+.04,.7,b.d+.04,trim);
  const along=b.w>b.d,length=along?b.w:b.d;
  for(let offset=-length/2+1.2;offset<length/2-.6;offset+=2.5)for(const s of [-1,1]){
    const x=along?b.x+offset:b.x+s*(b.w/2+.025),z=along?b.z+s*(b.d/2+.025):b.z+offset;
    const frame=joint(parent,x,b.y+.1,z);if(!along)frame.rotation.y=Math.PI/2;
    box(frame,0,0,0,1.18,1.42,.08,surface('wood',0x7b8278),0,.018);box(frame,0,0,s*.046,.96,1.2,.016,glass);box(frame,0,-.035,s*.065,.035,1.22,.025,trim);box(frame,0,0,s*.065,1,.035,.025,trim);box(frame,0,-.74,s*.06,1.32,.085,.18,trim);
  }
  if(b.type==='building'){
    box(parent,b.x,b.y+b.h/2+.15,b.z,b.w+.3,.3,b.d+.3,trim);const roof=b.y+b.h/2+.3;box(parent,b.x+1,roof+.45,b.z,2,.9,1.5,surface('steel',0xa3aaa5),0,.08);for(let i=0;i<8;i++)box(parent,b.x+.2+i*.22,roof+.45,b.z+.76,.06,.55,.02,0x37433f);
    sign(parent,index%2?'DOCK WORKS':'SALT DEPOT',b.x,2.4,b.z+b.d/2+.09,0,3.5);
    cylinder(parent,b.x-b.w/2+.25,b.h/2,b.z+b.d/2+.1,.055,b.h,surface('steel',0x8b978d));
  }
}
export function buildWorld(scene,id='port'){
  const map=getMap(id),root=new THREE.Group();scene.add(root);scene.background=new THREE.Color(map.sky);scene.fog=new THREE.FogExp2(map.sky,map.id==='jungle'?.009:.004);
  const hemi=new THREE.HemisphereLight(map.id==='snow'?0xcce2ff:0xd0e2ed,map.id==='desert'?0xb89c73:0x7a8173,1.7);root.add(hemi);
  const sun=new THREE.DirectionalLight(map.sun,3);sun.position.set(...map.sunPos);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:130});sun.shadow.normalBias=.04;sun.shadow.bias=-.0001;root.add(sun);
  const sky=new Sky();sky.scale.setScalar(1000);sky.material.uniforms.sunPosition.value.set(...map.sunPos).multiplyScalar(10000);sky.material.uniforms.turbidity.value=map.id==='desert'?5:2;sky.material.uniforms.rayleigh.value=map.id==='snow'?1.5:2;sky.material.uniforms.mieCoefficient.value=.004;sky.userData.ownedGeometry=sky.userData.ownedMaterial=true;root.add(sky);
  const staticRoot=joint(root,0,0,0),details=joint(root,0,0,0),ground=surface(map.ground,0xffffff,28);
  box(staticRoot,0,-.25,0,66,.5,56,ground);box(staticRoot,0,-.7,0,230,.5,230,surface(map.ground,0xbac0b2,60));
  map.boxes.forEach((b,index)=>{
    if(['building','facade'].includes(b.type)){building(staticRoot,b,map,index);return;}
    if(b.type==='container'){container(staticRoot,b);return;}if(['crate','stall'].includes(b.type)){crate(staticRoot,b);if(b.type==='stall'){for(const s of [-1,1])cylinder(staticRoot,b.x+s*b.w/2,1.7,b.z,.035,3.4,0x796d55);box(staticRoot,b.x,3.2,b.z,b.w+.5,.07,b.d+.6,material(0x9d674c)).rotation.z=.08;}return;}
    if(['car','truck'].includes(b.type)){car(staticRoot,b,b.type==='truck');return;}
    if(b.type==='rock'){const m=ellipsoid(staticRoot,b.x,b.y,b.z,b.w/2,b.h/2,b.d/2,surface(map.id==='snow'?'snow':'stone'));m.rotation.y=index*.7;return;}
    if(b.type==='tank'){cylinder(staticRoot,b.x,b.y,b.z,b.w/2,b.h,surface('steel',0xb0b6af));ellipsoid(staticRoot,b.x,b.h,b.z,b.w/2,.7,b.w/2,surface('steel',0xb0b6af));for(const y of [1,b.h-1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(b.w/2+.03,.05,6,32),surface('gun'));ring.rotation.x=Math.PI/2;ring.position.set(b.x,y,b.z);ring.userData.ownedGeometry=true;staticRoot.add(ring);}continueTank(staticRoot,b);return;}
    if(b.type==='sandbag'){for(let row=0;row<Math.ceil(b.h/.3);row++)for(let x=-b.w/2+.4;x<b.w/2;x+=.8)box(staticRoot,b.x+x+(row%2?.15:0),.15+row*.3,b.z,.85,.31,b.d,surface('fabric',0xb9b18a),0,.12);return;}
    if(b.type==='fountain'){box(staticRoot,b.x,.4,b.z,b.w,.8,b.d,surface('stone'),0,.18);box(staticRoot,b.x,.82,b.z,b.w-.3,.03,b.d-.3,material(0x648f90,.65));cylinder(staticRoot,b.x,1,b.z,.4,.6,surface('stone'));return;}
    if(b.type==='planter'){box(staticRoot,b.x,b.y,b.z,b.w,b.h,b.d,surface('concrete'),0,.07);box(staticRoot,b.x,b.h+.01,b.z,b.w-.22,.05,b.d-.22,0x514a38);for(let i=0;i<6;i++)ellipsoid(details,b.x+Math.sin(i*8)*b.w*.3,b.h+.28,b.z+Math.cos(i*8)*b.d*.3,.5,.35,.4,material(0x697a44));return;}
    if(b.type==='machine'){box(staticRoot,b.x,b.y,b.z,b.w,b.h,b.d,surface('steel',0x738e85),0,.13);for(let i=0;i<8;i++)box(staticRoot,b.x-b.w*.35+i*.4,b.y,b.z+b.d/2+.015,.08,b.h*.7,.025,0x263b37);sign(staticRoot,'CAUTION',b.x,b.h-.3,b.z+b.d/2+.06,0,1.2);return;}
    if(b.type==='desk'||b.type==='bench'){box(staticRoot,b.x,b.h-.08,b.z,b.w,.16,b.d,surface('wood'),0,.045);for(const s of [-1,1])box(staticRoot,b.x+s*(b.w/2-.2),b.h/2,b.z,.15,b.h,b.d*.8,surface('steel'));if(b.type==='desk'){box(staticRoot,b.x,b.h+.15,b.z,.75,.45,.08,0x29393c,0,.025);box(staticRoot,b.x,b.h+.05,b.z,.7,.05,.2,0x526467);}return;}
    const surf=surface(b.surface||(['wall','roof','step','barrier','lintel','arch','partition'].includes(b.type)?map.wall:'concrete'));
    box(staticRoot,b.x,b.y,b.z,b.w,b.h,b.d,surf,0,b.type==='barrier'?.07:0);
    if(b.type==='wall')box(staticRoot,b.x,b.y+b.h/2+.08,b.z,b.w+.06,.16,b.d+.06,surface('stone',0xb4b3a3));
  });
  if(map.id==='port'||map.id==='factory'){
    for(const x of [-29,29]){for(const z of [-20,20]){rod(staticRoot,[x,0,z],[x,12,z],.13,surface('steel',0xbca064));rod(staticRoot,[x,8,z],[x,12,z-Math.sign(z)*4],.08,surface('steel',0xbca064));}box(staticRoot,x,12,0,.4,.65,46,surface('steel',0xbca064));rod(staticRoot,[x,12,-12],[x,5,-12],.025,0x454c48);}
    for(const x of [-28,-9,9,28])for(let z=-24;z<25;z+=4)box(staticRoot,x,.009,z,.09,.01,2,0xc7b77b);
  }
  if(map.id==='urban'){box(staticRoot,0,.007,0,12,.01,53,surface('asphalt',0xaab1b3,20));for(let z=-25;z<25;z+=5)for(const x of [-.18,.18])box(staticRoot,x,.018,z,.09,.01,2.5,0xc4b784);for(const x of [-7,7])box(staticRoot,x,.08,0,1.5,.16,52,surface('concrete',0xc4c2b6,20));}
  const lamps=map.id==='office'?[[-8,-4],[8,4],[-25,0],[25,0]]:[[-29,-21],[29,21],[-29,3],[29,-3]];
  for(const [x,z] of lamps){cylinder(staticRoot,x,2.7,z,.055,5.4,0x495853);rod(staticRoot,[x,5.4,z],[x+.9,5.4,z],.035,0x495853);box(staticRoot,x+.8,5.35,z,.65,.14,.32,0x657670,0,.05);const lightMat=new THREE.MeshStandardMaterial({color:0xffebc9,emissive:0xffd391,emissiveIntensity:2});box(staticRoot,x+.8,5.26,z,.5,.025,.22,lightMat);}
  if(map.id==='desert'||map.id==='jungle'||map.id==='snow'||map.id==='urban')for(let i=0;i<18;i++){const x=Math.sin(i*2.4)*42,z=Math.cos(i*2.4)*38;tree(details,x,z,i,map.id==='desert',map.id==='snow');}
  if(map.id==='jungle')for(let i=0;i<25;i++){const x=Math.sin(i*4.7)*30,z=Math.cos(i*6.1)*25;if(!map.boxes.some(b=>Math.abs(x-b.x)<b.w/2+.5&&Math.abs(z-b.z)<b.d/2+.5))ellipsoid(details,x,.13,z,.35,.18,.3,material(0x687e3f));}
  // Distant architecture stays outside the authoritative arena boundary.
  for(let i=0;i<16;i++){const x=Math.sin(i*2.31)*68,z=Math.cos(i*2.31)*68;if(['jungle','snow','desert'].includes(map.id))ellipsoid(staticRoot,x,-1,z,16,9+i%4*3,13,surface(map.id==='snow'?'snow':'stone',0xa7b1a0));else{const h=8+i%5*5;box(staticRoot,x,h/2-1,z,8+i%3*3,h,9,surface('concrete',0x9ca8a4,3));for(let y=3;y<h;y+=3)box(staticRoot,x,y,z+4.51,6,.9,.02,0x61716e);}}
  for(const z of [-27.8,27.8]){for(let x=-30;x<=30;x+=6)cylinder(staticRoot,x,4.6,z,.035,1.3,0x5a665e);for(let y=4.2;y<5.1;y+=.23)rod(staticRoot,[-32,y,z],[32,y,z],.009,0x5a665e);}
  for(const x of [-18,18]){
    rod(details,[x,6,-24],[x,5.2,0],.015,0x39473f);rod(details,[x,5.2,0],[x,6,24],.015,0x39473f);
    // Utility runs and litter fit against the arena perimeter, out of the firing lanes.
    for(let i=0;i<3;i++)rod(staticRoot,[x+i*.13,.25,26.5],[x+i*.13,2.8,26.5],.037,surface('steel',0x8d988a));
  }
  for(let i=0;i<34;i++){const x=Math.sin(i*5.17)*30,z=Math.cos(i*3.71)*25;if(map.boxes.some(b=>Math.abs(x-b.x)<b.w/2+.2&&Math.abs(z-b.z)<b.d/2+.2))continue;const litter=box(details,x,.022,z,.12+i%3*.07,.01,.15,material(i%2?0x8b8c77:0xc6c3ad));litter.rotation.y=i*1.1;}
  if(['factory','office'].includes(map.id))for(const [x,z] of [[-18,-9],[18,9]]){const light=new THREE.PointLight(map.id==='office'?0xd6f2ff:0xffd19a,65,14,2);light.position.set(x,3.5,z);root.add(light);box(staticRoot,x,3.6,z,2,.06,.35,material(0xdce5d8));}
  sign(staticRoot,map.name.toUpperCase(),0,2.7,26.94,Math.PI,6);
  // Spatial chunks retain frustum culling. Identical repeated meshes use instancing.
  const batches=new Map();staticRoot.updateMatrixWorld(true);
  staticRoot.traverse(m=>{if(!m.isMesh)return;const p=new THREE.Vector3().setFromMatrixPosition(m.matrixWorld),key=`${m.geometry.uuid}/${m.material.uuid}/${Math.floor(p.x/12)}/${Math.floor(p.z/12)}`;const list=batches.get(key)||[];list.push(m);batches.set(key,list);});
  for(const meshes of batches.values())if(meshes.length>2){const first=meshes[0],inst=new THREE.InstancedMesh(first.geometry,first.material,meshes.length);meshes.forEach((m,i)=>{inst.setMatrixAt(i,m.matrixWorld);m.parent.remove(m);});inst.castShadow=inst.receiveShadow=true;inst.computeBoundingSphere();root.add(inst);}
  return {root,sun,details,map,dispose(){root.traverse(m=>{if(m.isLight)m.shadow?.map?.dispose();});disposeModel(root);scene.remove(root);}};
}
function continueTank(parent,b){for(let y=.3;y<b.h;y+=.35)rod(parent,[b.x+b.w/2+.08,y,b.z-.28],[b.x+b.w/2+.08,y,b.z+.28],.025,0x66736c);for(const s of [-1,1])rod(parent,[b.x+b.w/2+.08,0,b.z+s*.28],[b.x+b.w/2+.08,b.h+.5,b.z+s*.28],.025,0x66736c);}
