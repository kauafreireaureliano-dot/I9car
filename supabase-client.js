const SUPABASE_URL='https://wghfcbisndarkxbekjqm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_yRptu_ASbjlz8A0ilZWkSg_wkxDVgES';
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

// i9 CAR — experiência sonora ambiente original, gerada no navegador.
// Não depende de arquivo externo e só inicia após interação do visitante.
window.addEventListener('DOMContentLoaded',()=>{
  const button=document.getElementById('sound');
  if(!button) return;
  let ctx=null, master=null, playing=false, timer=null, step=0;
  const nodes=[];
  const chords=[[65.41,98,130.81],[73.42,110,146.83],[55,82.41,110],[61.74,92.5,123.47]];
  function tone(freq,when,duration,type='sine',gain=.03){
    const o=ctx.createOscillator(), g=ctx.createGain(), f=ctx.createBiquadFilter();
    o.type=type;o.frequency.setValueAtTime(freq,when);
    f.type='lowpass';f.frequency.value=900;
    g.gain.setValueAtTime(.0001,when);
    g.gain.exponentialRampToValueAtTime(gain,when+.8);
    g.gain.exponentialRampToValueAtTime(.0001,when+duration);
    o.connect(f).connect(g).connect(master);o.start(when);o.stop(when+duration+.1);nodes.push(o);
  }
  function playBar(){
    const now=ctx.currentTime+.05, chord=chords[step%chords.length];
    chord.forEach((f,i)=>tone(f,now,5.6,'sine',i===0?.018:.011));
    tone(chord[0]/2,now,2.5,'triangle',.022);
    const notes=[chord[1]*2,chord[2]*1.5,chord[1]*1.5];
    tone(notes[step%notes.length],now+1.2,1.7,'sine',.009);
    tone(notes[(step+1)%notes.length],now+3.1,1.5,'sine',.007);
    step++;
  }
  async function start(){
    ctx??=new (window.AudioContext||window.webkitAudioContext)();
    await ctx.resume();
    master=ctx.createGain();master.gain.value=.38;master.connect(ctx.destination);
    playing=true;step=0;playBar();timer=setInterval(playBar,5200);
    button.classList.add('on');button.textContent='♫ EXPERIÊNCIA SONORA — ON';
  }
  function stop(){
    playing=false;clearInterval(timer);timer=null;
    nodes.forEach(n=>{try{n.stop()}catch(e){}});nodes.length=0;
    if(master){master.disconnect();master=null;}
    button.classList.remove('on');button.textContent='🎵 EXPERIÊNCIA SONORA — OFF';
  }
  button.onclick=()=>playing?stop():start();
});