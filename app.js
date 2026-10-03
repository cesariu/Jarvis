const $ = (s) => document.querySelector(s);
const els = {
  face: $('#face'), systemState: $('#systemState'), title: $('#presenceTitle'), hint: $('#presenceHint'),
  messages: $('#messages'), form: $('#chatForm'), input: $('#messageInput'), voiceBtn: $('#voiceBtn'),
  loadBrain: $('#loadBrainBtn'), progressWrap: $('#loadProgress'), progressBar: $('#progressBar'), progressText: $('#progressText'),
  webgpu: $('#webgpuBadge'), brain: $('#brainBadge'), installBtn: $('#installBtn'), installGate: $('#installGate'),
  installNow: $('#installNow'), continueWeb: $('#continueWeb'), installHelp: $('#installHelp'), settings: $('#settingsPanel'),
  settingsBtn: $('#settingsBtn'), closeSettings: $('#closeSettings'), voiceSelect: $('#voiceSelect'), voiceRate: $('#voiceRate'),
  autoSpeak: $('#autoSpeak'), rememberChat: $('#rememberChat'), userName: $('#userName'), toast: $('#toast')
};

const STORE_KEY = 'jarvis_v03_state';
const defaultState = { user:'Fred', memories:[], history:[], settings:{autoSpeak:true, rememberChat:true, voiceRate:1} };
let state = loadState();
let engine = null;
let webllm = null;
let selectedModel = null;
let deferredInstallPrompt = null;
let recognition = null;
let listening = false;

function loadState(){ try { return {...defaultState, ...JSON.parse(localStorage.getItem(STORE_KEY)||'{}')}; } catch { return structuredClone(defaultState); } }
function saveState(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function addMessage(role,text,save=true){
  const div=document.createElement('div'); div.className=`msg ${role}`; div.textContent=text; els.messages.appendChild(div); els.messages.scrollTop=els.messages.scrollHeight;
  if(save && state.settings.rememberChat && (role==='user'||role==='jarvis')){ state.history.push({role,text,at:new Date().toISOString()}); state.history=state.history.slice(-80); saveState(); }
}
function setMode(mode,label){
  els.face.className=`holo-face ${mode}`; els.systemState.textContent=(label||mode).toUpperCase();
  const map={idle:['Bonjour Fred.','Touche mon visage pour me parler.'],listening:['Je t’écoute.','Parle naturellement.'],thinking:['Analyse en cours…','J’organise ma réponse.'],speaking:['Je te réponds.','Tu peux m’interrompre en touchant mon visage.'],error:['Un problème est survenu.','Je te l’indique plutôt que de faire semblant.']};
  if(map[mode]){els.title.textContent=map[mode][0];els.hint.textContent=map[mode][1];}
}
function toast(msg){ els.toast.textContent=msg; els.toast.classList.remove('hidden'); setTimeout(()=>els.toast.classList.add('hidden'),2600); }
function isStandalone(){ return matchMedia('(display-mode: standalone)').matches || navigator.standalone===true; }

if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstallPrompt=e; els.installBtn.classList.remove('hidden'); if(!isStandalone() && !sessionStorage.getItem('jarvisSkipInstall')) els.installGate.classList.remove('hidden'); });
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;els.installGate.classList.add('hidden');toast('JARVIS est installé.');});
async function promptInstall(){
  if(deferredInstallPrompt){ deferredInstallPrompt.prompt(); const {outcome}=await deferredInstallPrompt.userChoice; if(outcome==='accepted') els.installGate.classList.add('hidden'); return; }
  els.installGate.classList.remove('hidden');
  els.installHelp.textContent = location.protocol==='file:' ? 'L’installation PWA ne fonctionne pas depuis un fichier local. Ouvre JARVIS depuis son adresse HTTPS.' : 'Si le bouton système n’apparaît pas : menu du navigateur → Ajouter à l’écran d’accueil / Installer l’application.';
}
els.installBtn.onclick=promptInstall; els.installNow.onclick=promptInstall; els.continueWeb.onclick=()=>{sessionStorage.setItem('jarvisSkipInstall','1');els.installGate.classList.add('hidden');};

function checkWebGPU(){
  if(navigator.gpu){ els.webgpu.textContent='WebGPU : disponible'; els.webgpu.classList.add('ok'); return true; }
  els.webgpu.textContent='WebGPU : indisponible'; els.webgpu.classList.add('warn'); els.loadBrain.disabled=true; els.loadBrain.textContent='WebGPU requis'; return false;
}
checkWebGPU();

function chooseSmallModel(list){
  const ids=list.map(x=>x.model_id).filter(Boolean);
  const preferences=[/Llama-3\.2-1B-Instruct/i,/SmolLM2-1\.7B-Instruct/i,/SmolLM2-1\.7B/i,/Phi-3\.5-mini-instruct/i,/Qwen2\.5-1\.5B-Instruct/i];
  for(const rx of preferences){ const found=ids.find(id=>rx.test(id)); if(found) return found; }
  return ids.find(id=>/1B|1\.5B|1\.7B|mini/i.test(id)) || ids[0];
}

els.loadBrain.onclick=async()=>{
  if(!navigator.gpu) return;
  try{
    els.loadBrain.disabled=true; els.progressWrap.classList.remove('hidden'); setMode('thinking','chargement');
    els.progressText.textContent='Chargement du moteur local…';
    webllm = await import('https://esm.run/@mlc-ai/web-llm');
    selectedModel=chooseSmallModel(webllm.prebuiltAppConfig.model_list);
    if(!selectedModel) throw new Error('Aucun modèle compatible détecté.');
    els.progressText.textContent=`Préparation de ${selectedModel}…`;
    engine = await webllm.CreateMLCEngine(selectedModel, { initProgressCallback:(p)=>{
      const pct=Math.max(0,Math.min(100,Math.round((p.progress||0)*100))); els.progressBar.style.width=`${pct}%`; els.progressText.textContent=p.text||`Téléchargement du cerveau local : ${pct}%`;
    }});
    els.progressBar.style.width='100%'; els.brain.textContent=`Cerveau local : actif`; els.brain.classList.remove('warn'); els.brain.classList.add('ok');
    els.loadBrain.textContent='Cerveau local actif'; setMode('idle');
    addMessage('system',`Cerveau local chargé : ${selectedModel}. Les réponses sont calculées sur cet appareil.`);
  }catch(err){ console.error(err); setMode('error'); els.loadBrain.disabled=false; els.progressText.textContent=`Erreur : ${err.message||err}`; addMessage('system','Impossible de charger le modèle local. Vérifie WebGPU, la connexion Internet initiale et l’espace disponible.'); }
};

function identityPrompt(){
  const memories=state.memories.slice(-30).map(m=>`- ${m.text}`).join('\n') || '- Aucune mémoire enregistrée.';
  return `Tu es JARVIS, l'assistant personnel de ${state.user||'Fred'}. Tu réponds toujours en français sauf demande contraire. Ton caractère est calme, précis, direct, légèrement humoristique et jamais théâtral. Tu distingues les faits des hypothèses. Tu ne prétends jamais avoir utilisé Internet, une caméra, un fichier ou un outil si aucun outil réel ne t'a fourni ce résultat. Tu reconnais clairement tes limites. Tu peux utiliser la mémoire suivante comme contexte personnel :\n${memories}`;
}
function normalizeMemory(text){ return text.replace(/^souviens[- ]toi\s+(que\s+)?/i,'').trim().replace(/[. ]+$/,''); }
function tryLocalCommand(text){
  if(/^souviens[- ]toi/i.test(text)){
    const memory=normalizeMemory(text); if(memory){ state.memories.push({id:crypto.randomUUID(),text:memory,createdAt:new Date().toISOString()}); saveState(); return `C’est mémorisé : « ${memory} ». Tu peux consulter ou supprimer cette mémoire dans les paramètres.`; }
  }
  if(/(montre|affiche|quelle est|que sais-tu).*mémoire|que sais-tu sur moi/i.test(text)){
    if(!state.memories.length) return 'Ma mémoire locale ne contient encore aucune information personnelle enregistrée.';
    return 'Voici ce que tu m’as demandé de mémoriser :\n' + state.memories.map((m,i)=>`${i+1}. ${m.text}`).join('\n');
  }
  return null;
}
async function askJarvis(text){
  const local=tryLocalCommand(text); if(local) return local;
  if(!engine) return 'Mon JARVIS CORE fonctionne, mais mon cerveau linguistique local n’est pas encore chargé. Appuie sur « Activer le cerveau local » pour télécharger le modèle open source sur cet appareil.';
  const recent=state.history.slice(-12).map(m=>({role:m.role==='jarvis'?'assistant':'user',content:m.text}));
  const messages=[{role:'system',content:identityPrompt()},...recent,{role:'user',content:text}];
  const completion=await engine.chat.completions.create({messages,temperature:.6,max_tokens:500});
  return completion.choices?.[0]?.message?.content?.trim() || 'Je n’ai reçu aucune réponse du moteur local.';
}
async function send(text){
  text=(text||'').trim(); if(!text) return; addMessage('user',text); els.input.value=''; setMode('thinking');
  try{ const answer=await askJarvis(text); addMessage('jarvis',answer); if(state.settings.autoSpeak) speak(answer); else setMode('idle'); }
  catch(err){ console.error(err); setMode('error'); addMessage('jarvis',`Je rencontre une erreur locale : ${err.message||err}`); }
}
els.form.addEventListener('submit',e=>{e.preventDefault();send(els.input.value);});
els.input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();els.form.requestSubmit();}});

function setupRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR) return null;
  const r=new SR(); r.lang='fr-BE'; r.interimResults=true; r.continuous=false;
  r.onstart=()=>{listening=true;setMode('listening');};
  r.onresult=e=>{let final='';let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal) final+=t; else interim+=t;} els.hint.textContent=final||interim||'Je t’écoute…'; if(final.trim()) send(final.trim());};
  r.onerror=e=>{listening=false;setMode('error');addMessage('system',`Microphone : ${e.error}.`);}; r.onend=()=>{listening=false;if(!speechSynthesis.speaking) setMode('idle');}; return r;
}
recognition=setupRecognition();
function toggleVoice(){
  if(speechSynthesis.speaking){speechSynthesis.cancel();setMode('idle');return;}
  if(!recognition){toast('La reconnaissance vocale n’est pas disponible dans ce navigateur.');return;}
  try{ if(listening) recognition.stop(); else recognition.start(); } catch{}
}
els.face.onclick=toggleVoice; els.face.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleVoice();}}; els.voiceBtn.onclick=toggleVoice;

function populateVoices(){
  const voices=speechSynthesis.getVoices(); const fr=voices.filter(v=>v.lang?.toLowerCase().startsWith('fr')); const list=fr.length?fr:voices;
  els.voiceSelect.innerHTML=''; list.forEach(v=>{const o=document.createElement('option');o.value=v.name;o.textContent=`${v.name} (${v.lang})`;els.voiceSelect.appendChild(o);});
}
populateVoices(); speechSynthesis.onvoiceschanged=populateVoices;
function speak(text){
  if(!('speechSynthesis'in window)){setMode('idle');return;} speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text.replace(/[*#`]/g,'')); u.lang='fr-BE'; u.rate=Number(state.settings.voiceRate||1); const v=speechSynthesis.getVoices().find(v=>v.name===els.voiceSelect.value); if(v)u.voice=v; u.onstart=()=>setMode('speaking');u.onend=()=>setMode('idle');u.onerror=()=>setMode('idle');speechSynthesis.speak(u);
}

function downloadJSON(){
  const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),user:state.user,memories:state.memories,history:state.history},null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`jarvis-memoire-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
}
document.querySelectorAll('[data-tool]').forEach(btn=>btn.onclick=()=>{const t=btn.dataset.tool;if(t==='memory') send('Montre ma mémoire');if(t==='export') downloadJSON();});
$('#clearChat').onclick=()=>{els.messages.innerHTML='';state.history=[];saveState();addMessage('system','Conversation effacée de cet appareil.',false);};
els.settingsBtn.onclick=()=>els.settings.classList.remove('hidden'); els.closeSettings.onclick=()=>els.settings.classList.add('hidden');
$('#exportMemory').onclick=downloadJSON; $('#deleteMemory').onclick=()=>{if(confirm('Supprimer toute la mémoire et l’historique locaux de JARVIS sur cet appareil ?')){state.memories=[];state.history=[];saveState();els.messages.innerHTML='';addMessage('system','Mémoire locale supprimée.',false);}};
els.userName.value=state.user||'Fred'; els.autoSpeak.checked=state.settings.autoSpeak!==false; els.rememberChat.checked=state.settings.rememberChat!==false; els.voiceRate.value=state.settings.voiceRate||1;
els.userName.onchange=()=>{state.user=els.userName.value.trim()||'Fred';saveState();}; els.autoSpeak.onchange=()=>{state.settings.autoSpeak=els.autoSpeak.checked;saveState();}; els.rememberChat.onchange=()=>{state.settings.rememberChat=els.rememberChat.checked;saveState();}; els.voiceRate.oninput=()=>{state.settings.voiceRate=Number(els.voiceRate.value);saveState();};

state.history.slice(-20).forEach(m=>addMessage(m.role,m.text,false));
if(!state.history.length) addMessage('jarvis','Bonsoir Fred. Je suis JARVIS. Mon interface est prête. Active mon cerveau local une première fois pour que je puisse répondre avec un modèle open source directement sur ta tablette.',false);
setMode('idle');
setTimeout(()=>{ if(!isStandalone()&&!deferredInstallPrompt&&!sessionStorage.getItem('jarvisSkipInstall')&&location.protocol==='https:'){ els.installGate.classList.remove('hidden'); els.installHelp.textContent='Si le bouton Installer ne s’active pas : menu du navigateur → Installer l’application / Ajouter à l’écran d’accueil.'; } },1800);
