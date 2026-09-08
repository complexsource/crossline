// All map solids are authoritative: rendering and prediction use these same layouts.
const B=(x,y,z,w,h,d,type='wall',extra={})=>({x,y,z,w,h,d,type,...extra});
const boundary=()=>[B(0,2,-28,66,4,2),B(0,2,28,66,4,2),B(-33,2,0,2,4,58),B(33,2,0,2,4,58)];
const spawns=()=>({red:[{x:-28,z:22},{x:-28,z:12},{x:-28,z:5},{x:-12,z:25},{x:-5,z:24}],blue:[{x:28,z:-22},{x:28,z:-12},{x:28,z:-5},{x:12,z:-25},{x:5,z:-24}]});
// Walk-through buildings: two wide entrances, windows and an accessible flat roof.
function house(x,z,w=10,d=9,h=4.2,surface='plaster'){
  const e={surface},a=[B(x,h/2,z-d/2,w,h,.45,'facade',e),B(x,h/2,z+d/2,w,h,.45,'facade',e)];
  for(const s of [-1,1]){
    a.push(B(x+s*w/2,h/2,z-d/2+(d-3)/4,.45,h,(d-3)/2,'facade',e),B(x+s*w/2,h/2,z+d/2-(d-3)/4,.45,h,(d-3)/2,'facade',e));
    a.push(B(x+s*w/2,3.5,z,.45,1.4,3,'lintel',e));
  }
  a.push(B(x,h+.12,z,w+.3,.24,d+.3,'roof',e));
  return a;
}
function stairs(x,z,h=4.32){return Array.from({length:16},(_,i)=>B(x,(i+1)*h/32,z+i*.42,2.2,(i+1)*h/16,.42,'step'));}
const crate=(x,z,h=1.4)=>B(x,h/2,z,2,h,2,'crate');
const container=(x,z,w=9,d=3,color=0x557474)=>B(x,1.6,z,w,3.2,d,'container',{color});
const car=(x,z,turn=false)=>B(x,.75,z,turn?4.6:2,1.5,turn?2:4.6,'car',{turn});
const MAP_DEFS=[
  {id:'desert',name:'Saffron Quarter',category:'DESERT CITY',recommended:'4–8',tagline:'Sunlit courtyards · market alleys · rooftop angles',ground:'sand',wall:'plaster',sky:0xb7ccce,sun:0xffd5a1,sunPos:[-22,38,25],accent:'#d6a260',boxes:[...house(-18,-9),...house(18,9),...house(13,-18,14,7),...house(-13,18,14,7),...stairs(-24,-15),...stairs(24,3),B(0,.65,0,4,1.3,4,'fountain'),B(-4,1.7,-9,.6,3.4,10,'arch'),B(4,1.7,9,.6,3.4,10,'arch'),crate(-14,2),crate(14,-2),B(4,.6,-16,3,1.2,2,'stall'),B(-4,.6,16,3,1.2,2,'stall')]},
  {id:'factory',name:'Ironworks',category:'INDUSTRIAL FACTORY',recommended:'6–10',tagline:'Brick workshops · steam plant · loading lanes',ground:'asphalt',wall:'brick',sky:0xb2bbc0,sun:0xf1d9b8,sunPos:[-30,26,-18],accent:'#b58c67',boxes:[...house(-18,-8,11,13,5,'brick'),...house(18,8,11,13,5,'brick'),B(0,2.5,0,5,5,5,'tank'),container(-6,-17),container(6,17),B(-5,1,6,5,2,2,'machine'),B(5,1,-6,5,2,2,'machine'),crate(-17,15),crate(17,-15),B(-1,1.2,-9,1,2.4,5,'barrier'),B(1,1.2,9,1,2.4,5,'barrier')]},
  {id:'military',name:'Forward Station',category:'MILITARY BASE',recommended:'4–10',tagline:'Barracks · armored cover · observation decks',ground:'concrete',wall:'concrete',sky:0x9fbacb,sun:0xffedce,sunPos:[20,44,-25],accent:'#9aa57e',boxes:[...house(-18,-9,12,9,4.2,'concrete'),...house(18,9,12,9,4.2,'concrete'),...stairs(-25,-14),...stairs(25,4),B(0,1.2,0,5,2.4,7,'truck'),B(-4,.8,-12,8,1.6,1,'sandbag'),B(4,.8,12,8,1.6,1,'sandbag'),container(16,-18),container(-16,18),crate(-14,3),crate(14,-3)]},
  {id:'urban',name:'Meridian Street',category:'URBAN STREETS',recommended:'4–8',tagline:'A divided boulevard · storefronts · side passages',ground:'asphalt',wall:'brick',sky:0xc4b9b7,sun:0xffc998,sunPos:[-28,18,28],accent:'#ce9881',boxes:[...house(-18,-10,12,12,6,'brick'),...house(18,10,12,12,6,'brick'),...house(17,-19,14,6,5),...house(-17,19,14,6,5),car(-3,-9),car(3,9,true),car(12,-3),car(-12,3),B(0,.8,0,3,1.6,3,'planter'),B(-6,.55,17,5,1.1,1.2,'planter'),B(6,.55,-17,5,1.1,1.2,'planter')]},
  {id:'port',name:'Salt Yard',category:'WAREHOUSE PORT',recommended:'2–10',tagline:'Freight stacks · dock cranes · warehouse crossfire',ground:'concrete',wall:'plaster',sky:0xb5cbd4,sun:0xffe0b0,sunPos:[-25,42,22],accent:'#7caeac',boxes:[B(-18,3.5,-10,12,7,12,'building'),B(18,3.5,10,12,7,12,'building'),B(17,2.8,-19,18,5.6,6,'building'),B(-17,2.8,19,18,5.6,6,'building'),container(-5,-7,3,10,0xa7553e),container(5,7,3,10,0x427e83),container(8,-7,10,3,0x697f64),container(-8,7,10,3,0xbca060),B(0,.7,0,4,1.4,3,'crate'),B(-24,1,3,3,2,3,'crate'),B(24,1,-3,3,2,3,'crate'),B(-13,.7,1,2.5,1.4,2.5,'crate'),B(13,.7,-1,2.5,1.4,2.5,'crate'),B(-25,1.2,-21,7,2.4,1,'barrier'),B(25,1.2,21,7,2.4,1,'barrier'),B(0,1,-20,1.5,2,7,'barrier'),B(0,1,20,1.5,2,7,'barrier')]},
  {id:'snow',name:'Whiteout Relay',category:'SNOW BASE',recommended:'4–8',tagline:'Frozen service roads · relay huts · exposed flanks',ground:'snow',wall:'steel',sky:0xc8d9e3,sun:0xe4f1ff,sunPos:[18,24,20],accent:'#afcfdf',boxes:[...house(-17,-10,11,10,4.2,'steel'),...house(17,10,11,10,4.2,'steel'),container(-10,16,11,3,0x55728a),container(10,-16,11,3,0x657b8e),B(0,1.4,0,4,2.8,5,'rock'),B(-4,1,-9,3,2,3,'rock'),B(4,1,9,3,2,3,'rock'),B(-20,.9,5,5,1.8,2,'sandbag'),B(20,.9,-5,5,1.8,2,'sandbag'),crate(-3,18),crate(3,-18)]},
  {id:'jungle',name:'Canopy Outpost',category:'JUNGLE COMPOUND',recommended:'4–10',tagline:'Overgrown compound · timber shelters · stone cover',ground:'grass',wall:'stone',sky:0x9eaea1,sun:0xf1e3ad,sunPos:[-12,50,12],accent:'#92af73',boxes:[...house(-18,-9,10,11,4.2,'wood'),...house(18,9,10,11,4.2,'wood'),B(0,1.4,0,5,2.8,4,'rock'),B(-5,1.7,9,3,3.4,4,'rock'),B(5,1.7,-9,3,3.4,4,'rock'),container(-12,18,8,3,0x5b6950),container(12,-18,8,3,0x5b6950),B(-17,.9,6,6,1.8,1,'sandbag'),B(17,.9,-6,6,1.8,1,'sandbag'),crate(-6,-17),crate(6,17)]},
  {id:'office',name:'Atrium Nine',category:'OFFICE COMPLEX',recommended:'2–6',tagline:'Open-air atrium · furnished suites · tight corridors',ground:'tile',wall:'plaster',sky:0xa7c2d1,sun:0xffeccd,sunPos:[22,40,18],accent:'#9fc5bf',boxes:[...house(-18,-10,12,12,4.2),...house(18,10,12,12,4.2),...house(-15,18,17,6,4.2),...house(15,-18,17,6,4.2),B(0,.7,0,5,1.4,4,'planter'),B(-5,1.3,-8,.4,2.6,12,'partition'),B(5,1.3,8,.4,2.6,12,'partition'),B(-18,.75,-10,5,1.5,1.5,'desk'),B(18,.75,10,5,1.5,1.5,'desk'),B(-10,.5,7,4,1,1.3,'bench'),B(10,.5,-7,4,1,1.3,'bench')]},
];
export const MAPS=MAP_DEFS.map(m=>({...m,boxes:[...boundary(),...m.boxes],spawns:spawns()}));
export const getMap=id=>MAPS.find(m=>m.id===id)||MAPS.find(m=>m.id==='port');
export const validMap=id=>MAPS.some(m=>m.id===id);
