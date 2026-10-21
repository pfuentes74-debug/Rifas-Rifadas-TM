/* Rifas Rifadas TM — selector de números y registro de pagos */
const firebaseConfig = {
  apiKey: "AIzaSyA9ZT6I1xpx2Stg_-pbwVJYtwrW86kr_4E",
  authDomain: "rifas-rifadas-tm.firebaseapp.com",
  databaseURL: "https://rifas-rifadas-tm-default-rtdb.firebaseio.com",
  projectId: "rifas-rifadas-tm",
  storageBucket: "rifas-rifadas-tm.firebasestorage.app",
  messagingSenderId: "328661520036",
  appId: "1:328661520036:web:5745510b9a029b8d362031"
};
let db = null;
let firebaseReady = false;
let firebaseInitMessage = 'Firebase todavía no está disponible.';
try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    firebaseReady = true;
    firebaseInitMessage = '';
  }
} catch (initError) {
  console.error('No se pudo inicializar Firebase:', initError);
  firebaseInitMessage = 'No se pudo iniciar Firebase. La selección funciona en modo de vista previa, pero no se pueden apartar boletos.';
}
const CONFIG = { total: 60000, digits: 5, price: 20, thresholdPercent: 70, thresholdTickets: 42000, draw: new Date('2026-11-20T20:00:00-06:00'), pageSize: 100 };
const LS_KEY = 'rifa_pago_registro_edicion2';
// Datos aislados de la primera edición para que sus números no aparezcan ocupados aquí.
const DATA_ROOT = 'segundaEdicion';
const ticketsRef = () => db?.ref(`${DATA_ROOT}/tickets`) ?? null;
const phonesRef = () => db?.ref(`${DATA_ROOT}/phones`) ?? null;
const registrationsRef = () => db?.ref(`${DATA_ROOT}/registrations`) ?? null;
const shotsRef = () => db?.ref(`${DATA_ROOT}/shots`) ?? null;
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(CONFIG.digits, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let occ = {}, loaded = true, dbConnected = false, connectionError = false, page = 0;
const selected = new Set();
const stateOf = n => { const v=occ[n]; if(!v)return 'free'; if(v==='c'||(v&&v.s==='paid'))return 'paid'; return 'hold'; };

function showConnectionState() {
  const msg = $('#pickerMessage');
  if (!msg) return;
  if (dbConnected) {
    msg.textContent = 'Conectado: disponibilidad en tiempo real. Verde = disponible; rojo = apartado o confirmado.';
    msg.classList.remove('picker-error');
  } else {
    msg.textContent = 'MODO DE VISTA PREVIA: no se pudo conectar con Firebase. Puedes probar el selector, pero la disponibilidad no está verificada y no se aceptarán apartados hasta recuperar la conexión.';
    msg.classList.add('picker-error');
  }
}

function startFirebaseListener() {
  const ref = ticketsRef();
  if (!ref) {
    connectionError = true;
    showConnectionState();
    renderTicketGrid();
    return;
  }
  try {
    ref.on('value', snap => {
      occ = snap.val() || {};
      loaded = true;
      dbConnected = true;
      connectionError = false;
      // Si alguien aparta un número mientras otro usuario lo tiene seleccionado, se deselecciona.
      for (const n of [...selected]) if (stateOf(n) !== 'free') selected.delete(n);
      renderTicketGrid(); renderSelected(); renderDrawThreshold(); showConnectionState();
    }, err => {
      console.error('Firebase rechazó la lectura de disponibilidad:', err);
      dbConnected = false;
      connectionError = true;
      // El selector no se congela: permite probar la interfaz, pero el envío queda bloqueado.
      renderTicketGrid(); showConnectionState();
    });
  } catch (err) {
    console.error('No se pudo iniciar la lectura de Firebase:', err);
    dbConnected = false; connectionError = true;
    renderTicketGrid(); showConnectionState();
  }
}

function renderDrawThreshold(){
  const statusEl=$('#drawConditionStatus');
  if(statusEl) statusEl.textContent='La fecha del sorteo está sujeta a alcanzar el 70% de boletos vendidos y pagados (42,000 de 60,000). Los números apartados o con pago pendiente no cuentan como vendidos.';
}

function tick(){
  let s=Math.max(0,Math.floor((CONFIG.draw-new Date())/1000));
  const d=Math.floor(s/86400);s-=d*86400;const h=Math.floor(s/3600);s-=h*3600;const m=Math.floor(s/60);s-=m*60;
  [['#cD',d],['#cH',h],['#cM',m],['#cS',s]].forEach(([id,v])=>{const el=$(id);if(el)el.textContent=String(v).padStart(2,'0');});
}
tick(); setInterval(tick,1000);

function renderTicketGrid(){
  const grid=$('#ticketGrid'); if(!grid)return;
  const start=page*CONFIG.pageSize+1, end=Math.min(CONFIG.total,start+CONFIG.pageSize-1);
  const html=[];
  for(let n=start;n<=end;n++){
    const state=stateOf(n),isSelected=selected.has(n),unavailable=dbConnected&&state!=='free';
    const label=!dbConnected?'vista previa, disponibilidad no verificada':state==='paid'?'Confirmado':state==='hold'?'Apartado':'Disponible';
    html.push(`<button type="button" class="ticket-number${isSelected?' selected':''}${unavailable?' unavailable':''}${!dbConnected?' preview-only':''}" data-ticket="${n}" ${unavailable?'disabled':''} aria-label="Boleto ${pad(n)}: ${label}" aria-pressed="${isSelected}">${pad(n)}</button>`);
  }
  grid.innerHTML=html.join('');
  const from=$('#ticketPageLabel');if(from)from.textContent=`Números ${pad(start)}–${pad(end)}`;
  const prev=$('#prevTickets'),next=$('#nextTickets');if(prev)prev.disabled=!loaded||page===0;if(next)next.disabled=!loaded||end>=CONFIG.total;
  if (dbConnected) { const msg=$('#pickerMessage');if(msg)msg.textContent='Selecciona números verdes disponibles. Los números rojos están apartados o confirmados.'; }
}
function renderSelected(){
  const out=$('#selectedTickets'),counter=$('#selectedCounter'),qty=$('#selectedQty'),total=$('#paymentTotal');
  const nums=[...selected].sort((a,b)=>a-b);
  if(counter)counter.textContent=`${nums.length} seleccionado${nums.length===1?'':'s'}`;
  if(qty)qty.textContent=`${nums.length} número${nums.length===1?'':'s'}`;
  if(total)total.textContent='$'+(nums.length*CONFIG.price).toLocaleString('es-MX');
  if(out)out.innerHTML=nums.length?nums.map(n=>`<span class="selected-ticket">${pad(n)} <button type="button" data-remove-ticket="${n}" aria-label="Quitar ${pad(n)}">×</button></span>`).join(''):'<span class="empty-selection">Todavía no has elegido números.</span>';
}
function toggleTicket(n){
  if(dbConnected && stateOf(n)!=='free'){setPickerMessage(`El boleto ${pad(n)} ya no está disponible. Elige otro número.`);renderTicketGrid();return;}
  if(selected.has(n))selected.delete(n);else selected.add(n);
  renderTicketGrid();renderSelected();
  setPickerMessage(selected.size?`Llevas ${selected.size} número(s) seleccionados. Total: $${(selected.size*CONFIG.price).toLocaleString('es-MX')} MXN.`:'Selecciona los números que quieras comprar.');
}
function setPickerMessage(text){const el=$('#pickerMessage');if(el)el.textContent=text;}
$('#ticketGrid')?.addEventListener('click',e=>{const b=e.target.closest('[data-ticket]');if(b)toggleTicket(Number(b.dataset.ticket));});
$('#selectedTickets')?.addEventListener('click',e=>{const b=e.target.closest('[data-remove-ticket]');if(b){selected.delete(Number(b.dataset.removeTicket));renderTicketGrid();renderSelected();}});
$('#clearTickets')?.addEventListener('click',()=>{selected.clear();renderTicketGrid();renderSelected();setPickerMessage('Selección eliminada. Elige los números que quieras.');});
$('#prevTickets')?.addEventListener('click',()=>{if(page>0){page--;renderTicketGrid();}});
$('#nextTickets')?.addEventListener('click',()=>{if((page+1)*CONFIG.pageSize<CONFIG.total){page++;renderTicketGrid();}});
function searchTicket(){const input=$('#ticketSearch'),n=Number(input?.value);if(!Number.isInteger(n)||n<1||n>CONFIG.total){setPickerMessage('Escribe un número entre 00001 y 60000.');return;}page=Math.floor((n-1)/CONFIG.pageSize);renderTicketGrid();if(stateOf(n)==='free'){if(!selected.has(n))selected.add(n);renderTicketGrid();renderSelected();setPickerMessage(`El boleto ${pad(n)} está disponible y se agregó a tu selección.`);}else{setPickerMessage(`El boleto ${pad(n)} ya está ${stateOf(n)==='paid'?'confirmado':'apartado'}. Elige otro.`);}$('#ticketGrid')?.querySelector(`[data-ticket="${n}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'});}
$('#searchTicketBtn')?.addEventListener('click',searchTicket);
$('#ticketSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchTicket();}});

// Paquetes rápidos y "maquinita de la suerte": agregan números aleatorios disponibles
// sin reemplazar los que el participante ya eligió manualmente.
function findRandomFreeTicket(){
  if(!loaded)return null;
  // Primero prueba posiciones aleatorias para evitar recorrer siempre desde el inicio.
  for(let i=0;i<500;i++){
    const n=1+Math.floor(Math.random()*CONFIG.total);
    if(stateOf(n)==='free'&&!selected.has(n))return n;
  }
  // Si hay muchos números ocupados, realiza una búsqueda completa desde un punto aleatorio.
  const start=1+Math.floor(Math.random()*CONFIG.total);
  for(let i=0;i<CONFIG.total;i++){
    const n=((start-1+i)%CONFIG.total)+1;
    if(stateOf(n)==='free'&&!selected.has(n))return n;
  }
  return null;
}
function addRandomTickets(target){
  if(!loaded){setPickerMessage('Todavía se está preparando el selector. Intenta de nuevo.');return;}
  if(selected.size>target){setPickerMessage(`Ya tienes ${selected.size} números seleccionados. Quita algunos para usar el paquete de ${target}.`);return;}
  if(target>100){setPickerMessage('Puedes seleccionar hasta 100 números por solicitud.');return;}
  let added=0;
  while(selected.size<target){
    const n=findRandomFreeTicket();
    if(n===null)break;
    selected.add(n);added++;
  }
  if(added===0&&selected.size<target){setPickerMessage('No se encontraron suficientes números disponibles para completar el paquete.');return;}
  // Conserva la página que el usuario está viendo; los números al azar quedan listados abajo.
  renderTicketGrid();renderSelected();
  const amount=selected.size*CONFIG.price;
  setPickerMessage(added===0?`Ya tienes ${selected.size} números seleccionados. Total: $${amount.toLocaleString('es-MX')} MXN.`:`Se agregaron ${added} número(s) al azar. Tienes ${selected.size} en total: $${amount.toLocaleString('es-MX')} MXN.`);
}
document.querySelectorAll('[data-pick-count]').forEach(btn=>btn.addEventListener('click',()=>addRandomTickets(Number(btn.dataset.pickCount))));
$('#luckyPickBtn')?.addEventListener('click',()=>addRandomTickets(selected.size+1));

function compress(file){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);let max=1100,q=.65;for(let k=0;k<6;k++){const r=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*r));c.height=Math.max(1,Math.round(img.height*r));c.getContext('2d').drawImage(img,0,0,c.width,c.height);const data=c.toDataURL('image/jpeg',q);if(data.length<380000)return resolve(data);max=Math.round(max*.8);q=Math.max(.3,q-.07);}reject(new Error('big'));};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('read'));};img.src=url;});}
$('#fShot')?.addEventListener('change',e=>{const f=e.target.files[0],p=$('#shotPrev');if(!p)return;if(!f){p.hidden=true;return;}p.src=URL.createObjectURL(f);p.hidden=false;});
function showErr(msg){const e=$('#regErr');if(e){e.textContent=msg;e.hidden=false;}}
function ticketHTML(nums){return nums.map(n=>{const st=stateOf(n),cls=st==='paid'?'ok':'pend',txt=st==='paid'?'Confirmado':'Pendiente de confirmar';return `<div class="tk ${cls}"><b>${pad(n)}</b><span>${txt}</span></div>`;}).join('');}
function showDone(nums,justNow){const wrap=$('#regWrap'),form=$('#regForm'),done=$('#regDone');if(wrap)wrap.hidden=true;else if(form)form.hidden=true;if(done)done.hidden=false;const title=$('#doneTitle'),text=$('#doneText'),out=$('#doneNums');if(title)title.textContent=justNow?'Comprobante recibido':'Tus números';if(text)text.textContent='Los números quedaron apartados como pendientes. El equipo debe revisar el comprobante para confirmar el pago. Guarda tus números para consultar el estado.';if(out)out.innerHTML=ticketHTML(nums);}
function renderMine(){try{const saved=JSON.parse(localStorage.getItem(LS_KEY)||'null');if(saved&&loaded&&saved.nums?.some(n=>occ[n]))showDone(saved.nums,false);}catch(e){}}

async function reserveTicket(n){
  const ref=ticketsRef().child(String(n));
  const result=await ref.transaction(current=>current==null?'p':undefined,false);
  return result.committed;
}
async function releaseTicket(n){try{await ticketsRef().child(String(n)).transaction(current=>current==='p'?null:undefined,false);}catch(e){console.warn('No se pudo liberar el boleto',n,e);}}

$('#regForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const err=$('#regErr');if(err)err.hidden=true;
  const name=$('#fName').value.trim().replace(/\s+/g,' '),phone=$('#fPhone').value.replace(/\D/g,''),file=$('#fShot').files[0],nums=[...selected].sort((a,b)=>a-b),total=nums.length*CONFIG.price;
  if(name.length<5||!name.includes(' '))return showErr('Escribe tu nombre completo.');
  if(phone.length!==10)return showErr('Escribe tu teléfono a 10 dígitos.');
  if(!nums.length)return showErr('Primero elige al menos un número en el selector de boletos.');
  if(!file)return showErr('Adjunta el comprobante de pago.');
  if(!$('#fAge').checked)return showErr('Confirma que eres mayor de edad.');
  if(!loaded)return showErr('El selector todavía se está preparando. Intenta de nuevo en unos segundos.');
  if(!dbConnected)return showErr('No hay conexión con Firebase. Tus números no se pueden apartar de forma segura en este momento. Intenta más tarde o contacta al organizador.');
  if(nums.some(n=>stateOf(n)!=='free')){nums.filter(n=>stateOf(n)!=='free').forEach(n=>selected.delete(n));renderTicketGrid();renderSelected();return showErr('Uno o más números acaban de ser apartados por otra persona. Revisa tu selección e inténtalo de nuevo.');}
  const btn=$('#regBtn'),label=btn.textContent;btn.disabled=true;btn.textContent='Apartando números…';
  let reserved=[];
  try{
    const existing=await phonesRef().child(phone).get();
    if(existing.exists())return showErr('Este teléfono ya tiene un registro. Comunícate por WhatsApp para revisar una compra adicional.');
    let proof;try{proof=await compress(file);}catch(e){return showErr('No pudimos leer el comprobante. Prueba con una imagen JPG o PNG más clara.');}
    // Cada número se reclama con una transacción de Firebase para evitar que dos personas obtengan el mismo boleto.
    for(const n of nums){const ok=await reserveTicket(n);if(!ok){for(const r of reserved)await releaseTicket(r);reserved=[];renderTicketGrid();return showErr(`El boleto ${pad(n)} acaba de ser apartado por otra persona. Elige otro número e inténtalo de nuevo.`);}reserved.push(n);}
    const numsText=nums.join(',');
    const updates={};
    updates[`${DATA_ROOT}/phones/${phone}`]=numsText;
    updates[`${DATA_ROOT}/registrations/${phone}`]={edition:2,name,phone,nums:numsText,qty:nums.length,amount:total,status:'pending',paymentStatus:'pending',ts:firebase.database.ServerValue.TIMESTAMP};
    updates[`${DATA_ROOT}/shots/${phone}`]=proof;
    try{await db.ref().update(updates);}catch(error){for(const r of reserved)await releaseTicket(r);reserved=[];throw error;}
    localStorage.setItem(LS_KEY,JSON.stringify({phone,nums}));
    showDone(nums,true);$('#regForm').reset();$('#shotPrev').hidden=true;selected.clear();renderSelected();renderTicketGrid();
  }catch(error){console.error(error);showErr('No se pudo guardar el registro. Revisa tu conexión e inténtalo de nuevo.');}
  finally{btn.disabled=false;btn.textContent=label;}
});

$('#vForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const raw=$('#vIn').value,parts=raw.split(/[\s,;]+/).map(p=>p.replace(/\D/g,'')).filter(Boolean),unique=[...new Set(parts)],out=$('#vOut');if(!unique.length){out.innerHTML='<p class="legal">Escribe al menos un número o teléfono.</p>';return;}
  const cards=[];
  for(const p of unique){
    if(p.length===10){try{const s=await phonesRef().child(p).get();if(!s.exists()){cards.push(`<article class="res err wide"><div><h3>${esc(p)}: sin registro</h3><p>Ese teléfono no aparece registrado.</p></div></article>`);continue;}const nums=String(s.val()).split(',').map(Number);cards.push(`<article class="res wide"><div><h3>Registro encontrado</h3><p>Números asociados a ${esc(p)}:</p><div class="mine">${ticketHTML(nums)}</div></div></article>`);}catch(e){cards.push('<p class="legal">No se pudo consultar el teléfono.</p>');}}
    else{const n=Number(p);if(!Number.isInteger(n)||n<1||n>CONFIG.total){cards.push(`<article class="res err wide"><div><h3>${esc(p)} no es un número válido</h3><p>Usa un número entre 00001 y 60000.</p></div></article>`);continue;}const st=stateOf(n),stamp=st==='paid'?'Confirmado':st==='hold'?'Apartado':'Disponible';cards.push(`<article class="res ${st==='paid'?'paid':st==='hold'?'hold':'free'}"><div class="res-num">${pad(n)}</div><div><h3>${stamp}</h3><p>${st==='paid'?'Este número está confirmado.':st==='hold'?'El pago de este número está pendiente de revisión.':'Este número aparece disponible en este momento.'}</p></div><div class="stamp">${stamp}</div></article>`);}
  }
  out.innerHTML=cards.join('');
});

document.querySelectorAll('[data-copy]').forEach(btn=>btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(btn.dataset.copy);btn.textContent='Copiado';setTimeout(()=>btn.textContent='Copiar número',1600);}catch(e){alert('No se pudo copiar automáticamente. Selecciona y copia el número.');}}));

renderSelected();

// Inicializa la vista inmediatamente para que los controles no se queden congelados si Firebase falla.
renderTicketGrid();
renderSelected();
renderDrawThreshold();
startFirebaseListener();
