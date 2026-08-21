const SUPABASE_URL='https://wghfcbisndarkxbekjqm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_yRptu_ASbjlz8A0ilZWkSg_wkxDVgES';
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

window.addEventListener('DOMContentLoaded',()=>{
  // Logo local em SVG: não depende mais do link temporário do Instagram.
  const logo=document.querySelector('.hero .logo');
  if(logo){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520"><defs><linearGradient id="s" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#fff"/><stop offset=".48" stop-color="#bfc2c7"/><stop offset="1" stop-color="#f7f7f7"/></linearGradient></defs><rect width="1200" height="520" fill="#07090d" rx="28"/><text x="75" y="340" fill="url(#s)" font-family="Arial Black,Arial,sans-serif" font-size="300" font-weight="900" letter-spacing="-28">i9</text><path d="M425 190 C555 245 640 125 790 135 C900 140 1000 160 1100 215" fill="none" stroke="#aeb2b9" stroke-width="10" stroke-linecap="round"/><path d="M675 225 C800 300 980 195 1110 250 C1145 265 1165 285 1175 315" fill="none" stroke="#ff6a19" stroke-width="11" stroke-linecap="round"/><text x="510" y="345" fill="url(#s)" font-family="Arial Black,Arial,sans-serif" font-size="185" font-weight="900" letter-spacing="-8">CAR</text><text x="520" y="425" fill="#ff6a19" font-family="Arial Black,Arial,sans-serif" font-size="58" font-weight="900" letter-spacing="6">MULTIMARCAS</text></svg>`;
    logo.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    logo.style.objectFit='contain';
    logo.style.background='transparent';
  }

  const button=document.getElementById('sound');
  if(!button) return;
  let ctx=null, master=null, playing=false, timer=null, step=0;
  const nodes=[];
  const chords=[[65.41,98,130.81],[73.42,110,146.83],[55,82.41,110],[61.74,92.5,123.47]];
  function tone(freq,when,duration,type='sine',gain=.03){const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();o.type=type;o.frequency.setValueAtTime(freq,when);f.type='lowpass';f.frequency.value=900;g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(gain,when+.8);g.gain.exponentialRampToValueAtTime(.0001,when+duration);o.connect(f).connect(g).connect(master);o.start(when);o.stop(when+duration+.1);nodes.push(o)}
  function playBar(){const now=ctx.currentTime+.05,chord=chords[step%chords.length];chord.forEach((f,i)=>tone(f,now,5.6,'sine',i===0?.018:.011));tone(chord[0]/2,now,2.5,'triangle',.022);const notes=[chord[1]*2,chord[2]*1.5,chord[1]*1.5];tone(notes[step%notes.length],now+1.2,1.7,'sine',.009);tone(notes[(step+1)%notes.length],now+3.1,1.5,'sine',.007);step++}
  async function start(){ctx??=new(window.AudioContext||window.webkitAudioContext)();await ctx.resume();master=ctx.createGain();master.gain.value=.38;master.connect(ctx.destination);playing=true;step=0;playBar();timer=setInterval(playBar,5200);button.textContent='♫ EXPERIÊNCIA SONORA — ON'}
  function stop(){playing=false;clearInterval(timer);timer=null;nodes.forEach(n=>{try{n.stop()}catch(e){}});nodes.length=0;if(master){master.disconnect();master=null}button.textContent='🎵 EXPERIÊNCIA SONORA — OFF'}
  button.onclick=()=>playing?stop():start();
});