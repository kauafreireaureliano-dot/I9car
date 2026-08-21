const SUPABASE_URL='https://wghfcbisndarkxbekjqm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_yRptu_ASbjlz8A0ilZWkSg_wkxDVgES';
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

window.addEventListener('DOMContentLoaded',()=>{
  const logo=document.querySelector('.hero .logo'); if(logo) logo.remove();
  const eyebrow=document.querySelector('.hero .eyebrow'),heroTitle=document.querySelector('.hero h1'),heroText=document.querySelector('.hero p'),heroButton=document.querySelector('.hero .cta .btn');
  if(eyebrow) eyebrow.textContent='i9 CAR MULTIMARCAS • ARCOVERDE/PE';
  if(heroTitle) heroTitle.innerHTML='ALGUMAS CONQUISTAS<br>NÃO CABEM EM PALAVRAS.<br><span class="orange">ELAS TÊM QUATRO RODAS.</span>';
  if(heroText) heroText.textContent='Talvez a sua próxima conquista esteja esperando por você aqui.';
  if(heroButton) heroButton.textContent='EXPLORAR VEÍCULOS ↓';

  // Corrige completamente o estado do modal e evita uma camada invisível bloquear os cards.
  const modal=document.getElementById('modal'),lightbox=document.getElementById('lightbox'),closeButton=document.querySelector('.modal .close');
  const unlock=()=>{document.body.style.overflow='';document.body.style.pointerEvents='';document.documentElement.style.overflow=''};
  const closeEverything=()=>{
    if(lightbox){lightbox.classList.remove('show');lightbox.style.display='';lightbox.style.pointerEvents='none';setTimeout(()=>{if(!lightbox.classList.contains('show'))lightbox.style.pointerEvents=''},0)}
    if(modal){modal.classList.remove('show');modal.style.display='none';modal.style.pointerEvents='none';setTimeout(()=>{if(!modal.classList.contains('show')){modal.style.display='';modal.style.pointerEvents=''}},0)}
    unlock();
  };
  window.closeCar=closeEverything;
  if(closeButton) closeButton.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();closeEverything()},true);
  if(modal) modal.addEventListener('click',e=>{if(e.target===modal) closeEverything()},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape') closeEverything()},true);

  // Segurança extra: ao clicar em qualquer card, remove resquícios de overlay antigo.
  document.addEventListener('click',e=>{
    const card=e.target.closest?.('.card');
    if(card && modal && !modal.classList.contains('show')){modal.style.display='';modal.style.pointerEvents='';if(lightbox){lightbox.style.display='';lightbox.style.pointerEvents=''}unlock();}
  },true);

  const button=document.getElementById('sound');
  if(!button) return;
  let ctx=null, master=null, playing=false, timer=null, step=0; const nodes=[];
  const chords=[[65.41,98,130.81],[73.42,110,146.83],[55,82.41,110],[61.74,92.5,123.47]];
  function tone(freq,when,duration,type='sine',gain=.03){const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();o.type=type;o.frequency.setValueAtTime(freq,when);f.type='lowpass';f.frequency.value=900;g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(gain,when+.8);g.gain.exponentialRampToValueAtTime(.0001,when+duration);o.connect(f).connect(g).connect(master);o.start(when);o.stop(when+duration+.1);nodes.push(o)}
  function playBar(){const now=ctx.currentTime+.05,chord=chords[step%chords.length];chord.forEach((f,i)=>tone(f,now,5.6,'sine',i===0?.018:.011));tone(chord[0]/2,now,2.5,'triangle',.022);const notes=[chord[1]*2,chord[2]*1.5,chord[1]*1.5];tone(notes[step%notes.length],now+1.2,1.7,'sine',.009);tone(notes[(step+1)%notes.length],now+3.1,1.5,'sine',.007);step++}
  async function start(){ctx??=new(window.AudioContext||window.webkitAudioContext)();await ctx.resume();master=ctx.createGain();master.gain.value=.38;master.connect(ctx.destination);playing=true;step=0;playBar();timer=setInterval(playBar,5200);button.textContent='♫ EXPERIÊNCIA SONORA — ON'}
  function stop(){playing=false;clearInterval(timer);timer=null;nodes.forEach(n=>{try{n.stop()}catch(e){}});nodes.length=0;if(master){master.disconnect();master=null}button.textContent='🎵 EXPERIÊNCIA SONORA — OFF'}
  button.onclick=()=>playing?stop():start();
});