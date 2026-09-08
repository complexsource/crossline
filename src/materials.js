import * as THREE from 'three';
const tiles={concrete:0,brick:1,asphalt:2,gun:3,fabric:4,leather:5,steel:6,wood:7,sand:8,grass:9,snow:10,tile:11,camo:12,rubber:13,stone:14,plaster:15};
const pending=[],cache=new Map();let source=null;
export const materialsReady=new Promise(resolve=>{const img=new Image();img.onload=()=>{source=img;pending.forEach(fn=>fn());pending.length=0;resolve(true);};img.onerror=()=>resolve(false);img.src='/textures/material-atlas.webp';});
// Original generated albedo; height-derived normals and roughness are approximations.
export function surface(kind='concrete',color=0xffffff,repeat=1){
  const key=`${kind}/${color}/${repeat}`;if(cache.has(key))return cache.get(key);
  const metal=['gun','steel'].includes(kind),mat=new THREE.MeshStandardMaterial({color,metalness:metal?.78:0,roughness:metal?.52:.95});cache.set(key,mat);
  const populate=()=>{
    const n=256,i=tiles[kind]??0,c=document.createElement('canvas');c.width=c.height=n;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,(i%4)*source.width/4,Math.floor(i/4)*source.height/4,source.width/4,source.height/4,0,0,n,n);
    const albedo=new THREE.CanvasTexture(c);albedo.colorSpace=THREE.SRGBColorSpace;
    const pixels=ctx.getImageData(0,0,n,n).data,normal=new Uint8Array(n*n*4),rough=new Uint8Array(n*n*4);
    const gray=(x,y)=>{const k=(((y+n)%n)*n+(x+n)%n)*4;return (pixels[k]+pixels[k+1]+pixels[k+2])/765;};
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){const k=(y*n+x)*4,v=new THREE.Vector3((gray(x-1,y)-gray(x+1,y))*1.4,(gray(x,y-1)-gray(x,y+1))*1.4,1).normalize();normal[k]=(v.x*.5+.5)*255;normal[k+1]=(v.y*.5+.5)*255;normal[k+2]=(v.z*.5+.5)*255;normal[k+3]=255;rough[k]=rough[k+1]=rough[k+2]=(metal?.45+gray(x,y)*.35:.75+gray(x,y)*.23)*255;rough[k+3]=255;}
    const nt=new THREE.DataTexture(normal,n,n),rt=new THREE.DataTexture(rough,n,n);nt.needsUpdate=rt.needsUpdate=true;nt.generateMipmaps=rt.generateMipmaps=true;nt.minFilter=rt.minFilter=THREE.LinearMipmapLinearFilter;
    for(const tex of [albedo,nt,rt]){tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(repeat,repeat);tex.anisotropy=4;}
    mat.map=albedo;mat.normalMap=nt;mat.roughnessMap=rt;mat.normalScale.setScalar(metal?.3:.6);mat.needsUpdate=true;
  };if(source)populate();else pending.push(populate);return mat;
}
