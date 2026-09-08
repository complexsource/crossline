export class Sound {
  constructor(){this.ctx=null;this.volume=.45;}
  async unlock(){
    if(!this.ctx){
      this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.master.connect(this.ctx.destination);
      this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      const wind=this.ctx.createBufferSource();wind.buffer=this.noise;wind.loop=true;const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=180;const gain=this.ctx.createGain();gain.gain.value=.035;wind.connect(filter).connect(gain).connect(this.master);wind.start();
    }
    if(this.ctx.state==='suspended')await this.ctx.resume();
  }
  play(type,{volume=1,pan=0,weapon='sentinel'}={}){
    const c=this.ctx;if(!c||c.state!=='running')return;const t=c.currentTime;
    const gain=c.createGain(),stereo=c.createStereoPanner();stereo.pan.value=pan;gain.connect(stereo).connect(this.master);
    const shot=['vektor','sentinel','pistol','breaker','longshot'].includes(type);
    const duration=type==='explosion'?.8:shot?.16:type==='knife'?.12:.07;
    gain.gain.setValueAtTime(volume*(type==='step'?.12:shot?.55:.35),t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
    const noise=c.createBufferSource();noise.buffer=this.noise;const filter=c.createBiquadFilter();filter.type=type==='step'?'lowpass':'bandpass';filter.frequency.value=type==='explosion'?180:type==='reload'?1800:type==='knife'?2400:shot?({vektor:900,sentinel:1250,pistol:1800,breaker:600,longshot:420}[type]):280;filter.Q.value=.6;
    noise.connect(filter).connect(gain);noise.start(t);noise.stop(t+duration);
    if(shot||type==='explosion'){
      const osc=c.createOscillator();osc.type='triangle';osc.frequency.setValueAtTime(type==='explosion'?70:160,t);osc.frequency.exponentialRampToValueAtTime(35,t+duration);osc.connect(gain);osc.start(t);osc.stop(t+duration);
    }
    // Independent transient, low-end report and short outdoor reflections.
    // All audio is synthesized here; no third-party gun recordings are used.
    if(shot){
      const transient=c.createBufferSource(),high=c.createBiquadFilter(),envelope=c.createGain();transient.buffer=this.noise;high.type='highpass';high.frequency.value=2600;envelope.gain.setValueAtTime(volume*.45,t);envelope.gain.exponentialRampToValueAtTime(.001,t+.024);transient.connect(high).connect(envelope).connect(stereo);transient.start(t);transient.stop(t+.026);transient.onended=()=>{high.disconnect();envelope.disconnect();};
      for(const delay of [.065,.14]){const echo=c.createBufferSource(),low=c.createBiquadFilter(),eg=c.createGain();echo.buffer=this.noise;low.type='lowpass';low.frequency.value=1100;eg.gain.setValueAtTime(volume*(delay<.1?.07:.035),t+delay);eg.gain.exponentialRampToValueAtTime(.001,t+delay+.11);echo.connect(low).connect(eg).connect(this.master);echo.start(t+delay);echo.stop(t+delay+.12);echo.onended=()=>{low.disconnect();eg.disconnect();};}
    }
    if(type==='reload'){
      const duration={vektor:2.4,sentinel:2.1,breaker:2.8,longshot:3,pistol:1.5}[weapon]||2;
      for(const f of [.17,.64,.88]){const src=c.createBufferSource(),bp=c.createBiquadFilter(),eg=c.createGain();src.buffer=this.noise;bp.type='bandpass';bp.frequency.value=f>.8?2300:900;eg.gain.setValueAtTime(volume*.18,t+duration*f);eg.gain.exponentialRampToValueAtTime(.001,t+duration*f+.055);src.connect(bp).connect(eg).connect(this.master);src.start(t+duration*f);src.stop(t+duration*f+.06);src.onended=()=>{bp.disconnect();eg.disconnect();};}
    }
    noise.onended=()=>{gain.disconnect();stereo.disconnect();filter.disconnect();};
  }
}
