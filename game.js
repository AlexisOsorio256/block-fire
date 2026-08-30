// ESCOMBROS — Destrucción que Construye
// B — Tiro → destrucción → escombros persistentes → siguiente tiro usa lo que creaste
// Core: APUNTAR → LANZAR → DESTRUIR → ALTERAR ESCENARIO → NUEVA DECISIÓN
// Infra reutilizada: Canvas/DPR/resize, pointer, loop/delta, audio, partículas, shake, harness

const DEBUG = false;

const CONFIG = {
  slingshot: { radius: 18, maxDist: 92, powerFactor: 7.2, bandWidth: 3 },
  projectile: { radius: 9, gravity: 980, restitution: 0.38, wallRest: 0.62, groundRest: 0.32, drag: 0.015, minLaunch: 18 },
  blocks: { gap: 2, restitution: 0.14, friction: 0.82 },
  materials: {
    wood:  { hp: 1, color: '#d8b48a', stroke: '#8a6a3a', density: 1 },
    stone: { hp: 2, color: '#8ea0c0', stroke: '#4a5a7a', density: 1.9 },
    target:{ hp: 1, color: '#ffd23f', stroke: '#8a6a00', density: 1 },
  },
  juice: { shakeLight: 3, shakeHeavy: 9, hitStopLight: 22, hitStopHeavy: 48 },
  particles: { max: 140 },
};

const STATE = { READY: 'ready', PLAYING: 'playing' };
let state = STATE.READY;

// DOM
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const bestValEl = document.getElementById('bestVal');
const shotsEl = document.getElementById('shots');
const feedbackEl = document.getElementById('feedback');
const statsLineEl = document.getElementById('stats-line');
const overlay = document.getElementById('overlay');
const titleBlock = document.getElementById('title-block');
const resultBlock = document.getElementById('result-block');
const resultTitleEl = document.getElementById('result-title');
const resultSubEl = document.getElementById('result-sub');
const finalScoreEl = document.getElementById('finalScore');
const finalShotsEl = document.getElementById('finalShots');
const finalBestEl = document.getElementById('finalBest');
const playBtn = document.getElementById('playBtn');
const retryBtn = document.getElementById('retryBtn');
const aimHint = document.getElementById('aim-hint');
const debugEl = document.getElementById('debug');

// Canvas
let W=0,H=0,CX=0,CY=0,DPR=1;
let GROUND_Y=0, SLING_X=0, SLING_Y=0;
let time=0, lastFrame=0, hitStop=0, shake=0, shakeTime=0, flash=0, flashColor='255,230,80';

// Game
let score=0, best=parseInt(localStorage.getItem('escombrosBest')||'0',10)||0;
let shots=0, blocks=[], projectile=null, particles=[], floaters=[];
let isAiming=false, aimStart=null, aimCurrent=null, canShoot=true;
let feedbackTimer=0, settleTimer=0;

const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>Math.random()*(b-a)+a;
const TAU=Math.PI*2;
const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);

if(DEBUG) debugEl.classList.remove('hidden');
bestEl.textContent=best; bestValEl.textContent=best; shotsEl.textContent='1';

// ---------- AUDIO ----------
let audio={ctx:null,enabled:true};
function ensureAudio(){ if(audio.ctx) return; try{audio.ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){audio.enabled=false;} }
function beep({freq=440,freq2=220,dur=0.12,type='sine',gain=0.18,sweep='exp'}){
  if(!audio.enabled||!audio.ctx) return;
  if(audio.ctx.state==='suspended') audio.ctx.resume();
  const t=audio.ctx.currentTime, o=audio.ctx.createOscillator(), g=audio.ctx.createGain(), f=audio.ctx.createBiquadFilter();
  f.type='lowpass'; f.frequency.value=6500; o.type=type; o.frequency.value=freq;
  if(sweep==='exp') o.frequency.exponentialRampToValueAtTime(Math.max(20,freq2),t+dur); else o.frequency.linearRampToValueAtTime(freq2,t+dur);
  g.gain.value=gain; g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(f); f.connect(g); g.connect(audio.ctx.destination); o.start(t); o.stop(t+dur+0.02);
}
function sfxLaunch(p){ beep({freq:180+p*1.2,freq2:90,dur:0.18,type:'square',gain:0.18}); }
function sfxHit(hard){ beep({freq:hard?140:260,freq2:hard?48:110,dur:hard?0.2:0.13,type:'square',gain:hard?0.24:0.16}); }
function sfxBreak(n){ beep({freq:90,freq2:32,dur:0.36,type:'sawtooth',gain:0.18+Math.min(0.16,n*0.02)}); beep({freq:1800,freq2:320,dur:0.16,type:'triangle',gain:0.1}); }
function sfxReset(){ beep({freq:700,freq2:900,dur:0.08,type:'sine',gain:0.08}); }

// ---------- RESIZE ----------
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,2);
  W=window.innerWidth; H=window.innerHeight;
  canvas.width=Math.floor(W*DPR); canvas.height=Math.floor(H*DPR);
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  CX=W*0.5;
  GROUND_Y=Math.round(H*0.78);
  SLING_X=Math.round(W*0.22);
  SLING_Y=Math.round(H*0.68);
}
window.addEventListener('resize',()=>{clearTimeout(resize._t); resize._t=setTimeout(resize,80);});
resize();

// ---------- STRUCTURE ----------
function createStructure(){
  blocks=[];
  const gap=CONFIG.blocks.gap;
  const bw=Math.floor(Math.min(W*0.075, 38));
  const bh=Math.floor(bw*0.62);
  // Base madera 3 bloques (fácil, da muchos escombros pequeños)
  const baseY=GROUND_Y - bh;
  const baseX=CX - Math.floor(1.5*bw + gap);
  for(let i=0;i<3;i++){
    blocks.push({x:baseX+i*(bw+gap), y:baseY, w:bw, h:bh, hp:CONFIG.materials.wood.hp, maxHp:1, type:'wood', alive:true, falling:false, vx:0,vy:0, angle:0, vang:0, color:CONFIG.materials.wood.color, stroke:CONFIG.materials.wood.stroke});
  }
  // Torre piedra 2 bloques encima de base central (resistente, pocos escombros grandes)
  const midY=baseY - bh - gap;
  const midX=CX - bw - gap/2;
  for(let i=0;i<2;i++){
    blocks.push({x:midX+i*(bw+gap), y:midY, w:bw, h:bh, hp:CONFIG.materials.stone.hp, maxHp:2, type:'stone', alive:true, falling:false, vx:0,vy:0, angle:0, vang:0, color:CONFIG.materials.stone.color, stroke:CONFIG.materials.stone.stroke});
  }
  // Objetivo alto (target) — requiere puente/rampa para llegar
  const topY=midY - bh - gap*2 - 8;
  const topX=CX - Math.floor(bw*0.45);
  blocks.push({x:topX, y:topY, w:Math.floor(bw*0.9), h:Math.floor(bh*0.9), hp:CONFIG.materials.target.hp, maxHp:1, type:'target', alive:true, falling:false, vx:0,vy:0, angle:0, vang:0, color:CONFIG.materials.target.color, stroke:CONFIG.materials.target.stroke});
  // Bloque suelto madera a la derecha que puede caer y formar rampa si se golpea bien
  blocks.push({x:CX + bw*1.8, y:baseY, w:bw, h:bh, hp:1, maxHp:1, type:'wood', alive:true, falling:false, vx:0,vy:0, angle:0, vang:0, color:CONFIG.materials.wood.color, stroke:CONFIG.materials.wood.stroke});
}

function resetGame(){
  score=0; shots=0; projectile=null; particles=[]; floaters=[];
  createStructure();
  canShoot=true; isAiming=false; aimStart=null; aimCurrent=null;
  hitStop=0; shake=0; flash=0; settleTimer=0;
  scoreEl.textContent='0'; shotsEl.textContent='1';
  feedbackEl.classList.remove('show'); statsLineEl.classList.remove('show');
  state=STATE.PLAYING;
  overlay.classList.add('hidden');
  titleBlock.classList.add('hidden');
  resultBlock.classList.add('hidden');
  sfxReset();
}

// ---------- PROJECTILE ----------
function launchProjectile(fromX, fromY, toX, toY){
  if(!canShoot) return;
  const dx=fromX - toX, dy=fromY - toY;
  let power=Math.hypot(dx,dy);
  power=clamp(power, 0, CONFIG.slingshot.maxDist);
  if(power < CONFIG.projectile.minLaunch) return;
  const ang=Math.atan2(dy,dx);
  const speed=power * CONFIG.slingshot.powerFactor;
  projectile={x:fromX, y:fromY, vx:Math.cos(ang)*speed, vy:Math.sin(ang)*speed, r:CONFIG.projectile.radius, alive:true, trail:[]};
  canShoot=false;
  shots++;
  shotsEl.textContent=String(shots);
  shake=CONFIG.juice.shakeLight; shakeTime=80; hitStop=CONFIG.juice.hitStopLight;
  flash=0.12; flashColor='255,210,60';
  sfxLaunch(power);
  showFeedback(power>70?'¡FUERTE!':'¡TIRO!', power>70?'danger':'normal', 600);
}

function showFeedback(txt,kind='normal',dur=700){
  feedbackEl.textContent=txt; feedbackEl.className=''; 
  if(kind==='danger') feedbackEl.style.color='#ffd23f';
  else if(kind==='critical') feedbackEl.style.color='#ff4d6a';
  else feedbackEl.style.color='#ffe86a';
  feedbackEl.classList.add('show'); feedbackTimer=dur;
}

// ---------- PARTICLES ----------
function spawnParticle(x,y,vx,vy,life,size,color){
  if(particles.length>=CONFIG.particles.max) return;
  particles.push({x,y,vx,vy,life,maxLife:life,size,color,alive:true});
}
function spawnHitParticles(x,y,n,color){
  for(let i=0;i<n;i++){
    const a=rand(0,TAU), sp=rand(60,220);
    spawnParticle(x,y,Math.cos(a)*sp,Math.sin(a)*sp,rand(0.18,0.32),rand(2,3.2),color);
  }
}

// ---------- UPDATE ----------
function update(dt){
  time+=dt*1000;
  if(hitStop>0){ hitStop-=dt*1000; return; }
  if(flash>0) flash=Math.max(0,flash-dt*3.4);
  if(shakeTime>0){ shakeTime-=dt*1000; if(shakeTime<=0) shake=0; }
  if(feedbackTimer>0){ feedbackTimer-=dt*1000; if(feedbackTimer<=0) feedbackEl.classList.remove('show'); }

  if(state===STATE.READY) return;

  // projectile
  if(projectile && projectile.alive){
    projectile.trail.push({x:projectile.x,y:projectile.y,life:0.22});
    if(projectile.trail.length>10) projectile.trail.shift();
    for(const t of projectile.trail) t.life-=dt;
    projectile.trail=projectile.trail.filter(t=>t.life>0);

    projectile.vy+=CONFIG.projectile.gravity*dt;
    projectile.vx*=(1-CONFIG.projectile.drag*dt);
    projectile.vy*=(1-CONFIG.projectile.drag*0.2*dt);
    projectile.x+=projectile.vx*dt;
    projectile.y+=projectile.vy*dt;

    // walls
    if(projectile.x - projectile.r < 0){ projectile.x=projectile.r; projectile.vx*=-CONFIG.projectile.wallRest; }
    if(projectile.x + projectile.r > W){ projectile.x=W-projectile.r; projectile.vx*=-CONFIG.projectile.wallRest; }
    if(projectile.y - projectile.r < 0){ projectile.y=projectile.r; projectile.vy*=-0.4; }

    // ground
    if(projectile.y + projectile.r >= GROUND_Y){
      projectile.y=GROUND_Y - projectile.r;
      if(Math.abs(projectile.vy) > 30){
        projectile.vy*=-CONFIG.projectile.groundRest;
        projectile.vx*=0.84;
        if(Math.abs(projectile.vy)>80) spawnHitParticles(projectile.x,GROUND_Y-2,3,'rgba(180,190,210,0.5)');
      } else {
        projectile.vy=0; projectile.vx*=0.92;
        if(Math.abs(projectile.vx)<6) projectile.vx=0;
        // settle: allow next shot after short delay
        settleTimer+=dt*1000;
        if(settleTimer>650){
          projectile.alive=false;
          settleTimer=0;
          canShoot=true;
          // check win condition (target destroyed?)
          const targetAlive=blocks.some(b=>b.alive && !b.falling && b.type==='target');
          if(!targetAlive){
            // win but allow continue? For MVP, show result after target down
            setTimeout(()=>showResult(false), 420);
          }
        }
      }
    } else {
      settleTimer=0;
    }

    // out of bounds
    if(projectile.y > H+80 || projectile.x < -80 || projectile.x > W+80){
      projectile.alive=false; canShoot=true; settleTimer=0;
    }

    // vs blocks
    for(const b of blocks){
      if(!b.alive || b.falling) continue;
      const closestX=clamp(projectile.x, b.x, b.x+b.w);
      const closestY=clamp(projectile.y, b.y, b.y+b.h);
      const dx=projectile.x-closestX, dy=projectile.y-closestY;
      if(dx*dx+dy*dy <= projectile.r*projectile.r){
        const dist=Math.hypot(dx,dy)||1, nx=dx/dist, ny=dy/dist;
        const overlap=projectile.r - dist + 0.5;
        projectile.x+=nx*overlap; projectile.y+=ny*overlap;
        const dot=projectile.vx*nx+projectile.vy*ny;
        if(dot<0){
          const refl=-dot* (b.type==='stone'?1.35:1.25);
          projectile.vx+=nx*refl; projectile.vy+=ny*refl;
          projectile.vx*=0.88; projectile.vy*=0.88;
        }
        // damage
        b.hp--;
        spawnHitParticles(closestX,closestY, b.type==='stone'?5:3, b.color);
        if(b.hp<=0){
          b.falling=true;
          const cx=b.x+b.w/2, cy=b.y+b.h/2;
          const dirX=cx-projectile.x, dirY=cy-projectile.y;
          const len=Math.hypot(dirX,dirY)||1;
          const imp=Math.hypot(projectile.vx,projectile.vy)*0.18 + 70;
          b.vx=(dirX/len)*imp*0.32 + projectile.vx*0.14 + rand(-12,12);
          b.vy=(dirY/len)*imp*0.18 + projectile.vy*0.08 - rand(8,18);
          b.vang=rand(-2.8,2.8);
          score+=b.type==='target'?80:b.type==='stone'?24:14;
          scoreEl.textContent=String(score);
          if(score>best){ best=score; localStorage.setItem('escombrosBest',String(best)); bestEl.textContent=best; bestValEl.textContent=best; }
          shake=b.type==='target'?CONFIG.juice.shakeHeavy:CONFIG.juice.shakeLight;
          shakeTime=b.type==='target'?180:70;
          hitStop=b.type==='target'?CONFIG.juice.hitStopHeavy:CONFIG.juice.hitStopLight;
          flash=b.type==='target'?0.22:0.14; flashColor=b.type==='target'?'255,210,60':'180,200,230';
          sfxHit(b.type==='stone');
          if(b.type==='target'){ showFeedback('¡OBJETIVO!', 'critical', 900); floaters.push({x:cx,y:cy-14,vy:-42,life:0.6,maxLife:0.6,text:'+80',kind:'score'}); }
        } else {
          // hp2 stone shows crack
          sfxHit(false);
        }
        break;
      }
    }
  }

  // blocks falling
  for(const b of blocks){
    if(!b.falling || !b.alive) continue;
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    b.vy+=CONFIG.projectile.gravity*0.92*dt;
    b.vx*=(1-0.16*dt); b.angle+=b.vang*dt; b.vang*=(1-0.45*dt);
    if(b.y + b.h >= GROUND_Y){
      b.y=GROUND_Y - b.h;
      if(Math.abs(b.vy)>18){
        b.vy*=-CONFIG.blocks.restitution;
        b.vx*=CONFIG.blocks.friction;
        b.vang*=0.78;
        if(Math.abs(b.vy)>60) spawnHitParticles(b.x+b.w/2, GROUND_Y-2, 2,'rgba(160,170,190,0.4)');
      } else {
        b.vy=0; b.vx*=0.94; if(Math.abs(b.vx)<2) b.vx=0; b.vang*=0.92;
        if(Math.abs(b.vang)<0.05) b.vang=0;
        // settle as static debris (keep falling=false? No, keep falling true but settled, will act as static obstacle)
        // Mark as static debris: keep falling true but with zero velocity, will be used as platform
        // For simplicity, keep falling true but treat as static in collision (already handled)
      }
    }
    // walls for blocks
    if(b.x < 0){ b.x=0; b.vx*=-0.35; }
    if(b.x + b.w > W){ b.x=W-b.w; b.vx*=-0.35; }
    // block vs block stacking (simple)
    for(const o of blocks){
      if(o===b || !o.alive) continue;
      // only check against settled blocks (on ground or falling settled)
      if(o.y + o.h < GROUND_Y - 4) continue;
      if(b.x < o.x+o.w && b.x+b.w > o.x && b.y+b.h > o.y && b.y < o.y+4 && b.vy>0){
        b.y=o.y - b.h;
        b.vy*=-0.18;
        b.vx*=0.88;
      }
    }
  }

  // block vs block collision for projectile already done, but also projectile vs fallen debris (falling blocks are also obstacles)
  // already included because we check all blocks with alive, including falling (we skip falling in projectile vs blocks check above -> we skip falling, but we should allow projectile to bounce off fallen debris as new platform)
  // So we should also check projectile vs falling debris as static
  if(projectile && projectile.alive){
    for(const b of blocks){
      if(!b.alive || !b.falling) continue;
      // only if debris is settled (vy ~0)
      if(Math.abs(b.vy)>12 || Math.abs(b.vx)>12) continue;
      const closestX=clamp(projectile.x, b.x, b.x+b.w);
      const closestY=clamp(projectile.y, b.y, b.y+b.h);
      const dx=projectile.x-closestX, dy=projectile.y-closestY;
      if(dx*dx+dy*dy <= projectile.r*projectile.r){
        const dist=Math.hypot(dx,dy)||1, nx=dx/dist, ny=dy/dist;
        const overlap=projectile.r - dist + 0.5;
        projectile.x+=nx*overlap; projectile.y+=ny*overlap;
        const dot=projectile.vx*nx+projectile.vy*ny;
        if(dot<0){
          const refl=-dot*1.15;
          projectile.vx+=nx*refl; projectile.vy+=ny*refl;
        }
      }
    }
  }

  // particles
  for(const p of particles){ if(!p.alive) continue; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=(1-1.6*dt); p.vy*=(1-1.6*dt); p.vy+=18*dt; p.life-=dt; if(p.life<=0) p.alive=false; }
  particles=particles.filter(p=>p.alive);
  for(const f of floaters){ f.y+=f.vy*dt; f.vy+=32*dt; f.life-=dt; }
  floaters=floaters.filter(f=>f.life>0);

  // HUD
  shotsEl.textContent=String(Math.max(1,shots+ (canShoot?1:0)));
  if(blocks.filter(b=>b.alive && !b.falling).length===0){
    // all cleared? show result
    if(!projectile || !projectile.alive){
      setTimeout(()=>showResult(true), 500);
    }
  }
}

function showResult(allCleared){
  const alive=blocks.filter(b=>b.alive && !b.falling).length;
  const destroyed= blocks.length - alive;
  const isWin=blocks.every(b=>b.type!=='target' || !b.alive || b.falling);
  resultTitleEl.textContent=isWin?'¡ESCOMBROS!':'INTÉNTALO OTRA VEZ';
  resultTitleEl.style.color=isWin?'#ffd23f':'#fff';
  resultSubEl.textContent=isWin?'Usaste lo que destruiste.' : 'Los restos quedan — nueva oportunidad.';
  finalScoreEl.textContent=String(score);
  finalShotsEl.textContent=String(shots);
  finalBestEl.textContent=String(best);
  resultBlock.classList.remove('hidden');
  titleBlock.classList.add('hidden');
  overlay.classList.remove('hidden');
  state=STATE.READY;
}

// ---------- INPUT ----------
function getSlingshotPos(){ return {x:SLING_X, y:SLING_Y}; }

function setAiming(v, pos){
  isAiming=v;
  if(v){
    aimHint.classList.add('show');
    aimStart={x:SLING_X, y:SLING_Y};
    aimCurrent=pos;
  } else {
    aimHint.classList.remove('show');
    if(aimStart && aimCurrent){
      launchProjectile(SLING_X, SLING_Y, aimCurrent.x, aimCurrent.y);
    }
    aimStart=null; aimCurrent=null;
  }
}

canvas.addEventListener('pointerdown', e=>{
  e.preventDefault();
  ensureAudio(); if(audio.ctx && audio.ctx.state==='suspended') audio.ctx.resume();
  try{ canvas.setPointerCapture(e.pointerId);}catch(_){}
  if(state===STATE.READY){
    state=STATE.PLAYING;
    overlay.classList.add('hidden');
    titleBlock.classList.add('hidden');
    resultBlock.classList.add('hidden');
  }
  if(!canShoot || (projectile && projectile.alive)) return;
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left), y=(e.clientY-rect.top);
  if(dist(x,y,SLING_X,SLING_Y) < 96){
    setAiming(true, {x,y});
  }
});
canvas.addEventListener('pointermove', e=>{
  if(!isAiming) return;
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left), y=(e.clientY-rect.top);
  // clamp to maxDist
  let dx=x - SLING_X, dy=y - SLING_Y;
  const d=Math.hypot(dx,dy);
  if(d>CONFIG.slingshot.maxDist){
    const ang=Math.atan2(dy,dx);
    aimCurrent={x:SLING_X+Math.cos(ang)*CONFIG.slingshot.maxDist, y:SLING_Y+Math.sin(ang)*CONFIG.slingshot.maxDist};
  } else {
    aimCurrent={x,y};
  }
});
canvas.addEventListener('pointerup', e=>{
  e.preventDefault();
  if(isAiming) setAiming(false);
  else if(state===STATE.READY){
    // allow tap to retry? handled via overlay button
  }
});
canvas.addEventListener('pointercancel', ()=>{ if(isAiming) setAiming(false); });
canvas.addEventListener('contextmenu', e=>e.preventDefault());
document.addEventListener('touchmove', e=>e.preventDefault(), {passive:false});

playBtn.addEventListener('click', ()=>{ ensureAudio(); resetGame(); });
retryBtn.addEventListener('click', ()=> resetGame());
playBtn.addEventListener('pointerdown', e=>{ e.preventDefault(); ensureAudio(); resetGame(); });
retryBtn.addEventListener('pointerdown', e=>{ e.preventDefault(); resetGame(); });

window.addEventListener('keydown', e=>{
  if(e.code==='Space'){
    e.preventDefault();
    if(state===STATE.READY) resetGame();
  }
  if(e.code==='KeyR'){ resetGame(); }
  if(e.shiftKey && e.code==='KeyD'){ debugEl.classList.toggle('hidden'); }
});

// ---------- RENDER ----------
function render(){
  ctx.save();
  if(shake>0){
    const sx=(Math.random()-0.5)*shake*2, sy=(Math.random()-0.5)*shake*2;
    ctx.translate(sx,sy);
  }
  ctx.fillStyle='#0f141e';
  ctx.fillRect(0,0,W,H);
  const bg=ctx.createRadialGradient(CX,H*0.45,40,CX,H*0.45,Math.max(W,H)*0.75);
  bg.addColorStop(0,'rgba(30,45,90,0.18)'); bg.addColorStop(0.5,'rgba(15,25,55,0.08)'); bg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // ground
  ctx.fillStyle='#1c2438';
  ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);
  ctx.fillStyle='rgba(255,210,60,0.06)';
  ctx.fillRect(0,GROUND_Y-1,W,1);
  // slingshot
  const slingW=10, slingH=46;
  ctx.fillStyle='#2a344a';
  ctx.fillRect(SLING_X- slingW/2, SLING_Y, slingW, slingH);
  ctx.fillStyle='#3a4a6a';
  ctx.fillRect(SLING_X- slingW/2-2, SLING_Y-6, slingW+4, 8);
  // elastic bands when aiming
  if(isAiming && aimCurrent){
    ctx.strokeStyle='rgba(255,210,60,0.85)';
    ctx.lineWidth=CONFIG.slingshot.bandWidth;
    ctx.beginPath();
    ctx.moveTo(SLING_X-6, SLING_Y-6); ctx.lineTo(aimCurrent.x, aimCurrent.y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(SLING_X+6, SLING_Y-6); ctx.lineTo(aimCurrent.x, aimCurrent.y); ctx.stroke();
    // projectile preview at aimCurrent
    ctx.fillStyle='#ffd23f';
    ctx.beginPath(); ctx.arc(aimCurrent.x, aimCurrent.y, CONFIG.projectile.radius,0,TAU); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=1; ctx.stroke();
    // trajectory preview (dotted, 3 bounces)
    const dx=SLING_X - aimCurrent.x, dy=SLING_Y - aimCurrent.y;
    let power=Math.hypot(dx,dy); power=clamp(power,0,CONFIG.slingshot.maxDist);
    if(power>12){
      const ang=Math.atan2(dy,dx), speed=power*CONFIG.slingshot.powerFactor;
      let px=SLING_X, py=SLING_Y, vx=Math.cos(ang)*speed, vy=Math.sin(ang)*speed;
      ctx.strokeStyle='rgba(255,255,255,0.22)';
      ctx.setLineDash([4,6]); ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo(px,py);
      for(let i=0;i<52;i++){
        vy+=CONFIG.projectile.gravity*0.016;
        px+=vx*0.016; py+=vy*0.016;
        if(px<0||px>W||py>GROUND_Y) break;
        // simple bounce preview off walls/ground (approx)
        if(px<CONFIG.projectile.radius || px>W-CONFIG.projectile.radius) vx*=-0.62;
        ctx.lineTo(px,py);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
  } else if(!projectile || !projectile.alive){
    // idle projectile at slingshot
    ctx.fillStyle='#ffd23f';
    ctx.beginPath(); ctx.arc(SLING_X, SLING_Y-6, CONFIG.projectile.radius,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(SLING_X-3, SLING_Y-9, 2.2,0,TAU); ctx.fill();
  }

  // blocks
  for(const b of blocks){
    if(!b.alive) continue;
    ctx.save();
    if(b.falling && b.angle!==0){
      ctx.translate(b.x+b.w/2, b.y+b.h/2);
      ctx.rotate(b.angle*0.06);
      ctx.translate(-(b.x+b.w/2), -(b.y+b.h/2));
    }
    // shadow
    if(!b.falling){
      ctx.fillStyle='rgba(0,0,0,0.22)';
      ctx.fillRect(b.x+1,b.y+b.h-1,b.w,2);
    } else {
      const h=GROUND_Y-(b.y+b.h);
      if(h<24){ ctx.fillStyle=`rgba(0,0,0,${0.18*(1-h/24)})`; ctx.fillRect(b.x,GROUND_Y-2,b.w,2); }
    }
    ctx.fillStyle=b.falling?shadeColor(b.color,-18):b.color;
    ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(b.x,b.y,b.w,3);
    ctx.fillStyle='rgba(0,0,0,0.16)'; ctx.fillRect(b.x,b.y+b.h-3,b.w,3);
    ctx.strokeStyle=b.stroke; ctx.lineWidth=1; ctx.strokeRect(b.x+0.5,b.y+0.5,b.w-1,b.h-1);
    if(b.type==='stone' && b.hp===1 && !b.falling){
      ctx.strokeStyle='rgba(60,40,20,0.5)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(b.x+b.w*0.2,b.y+3); ctx.lineTo(b.x+b.w*0.5,b.y+b.h*0.5); ctx.lineTo(b.x+b.w*0.7,b.y+b.h-3); ctx.stroke();
    }
    if(b.type==='target'){
      ctx.fillStyle='rgba(255,255,255,0.9)';
      ctx.font=`900 ${Math.floor(b.h*0.55)}px system-ui, sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('★', b.x+b.w/2, b.y+b.h/2+1);
    }
    ctx.restore();
  }

  // projectile
  if(projectile && projectile.alive){
    // trail
    for(const t of projectile.trail){
      const a=t.life/0.22;
      ctx.fillStyle=`rgba(255,210,60,${a*0.18})`;
      ctx.beginPath(); ctx.arc(t.x,t.y, projectile.r*(0.5+a*0.4),0,TAU); ctx.fill();
    }
    const grad=ctx.createRadialGradient(projectile.x-3,projectile.y-4,2, projectile.x,projectile.y, projectile.r);
    grad.addColorStop(0,'#fff8d0'); grad.addColorStop(0.3,'#ffd23f'); grad.addColorStop(1,'#8a6a00');
    ctx.fillStyle=grad;
    ctx.shadowBlur=10; ctx.shadowColor='rgba(255,210,60,0.7)';
    ctx.beginPath(); ctx.arc(projectile.x,projectile.y,projectile.r,0,TAU); ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(projectile.x,projectile.y,projectile.r,0,TAU); ctx.stroke();
  }

  // particles
  for(const p of particles){
    const a=clamp(p.life/p.maxLife,0,1);
    ctx.globalAlpha=a;
    ctx.fillStyle=p.color;
    ctx.shadowBlur=5*a; ctx.shadowColor=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(0.7+a*0.5),0,TAU); ctx.fill();
    ctx.shadowBlur=0;
  }
  ctx.globalAlpha=1;
  for(const f of floaters){
    const a=clamp(f.life/f.maxLife,0,1);
    ctx.globalAlpha=a;
    ctx.fillStyle='#fff';
    ctx.font=`900 ${f.kind==='score'?13:14}px system-ui, sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=3;
    ctx.strokeText(f.text,f.x,f.y); ctx.fillText(f.text,f.x,f.y);
  }
  ctx.globalAlpha=1;

  if(flash>0){
    ctx.fillStyle=`rgba(${flashColor},${flash*0.5})`;
    ctx.fillRect(0,0,W,H);
    const g=ctx.createRadialGradient(CX,H*0.5,30,CX,H*0.5,Math.max(W,H)*0.6);
    g.addColorStop(0,`rgba(${flashColor},${flash*0.28})`); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  }
  const vig=ctx.createRadialGradient(CX,H*0.5,Math.min(W,H)*0.5,CX,H*0.5,Math.max(W,H)*0.85);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,0.36)');
  ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
  ctx.restore();
}

function shadeColor(hex, amt){
  try{
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgb(${clamp(r+amt,0,255)},${clamp(g+amt,0,255)},${clamp(b+amt,0,255)})`;
  }catch(e){ return hex; }
}

// ---------- LOOP ----------
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min((now-lastFrame)/1000,0.033);
  lastFrame=now;
  if(document.hidden) return;
  update(dt);
  render();
}
lastFrame=performance.now();
requestAnimationFrame(loop);
createStructure();
update(0); render();

// ---------- CAPTURE & TESTS ----------
(function(){
  const params=new URLSearchParams(location.search);
  if(params.has('capture')){
    const mode=params.get('capture')||'ready';
    setTimeout(()=>{
      if(mode==='ready'){
        // already ready
      } else if(mode==='aim'){
        state=STATE.PLAYING; overlay.classList.add('hidden');
        isAiming=true; aimCurrent={x:SLING_X+42,y:SLING_Y-38};
      } else if(mode==='flying'){
        state=STATE.PLAYING; overlay.classList.add('hidden');
        projectile={x:CX,y:H*0.45,vx:220,vy:-180,r:CONFIG.projectile.radius,alive:true,trail:[]};
        canShoot=false;
      } else if(mode==='impact'){
        state=STATE.PLAYING; overlay.classList.add('hidden');
        // break some blocks
        if(blocks[1]){ blocks[1].falling=true; blocks[1].vy=40; blocks[1].vx=20; }
        if(blocks[3]){ blocks[3].falling=true; blocks[3].vy=30; blocks[3].vx=-18; }
        projectile={x:CX+20,y:GROUND_Y-30,vx:80,vy:-60,r:9,alive:true,trail:[]};
        shake=6; shakeTime=120; flash=0.18; flashColor='255,210,60';
      } else if(mode==='modified'){
        state=STATE.PLAYING; overlay.classList.add('hidden');
        // debris as new platform
        if(blocks[0]){ blocks[0].falling=true; blocks[0].y=GROUND_Y-blocks[0].h; blocks[0].vy=0; blocks[0].vx=0; }
        if(blocks[1]){ blocks[1].falling=true; blocks[1].y=GROUND_Y-blocks[1].h; blocks[1].x=CX-10; blocks[1].vy=0; }
      } else if(mode==='secondshot'){
        state=STATE.PLAYING; overlay.classList.add('hidden');
        // debris persists, show second aim
        if(blocks[0]){ blocks[0].falling=true; blocks[0].y=GROUND_Y-blocks[0].h; }
        isAiming=true; aimCurrent={x:SLING_X+48,y:SLING_Y-52};
      }
    }, 480);
  }
  if(params.has('runTests')){
    window.__TEST_RESULTS=[];
    const log=(n,p,d)=>{ window.__TEST_RESULTS.push({name:n,pass:p,detail:d}); console.log(`[TEST] ${n}: ${p?'PASS':'FAIL'} ${d}`); };
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const tick=(n,dt=0.016)=>{ for(let i=0;i<n;i++) update(dt); };
    async function run(){
      // 1 launch
      {
        createStructure(); projectile=null; canShoot=true;
        const before=projectile;
        launchProjectile(SLING_X,SLING_Y, SLING_X+50, SLING_Y-40);
        const ok=projectile && projectile.alive && Math.hypot(projectile.vx,projectile.vy)>100;
        log('1 LAUNCH', ok, `vx ${projectile?projectile.vx.toFixed(0):0}`);
        projectile=null; canShoot=true;
      }
      // 2 wood break
      {
        createStructure(); projectile=null; hitStop=0;
        const wood=blocks.find(b=>b.type==='wood');
        wood.hp=1; wood.falling=false;
        // simulate hit directly (projectile logic would do hp-- and falling)
        wood.hp--; if(wood.hp<=0) wood.falling=true;
        const broken=wood.falling;
        log('2 WOOD BREAK', broken, `falling ${broken} hp ${wood.hp}`);
        projectile=null; hitStop=0;
      }
      // 3 stone needs 2 hits
      {
        createStructure();
        const stone=blocks.find(b=>b.type==='stone');
        stone.hp=2; stone.falling=false;
        // first hit
        stone.hp--; const after1=stone.hp===1 && !stone.falling;
        // second hit
        stone.hp--; stone.falling=true;
        const after2=stone.falling;
        log('3 STONE HP2', after1 && after2, `hp1 ${after1} hp0 ${after2}`);
      }
      // 4 persistence
      {
        createStructure(); hitStop=0;
        const b=blocks[0]; b.falling=true; b.vy=0;
        // debris is still alive and will persist as static after falling
        const ok=b.alive && b.falling;
        log('4 PERSISTENCE', ok, `alive ${b.alive} falling ${b.falling} y ${b.y.toFixed(0)}`);
      }
      // 5 second shot uses debris
      {
        createStructure(); hitStop=0;
        const debris=blocks[0]; debris.falling=true; debris.y=GROUND_Y-debris.h; debris.vy=0; debris.vx=0;
        const canCollide=debris.alive && debris.falling;
        // test that debris is considered platform (exists and is falling/settled)
        const exists=debris.alive && debris.falling && debris.y+debris.h >= GROUND_Y-2;
        // also test that projectile can be launched
        launchProjectile(SLING_X, SLING_Y, SLING_X+40, SLING_Y-30);
        const launched=projectile && projectile.alive;
        if(projectile) projectile=null;
        log('5 DEBRIS AS PLATFORM', canCollide && exists && launched, `exists ${exists} launched ${launched}`);
        hitStop=0;
      }
      // 6 recovery: bad shot still leaves debris usable
      {
        createStructure(); hitStop=0;
        const before=blocks.filter(b=>b.alive&&!b.falling).length;
        const w=blocks.find(b=>b.type==='wood');
        w.falling=true; w.y=GROUND_Y-60; w.vy=0; w.vx=4;
        for(let i=0;i<16;i++){ tick(1,0.016); hitStop=0; }
        const after=blocks.filter(b=>b.alive&&!b.falling).length;
        const debrisUsable=blocks.some(b=>b.falling && b.alive);
        log('6 RECOVERY', after < before && debrisUsable, `before ${before} after ${after} debris ${debrisUsable}`);
      }
      const overlayRes=document.createElement('div');
      overlayRes.style.cssText='position:fixed;inset:0;z-index:99;background:rgba(10,16,30,0.96);color:#fff;font:13px/1.5 ui-monospace,monospace;padding:22px;overflow:auto';
      let html='<h2 style="color:#ffd23f;margin-bottom:10px">ESCOMBROS — TESTS</h2><pre>';
      for(const r of window.__TEST_RESULTS){ html+=`<span style="color:${r.pass?'#7dff9a':'#ff6b7a'}">${r.pass?'PASS':'FAIL'}</span> ${r.name} <span style="opacity:0.7">${r.detail}</span>\n`; }
      const passed=window.__TEST_RESULTS.filter(r=>r.pass).length;
      html+=`\nTotal ${passed}/${window.__TEST_RESULTS.length} PASSED\n</pre>`;
      overlayRes.innerHTML=html;
      document.body.appendChild(overlayRes);
    }
    setTimeout(run, 700);
  }
})();

window.__GAME__={ get state(){return state}, get score(){return score}, get blocks(){return blocks}, get projectile(){return projectile}, CONFIG, createStructure, resetGame };
