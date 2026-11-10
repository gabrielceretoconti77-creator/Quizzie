/*
 * Mi Quizlet · lógica de la aplicación (JavaScript puro, sin framework)
 *
 * MODELO DE DATOS (se guarda tal cual en localStorage y en Supabase):
 *   db = { decks: [ { id, name, cards: [ { t, d, ti, di, b, due } ] } ] }
 *     t   = término             d   = definición (ambos pueden tener varios párrafos)
 *     ti  = id de imagen del término (opcional)   di = id de imagen de la definición (opcional)
 *     b   = "caja" Leitner 0-5  due = fecha (ms) del próximo repaso
 *   Las imágenes NO van dentro de db: se guardan aparte (IndexedDB + Supabase Storage), ver sección 2b.
 *   Una tarjeta está dominada cuando b >= 3.
 *
 * FLUJO: cada pantalla es una función que pinta HTML en #app (inicio, editor,
 * verUnidad, flashcards, aprender, modoTest, pantallaResultados).
 * Los botones llaman a esas funciones con onclick, por eso son globales.
 */
const $ = s => document.querySelector(s), app = $('#app'), MS_DIA = 864e5, INTERVALOS = [0, 1, 2, 4, 8, 16];
// ============================================================
// 1. ESTADO GLOBAL Y UTILIDADES
// ============================================================
let db, unidad, atajo, dir = 'td';
try {
  db = JSON.parse(localStorage.getItem('mq'));
}
catch (x) { }
if (!db || !db.decks)
  db = { decks: [{ id: 'd0', name: 'Ejemplo: Capitales de Europa', cards: 'Francia|París;España|Madrid;Italia|Roma;Alemania|Berlín;Portugal|Lisboa;Grecia|Atenas;Austria|Viena'.split(';').map(p => { p = p.split('|'); return { t: p[0], d: p[1], b: 0, due: 0 }; }) }] };
// ============================================================
// 2. CUENTAS Y SINCRONIZACIÓN (SUPABASE)
// ============================================================
/* ⚙️ CONFIGURACIÓN SUPABASE: pega aquí la URL y la clave anon/publishable de tu proyecto (Project Settings → API). Nunca uses la service_role. */


const SB_URL = 'https://vmydzaqkedrjklawtdjw.supabase.co', SB_KEY = 'sb_publishable_dk2JrfqWlPmlJWUji9lh-w_XvhQOx7O';
const sb = window.supabase && !SB_URL.includes('TU-PROYECTO') ? supabase.createClient(SB_URL, SB_KEY) : null;
const sm0 = '💾 Guardado solo en este navegador.';
let uid, mail, pt, sm = sm0;
const serializar = () => JSON.stringify(db, (k, v) => k == '_s' || k == '_f' ? undefined : v), mostrarEstado = m => { sm = m; const z = $('#sync'); if (z)
  z.textContent = m; };
const guardarLocal = () => { try {
  localStorage.setItem('mq', serializar());
}
catch (x) { } clearTimeout(pt); pt = setTimeout(subirANube, 1200); };
async function subirANube() { if (!sb || !uid)
  return; try {
  await subirImgsPend();
  const { error } = await sb.from('user_data').upsert({ user_id: uid, data: JSON.parse(serializar()), updated_at: new Date().toISOString() });
  if (error)
    throw error;
  mostrarEstado(pend.size ? '⚠️ Texto guardado, pero faltan imágenes por subir (¿has ejecutado supabase.sql?)' : '☁️ Guardado en tu cuenta');
}
catch (x) {
  mostrarEstado('⚠️ No se pudo sincronizar; sigue guardado en este navegador');
} }
const panelCuenta = () => !sb ? '<p class="mu s" id="sync">💾 Modo local: pon tu URL y clave de Supabase en el código para activar las cuentas.</p>' : uid ? `<p class="mu s"><span id="sync">${sm}</span> · ${esc(mail)} · <a style="cursor:pointer;color:var(--ac)" onclick="cerrarSesion()">Cerrar sesión</a></p>` : `<div class="c"><b>☁️ Guarda tus unidades en tu cuenta</b><p class="mu s" id="sync">${sm}</p><input id="em" type="email" placeholder="Correo" autocomplete="email"><input id="pw" type="password" placeholder="Contraseña (mínimo 6 caracteres)" autocomplete="current-password" style="margin-top:8px"><div class="r"><button class="b" onclick="autenticar(0)">Entrar</button><button class="b gh" onclick="autenticar(1)">Crear cuenta</button></div></div>`;
async function autenticar(up) {
  const c = { email: $('#em').value.trim(), password: $('#pw').value };
  mostrarEstado('…');
  const { data, error } = up ? await sb.auth.signUp(c) : await sb.auth.signInWithPassword(c);
  if (error)
    return mostrarEstado('⚠️ ' + error.message);
  if (up && !data.session)
    mostrarEstado('📧 Revisa tu correo para confirmar la cuenta y después pulsa Entrar');
}
async function cerrarSesion() { await sb.auth.signOut(); db = { decks: [] }; try {
  localStorage.removeItem('mq');
}

catch (x) { } try { await idbOp('readwrite', s => s.clear()); }
catch (x) { } pend.clear(); guardarPend(); cacheImg.forEach(u => URL.revokeObjectURL(u)); cacheImg.clear(); }
async function alCambiarSesion(s) {
  uid = s ? s.user.id : null;
  mail = s ? s.user.email : null;
  if (uid) {
    try {
      const { data, error } = await sb.from('user_data').select('data').eq('user_id', uid).maybeSingle();
      if (error)
        throw error;
      if (data && data.data && Array.isArray(data.data.decks)) {
        db = data.data;
        try {
          localStorage.setItem('mq', serializar());
        }
        catch (x) { }
        mostrarEstado('☁️ Sincronizado con tu cuenta');
      }
      else {
        mostrarEstado('☁️ Subiendo tus unidades…');
        await subirANube();
      }
    }
    catch (x) {
      mostrarEstado('⚠️ No se pudo sincronizar');
    }
  }
  else
    mostrarEstado(sm0);
  if ($('.g'))
    inicio();
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mezclar = a => { a = [...a]; for (let i = a.length; i > 1;) {
  let j = Math.random() * i-- | 0;
  [a[i], a[j]] = [a[j], a[i]];
} return a; };
const estaDominada = c => c.b >= 3, due = c => c.due <= Date.now();
const calificar = (c, ok) => { c.b = ok ? Math.min(5, c.b + 1) : 0; c.due = Date.now() + INTERVALOS[c.b] * MS_DIA; guardarLocal(); };
const normalizar = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').replace(/\(.*?\)/g, '').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
const esCorrecta = (v, a) => { v = normalizar(v); return !!v && [a, ...a.split(/[;\/]/)].some(x => normalizar(x) == v); };
/* Devuelve { q, a, f, qi, ai }: texto e imagen de la pregunta (q, qi) y de la respuesta (a, ai); f = campo de la respuesta ('t' o 'd').
   Con soloTexto=1 la respuesta siempre tiene texto (si el lado elegido solo tiene imagen, se pregunta al revés). */
const preguntarPor = (c, soloTexto) => { let r = dir == 'mix' ? Math.random() < .5 : dir == 'dt'; if (soloTexto && !c[r ? 't' : 'd']) r = !r; return r ? { q: c.d, a: c.t, f: 't', qi: c.di, ai: c.ti } : { q: c.t, a: c.d, f: 'd', qi: c.ti, ai: c.di }; };
addEventListener('keydown', ev => atajo && atajo(ev));
const animar = o => window.anime ? anime(o) : o.complete && o.complete(), escalonado = () => window.anime ? anime.stagger(60) : 0;
// ============================================================
// 2b. IMÁGENES DE LAS TARJETAS
// ============================================================
/* Cada imagen se reduce (máx. 1200 px, JPEG) y se guarda como Blob en IndexedDB del navegador.
   Si hay sesión iniciada, también se sube a Supabase Storage (bucket 'imagenes', carpeta = tu id de usuario)
   para que aparezca en tus otros dispositivos. La tarjeta solo guarda el id de la imagen. */
const BUCKET = 'imagenes', cacheImg = new Map(), pend = new Set();
try { JSON.parse(localStorage.getItem('mq-pend') || '[]').forEach(i => pend.add(i)); }
catch (x) { }
const guardarPend = () => { try { localStorage.setItem('mq-pend', JSON.stringify([...pend])); }
catch (x) { } };
const idb = new Promise((ok, ko) => { try { const r = indexedDB.open('mq-img', 1); r.onupgradeneeded = () => r.result.createObjectStore('i', { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }
catch (x) { ko(x); } });
const idbOp = (modo, f) => idb.then(d => new Promise((ok, ko) => { const t = d.transaction('i', modo), r = f(t.objectStore('i')); t.oncomplete = () => ok(r.result); t.onerror = t.onabort = () => ko(t.error); }));
async function reducirImagen(file, max = 1200) {
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.drawImage(bmp, 0, 0, w, h);
  return new Promise((ok, ko) => cv.toBlob(b => b ? ok(b) : ko(new Error('toBlob')), 'image/jpeg', .85));
}
async function imgGuardar(blob) {
  const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  await idbOp('readwrite', s => s.put({ id, blob }));
  if (sb) { pend.add(id); guardarPend(); }
  return id;
}
async function subirImgsPend() {
  if (!sb || !uid || !pend.size || subirImgsPend.busy) return;
  subirImgsPend.busy = 1;
  try {
    for (const id of [...pend]) {
      const r = await idbOp('readonly', s => s.get(id));
      if (r) { const { error } = await sb.storage.from(BUCKET).upload(`${uid}/${id}.jpg`, r.blob, { contentType: 'image/jpeg', upsert: true }); if (error) throw error; }
      pend.delete(id);
    }
  }
  catch (x) { }
  finally { subirImgsPend.busy = 0; guardarPend(); }
}
async function imgUrl(id) {
  if (cacheImg.has(id)) return cacheImg.get(id);
  let blob;
  try { const r = await idbOp('readonly', s => s.get(id)); blob = r && r.blob; }
  catch (x) { }
  if (!blob && sb && uid) {
    try { const { data, error } = await sb.storage.from(BUCKET).download(`${uid}/${id}.jpg`); if (!error && data) { blob = data; idbOp('readwrite', s => s.put({ id, blob })).catch(() => { }); } }
    catch (x) { }
  }
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  cacheImg.set(id, u);
  return u;
}
/* Rellena los <img data-img="id"> que haya dentro de root (se pintan ocultos y se muestran al cargar) */
function cargarImgs(root = document) { root.querySelectorAll('img[data-img]').forEach(async im => { const u = await imgUrl(im.dataset.img); if (u && im.isConnected) { im.src = u; im.hidden = false; } }); }
const imgHtml = (id, cl = '') => id ? `<img class="ci ${cl}" data-img="${id}" hidden alt="">` : '';
/* Una cara de flashcard: texto (con párrafos) + imagen. Si el texto es largo se alinea a la izquierda y se reduce */
const caraHtml = (tx, im) => `<div class="fcc">${tx ? `<div class="ml${tx.length > 110 || tx.includes('\n') ? ' lg' : ''}">${esc(tx)}</div>` : ''}${imgHtml(im)}</div>`;
const autoAlto = t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 4 + 'px'; };
// ============================================================
// 3. MENÚ PRINCIPAL, EDITOR Y PANTALLA DE UNIDAD
// ============================================================
function inicio() {
  atajo = null;
  app.innerHTML = `<header><h1>📚 Mi Quizlet</h1><button class="b" onclick="editor()">+ Nueva unidad</button></header><div class="g">${db.decks.map(d => { const n = d.cards.length, m = d.cards.filter(estaDominada).length, p = n ? Math.round(m / n * 100) : 0; return `<div class="c k" onclick="verUnidad('${d.id}')"><h3>${esc(d.name)}</h3><p class="mu s">${n} tarjetas · ${p}% dominado</p><div class="bar"><i style="width:${p}%"></i></div></div>`; }).join('') || '<p class="mu">Aún no tienes unidades. ¡Crea la primera!</p>'}</div>
${panelCuenta()}<details class="c"><summary>💾 Copia de seguridad</summary><p class="mu s">Tus datos se guardan en este navegador. Copia este texto para conservarlos o pega uno antiguo para restaurarlo.</p><textarea id="bkp" style="min-height:90px">${esc(JSON.stringify(db, (k, v) => k == '_s' ? undefined : v))}</textarea><div class="r"><button class="b gh" onclick="restaurarCopia()">Restaurar</button></div></details>`;
  animar({ targets: '.g .c', translateY: [14, 0], opacity: [0, 1], delay: escalonado(), duration: 350, easing: 'easeOutCubic' });
}
function restaurarCopia() { try {
  const x = JSON.parse($('#bkp').value);
  if (!x.decks)
    throw 0;
  db = x;
  guardarLocal();
  inicio();
}
catch (_) {
  $('#bkp').value = 'Formato no válido';
} }
function editor(id) {
  atajo = null;
  const d = db.decks.find(x => x.id == id), cards = d && d.cards.length ? d.cards : null;
  app.innerHTML = `<header><h1>${d ? 'Editar' : 'Nueva'} unidad</h1></header><div class="c"><p class="mu s">Nombre</p><input id="nm" value="${d ? esc(d.name) : ''}" placeholder="Ej: Inglés – Tema 3"><p class="mu s">Tarjetas · Enter = nuevo párrafo · Ctrl+Enter = siguiente casilla · 🖼 añade una imagen a cada lado (también puedes pegarla con Ctrl+V o arrastrarla). Si hay varias respuestas válidas, sepáralas con / o ;</p><div id="rows">${(cards || [{}, {}, {}, {}]).map((c, k) => filaHtml(c, cards ? k : '')).join('')}</div><div class="r"><button class="b gh" onclick="anadirFila()">+ Añadir tarjeta</button></div><details><summary>Importar texto pegado (Quizlet, Excel…)</summary><p class="mu s">Una tarjeta por línea: término y definición separados por tabulador o ::</p><textarea id="tx" style="min-height:110px"></textarea><div class="r"><button class="b gh" onclick="importarTexto()">Añadir al listado</button></div></details><div class="r"><button class="b" onclick="guardarUnidad('${id || ''}')">Guardar</button><button class="b gh" onclick="${d ? `verUnidad('${id}')` : 'inicio()'}">Cancelar</button></div></div>`;
  const R = $('#rows');
  // Enter = salto de línea (comportamiento normal del textarea). Ctrl/Cmd+Enter = saltar a la siguiente casilla / fila
  R.onkeydown = ev => { if (ev.key != 'Enter' || !(ev.ctrlKey || ev.metaKey)) return; const sd = ev.target.closest('.side'); if (!sd) return; ev.preventDefault(); const r = sd.closest('.er'); if (sd.classList.contains('lt'))
    r.querySelector('.ld .tx').focus();
  else
    (r.nextElementSibling || anadirFila()).querySelector('.lt .tx').focus(); };
  R.oninput = ev => { if (ev.target.classList.contains('tx')) autoAlto(ev.target); };
  R.onchange = ev => { const f = ev.target.files && ev.target.files[0]; if (f) { ponerImagen(ev.target.closest('.side'), f); ev.target.value = ''; } };
  R.onclick = ev => { const b = ev.target.closest('.x'); if (b) setImg(b.closest('.side'), null); };
  const imgDe = dt => [...(dt.files || [])].find(f => f.type.startsWith('image/'));
  R.onpaste = ev => { const f = imgDe(ev.clipboardData), sd = ev.target.closest('.side'); if (f && sd) { ev.preventDefault(); ponerImagen(sd, f); } };
  R.ondragover = ev => { if ([...ev.dataTransfer.types].includes('Files')) ev.preventDefault(); };
  R.ondrop = ev => { const f = imgDe(ev.dataTransfer), sd = ev.target.closest('.side'); if (f && sd) { ev.preventDefault(); ponerImagen(sd, f); } };
  R.querySelectorAll('.tx').forEach(autoAlto);
  cargarImgs(R);
  if (!d)
    $('.tx').focus();
}
async function ponerImagen(sd, file) { try { setImg(sd, await imgGuardar(await reducirImagen(file))); }
catch (x) { alert('No se pudo cargar esa imagen. Prueba con un JPG o PNG.'); } }
function setImg(sd, id) { if (id) sd.dataset.i = id; else delete sd.dataset.i; const t = sd.querySelector('.th'); t.innerHTML = id ? thumbHtml(id) : ''; cargarImgs(t); }
const thumbHtml = im => `<img data-img="${im}" hidden alt=""><button type="button" class="b gh sm x" title="Quitar imagen">✕</button>`;
const ladoHtml = (cl, ph, tx, im) => `<div class="side ${cl}"${im ? ` data-i="${im}"` : ''}><textarea class="tx" rows="1" placeholder="${ph}">${esc(tx || '')}</textarea><div class="im"><label class="b gh sm">🖼 Imagen<input type="file" accept="image/*" hidden></label><span class="th">${im ? thumbHtml(im) : ''}</span></div></div>`;
/* c = { t, d, ti, di }; k = posición de la tarjeta original (para conservar su progreso al guardar) */
function filaHtml(c = {}, k = '') { return `<div class="er" data-k="${k}">${ladoHtml('lt', 'Término', c.t, c.ti)}${ladoHtml('ld', 'Definición', c.d, c.di)}<button class="b gh" title="Quitar tarjeta" onclick="this.parentNode.remove()">✕</button></div>`; }
function anadirFila(c) { $('#rows').insertAdjacentHTML('beforeend', filaHtml(c)); const r = $('#rows').lastElementChild; r.querySelectorAll('.tx').forEach(autoAlto); animar({ targets: r, opacity: [0, 1], translateY: [-8, 0], duration: 250, easing: 'easeOutCubic' }); return r; }
function importarTexto() { const x = $('#tx'); x.value.split('\n').map(l => l.split(/\t| :: |::/).map(s => s.trim())).filter(p => p[0] && p[1]).forEach(p => anadirFila({ t: p[0], d: p.slice(1).join(' :: ') })); x.value = ''; }
function guardarUnidad(id) {
  const nm = $('#nm').value.trim() || 'Sin título', old = id ? db.decks.find(x => x.id == id) : null, usadas = new Set();
  const lee = (r, l) => { const e = r.querySelector(l); return [e.querySelector('.tx').value.trim(), e.dataset.i || '']; };
  // Una tarjeta vale si cada lado tiene texto o imagen y al menos un lado tiene texto
  const cs = [...document.querySelectorAll('.er')].map(r => { const [t, ti] = lee(r, '.lt'), [d, di] = lee(r, '.ld'); return { t, ti, d, di, k: r.dataset.k }; })
    .filter(p => (p.t || p.ti) && (p.d || p.di) && (p.t || p.d))
    .map(p => {
    // Si el texto no cambió se conserva el progreso de la tarjeta (aunque cambien las imágenes)
    let o = old && p.k !== '' ? old.cards[+p.k] : null;
    if (!o || o.t != p.t || o.d != p.d || usadas.has(o))
      o = old && old.cards.find(c => !usadas.has(c) && c.t == p.t && c.d == p.d && (c.ti || '') == p.ti && (c.di || '') == p.di);
    if (o) { usadas.add(o); o.ti = p.ti; o.di = p.di; return o; }
    return { t: p.t, d: p.d, ti: p.ti, di: p.di, b: 0, due: 0 };
  });
  if (old) {
    old.name = nm;
    old.cards = cs;
  }
  else
    db.decks.push({ id: 'd' + Date.now(), name: nm, cards: cs });
  guardarLocal();
  old ? verUnidad(id) : inicio();
}
function verUnidad(id) {
  atajo = null;
  unidad = db.decks.find(d => d.id == id);
  const n = unidad.cards.length, m = unidad.cards.filter(estaDominada).length, l = unidad.cards.filter(c => c.b && !estaDominada(c)).length, du = unidad.cards.filter(due).length;
  app.innerHTML = `<header><button class="b gh" onclick="inicio()">← Unidades</button><span><button class="b gh" onclick="editor('${id}')">Editar</button> <button class="b gh" id="del" onclick="eliminarUnidad()">Eliminar</button></span></header><h1>${esc(unidad.name)}</h1><p class="mu">${n} tarjetas · ✅ ${m} dominadas · 🟡 ${l} aprendiendo · ⚪ ${n - m - l} nuevas</p><div class="bar"><i style="width:${n ? m / n * 100 : 0}%"></i></div>
<p>Preguntar por: <select onchange="dir=this.value"><option value="td" ${dir == 'td' ? 'selected' : ''}>Término → definición</option><option value="dt" ${dir == 'dt' ? 'selected' : ''}>Definición → término</option><option value="mix" ${dir == 'mix' ? 'selected' : ''}>Mezclado</option></select></p>
<div class="r"><button class="b" onclick="aprender(unidad.cards)">🧠 Aprender</button><button class="b" onclick="modoTest()">📝 Test</button><button class="b" onclick="flashcards(mezclar(unidad.cards))">🃏 Flashcards</button><button class="b gh" onclick="flashcards(mezclar(unidad.cards.filter(due)))">🔁 Repaso espaciado (${du})</button></div>
<div class="c">${unidad.cards.map(c => `<div class="row rw"><span>${c.b >= 3 ? '✅' : c.b ? '🟡' : '⚪'} <b class="ml">${esc(c.t)}</b>${imgHtml(c.ti, 'mini')}</span><span class="mu ml">${esc(c.d)}${imgHtml(c.di, 'mini')}</span></div>`).join('') || '<p class="mu">Esta unidad no tiene tarjetas. Pulsa Editar para añadirlas.</p>'}</div>`;
  cargarImgs(app);
}
function eliminarUnidad() { const b = $('#del'); if (b.dataset.s) {
  db.decks = db.decks.filter(x => x != unidad);
  guardarLocal();
  inicio();
}
else {
  b.dataset.s = 1;
  b.textContent = '¿Seguro? Púlsalo otra vez';
} }
// ============================================================
// 4. MODO FLASHCARDS
// ============================================================
function flashcards(cs, i = 0, ms = []) {
  if (!cs.length)
    return verUnidad(unidad.id);
  if (i >= cs.length) {
    atajo = null;
    app.innerHTML = `<div class="c"><h2>¡Ronda terminada!</h2><p>Sabías ${cs.length - ms.length} de ${cs.length}.</p><div class="r">${ms.length ? `<button class="b" id="rp">Repetir las ${ms.length} falladas</button>` : ''}<button class="b gh" onclick="verUnidad(unidad.id)">Volver</button></div></div>`;
    if (ms.length)
      $('#rp').onclick = () => flashcards(mezclar(ms));
    return;
  }
  const c = cs[i], P = preguntarPor(c), fr = caraHtml(P.q, P.qi), rv = caraHtml(P.a, P.ai);
  let side = 0;
  app.innerHTML = `<header><button class="b gh" onclick="verUnidad(unidad.id)">✕ Salir</button><span class="mu">${i + 1} / ${cs.length}</span></header><div class="pv"><div class="c fc" id="cd">${fr}</div></div><p class="mu s" style="text-align:center">Toca la tarjeta o pulsa espacio · ← todavía no · → la sé</p><div class="r" style="justify-content:center"><button class="b" id="no" style="background:var(--ko)">✗ Todavía no</button><button class="b" id="si" style="background:var(--ok)">✓ La sé</button></div>`;
  let busy = 0;
  const flip = () => { if (busy)
    return; busy = 1; animar({ targets: '#cd', rotateY: [0, 90], duration: 170, easing: 'easeInQuad', complete: () => { side ^= 1; const d = $('#cd'); d.innerHTML = side ? rv : fr; cargarImgs(d); d.style.background = side ? 'color-mix(in srgb,var(--ac) 9%,var(--sf))' : ''; animar({ targets: '#cd', rotateY: [-90, 0], duration: 230, easing: 'easeOutQuad', complete: () => busy = 0 }); } }); }, go = ok => { if (busy)
    return; busy = 1; calificar(c, ok); animar({ targets: '#cd', translateX: ok ? 300 : -300, rotate: ok ? 12 : -12, opacity: 0, duration: 260, easing: 'easeInQuad', complete: () => flashcards(cs, i + 1, ok ? ms : [...ms, c]) }); };
  cargarImgs($('#cd'));
  animar({ targets: '#cd', translateY: [24, 0], opacity: [0, 1], duration: 300, easing: 'easeOutCubic' });
  $('#cd').onclick = flip;
  $('#no').onclick = () => go(0);
  $('#si').onclick = () => go(1);
  atajo = ev => { if (ev.key == ' ') {
    ev.preventDefault();
    flip();
  }
  else if (ev.key == 'ArrowLeft')
    go(0);
  else if (ev.key == 'ArrowRight')
    go(1); };
}
// ============================================================
// 5. PREGUNTAS (las comparten Aprender y Test)
// ============================================================
/* Pregunta: m=opción múltiple, t=verdadero/falso, w=escribir */
function pregunta(c, ty, fb, cb) {
  const { q, a, f, qi, ai } = preguntarPor(c, 1), pool = mezclar([...new Set(unidad.cards.filter(x => x != c).map(x => x[f]).filter(x => x && x != a))]);
  if (!pool.length)
    ty = 'w';
  else if (ty == 'm' && pool.length < 2)
    ty = 't';
  let sw = a;
  if (ty == 't' && Math.random() < .5)
    sw = pool[0];
  const kv = ty == 't' ? (sw == a ? '1' : '0') : a, lab = { m: 'Elige la respuesta', t: '¿Verdadero o falso?', w: 'Escribe la respuesta' }[ty];
  let h = `<p class="mu">${lab}</p>${q ? `<h2 class="ml">${esc(q)}</h2>` : ''}${imgHtml(qi)}`;
  if (ty == 'm')
    h += mezclar([a, ...pool.slice(0, 3)]).map(x => `<button class="o" data-v="${esc(x)}">${esc(x)}</button>`).join('');
  if (ty == 't')
    h += `<h3 class="ml">${esc(sw)}</h3><button class="o" data-v="1">Verdadero</button><button class="o" data-v="0">Falso</button>`;
  if (ty == 'w')
    h += `<input id="in" autocomplete="off" placeholder="Tu respuesta"><div class="r"><button class="b" id="ck">Comprobar</button><button class="b gh" id="ds">No lo sé</button></div>`;
  $('#q').innerHTML = h + '<div id="fb"></div>';
  cargarImgs($('#q'));
  animar({ targets: '#q .o', translateY: [12, 0], opacity: [0, 1], delay: escalonado(), duration: 320, easing: 'easeOutCubic' });
  /* ok: acierto · w: 1 si se puede ofrecer "Estaba bien" (respuesta escrita fallada) · mine: lo que escribió la persona.
     En Test los aciertos y fallos de opción/VF pasan directos; un fallo escrito se revisa para poder marcarlo como bueno. */
  const rev = (ok, w, mine) => {
    if (!fb && (ok || !w))
      return cb(ok);
    const z = $('#fb');
    if (ok) {
      z.innerHTML = '<b class="ok">✓ ¡Correcto!</b>';
      animar({ targets: '#fb', scale: [.6, 1], duration: 400, easing: 'easeOutElastic(1, .6)' });
      setTimeout(() => cb(true), 900);
      return;
    }
    animar({ targets: '#q', translateX: [0, -8, 8, -5, 5, 0], duration: 350, easing: 'easeInOutSine' });
    z.innerHTML = `<p class="ml"><b class="ko">✗ Respuesta correcta:</b>${a.includes('\n') ? '\n' : ' '}${esc(a)}</p>${imgHtml(ai)}${mine ? `<p class="mu s ml">Tu respuesta: ${esc(mine)}</p>` : ''}<div class="r"><button class="b" id="nx">Continuar</button>${w ? '<button class="b gh" id="ov">Estaba bien</button>' : ''}</div>`;
    cargarImgs(z);
    $('#nx').onclick = () => cb(false);
    $('#nx').focus();
    if (w)
      $('#ov').onclick = () => cb(true);
  };
  if (ty == 'w') {
    const i = $('#in'), go = () => { const m = i.value.trim(), ok = esCorrecta(m, a); i.disabled = 1; $('#ck').disabled = $('#ds').disabled = 1; rev(ok, m ? 1 : 0, m); };
    $('#ck').onclick = go;
    // preventDefault: si no, este mismo Enter acaba pulsando el botón "Continuar" que recibe el foco y la pantalla avanza al instante
    i.onkeydown = ev => { if (ev.key == 'Enter') { ev.preventDefault(); if (!ev.repeat) go(); } };
    $('#ds').onclick = () => { i.disabled = 1; $('#ck').disabled = $('#ds').disabled = 1; rev(false, 0); };
    i.focus();
  }
  else
    document.querySelectorAll('.o').forEach(b => b.onclick = () => { document.querySelectorAll('.o').forEach(x => { x.disabled = 1; if (x.dataset.v == kv)
      x.classList.add('ok'); }); const ok = b.dataset.v == kv; if (!ok)
      b.classList.add('ko'); rev(ok, 0); });
}
// ============================================================
// 6. MODO APRENDER
// ============================================================
/* Aprender: cada tarjeta debe acertarse 2 veces seguidas. 1.ª vez: opción múltiple/VF (fácil), 2.ª: escribir (difícil). Fallar reinicia la racha. */
function aprender(cs) {
  if (!cs.length)
    return verUnidad(unidad.id);
  cs.forEach(c => { c._s = c.b >= 3 ? 1 : 0; c._f = 0; });
  const sesion = { p: mezclar(cs), q: [], n: 0, t: cs.length, m: new Set(), a: 0, ok: 0 };
  sesion.f = () => { while (sesion.q.length < 6 && sesion.p.length)
    sesion.q.push(sesion.p.shift()); };
  sesion.f();
  pasoAprender(sesion);
}
function pasoAprender(sesion) {
  atajo = null;
  if (!sesion.q.length) {
    const ms = [...sesion.m];
    pantallaResultados(sesion.ok, sesion.a, ms.map(c => [c.t, c.d, c._f]), '🎉 ¡Todo dominado!', (ms.length ? '<button class="b" id="rp">Repasar las falladas</button>' : '') + '<button class="b gh" onclick="verUnidad(unidad.id)">Volver</button>');
    if (ms.length)
      $('#rp').onclick = () => aprender(ms);
    return;
  }
  const c = sesion.q[0];
  app.innerHTML = `<header><button class="b gh" onclick="verUnidad(unidad.id)">✕ Salir</button><span class="mu">${sesion.n} / ${sesion.t} dominadas</span></header><div class="bar" style="margin:0 0 16px"><i style="width:${sesion.n / sesion.t * 100}%"></i></div><div class="c" id="q"></div>`;
  pregunta(c, c._s ? 'w' : Math.random() < .3 ? 't' : 'm', 1, ok => {
    calificar(c, ok);
    sesion.q.shift();
    sesion.a++;
    if (ok) {
      sesion.ok++;
      c._s++;
    }
    else {
      c._s = 0;
      c._f++;
      sesion.m.add(c);
    }
    if (c._s >= 2)
      sesion.n++;
    else
      sesion.q.splice(Math.min(sesion.q.length, ok ? 4 : 2), 0, c);
    sesion.f();
    pasoAprender(sesion);
  });
}
// ============================================================
// 7. RESULTADOS: NOTA, QUESITO Y FALLADAS
// ============================================================
/* Feedback final: nota, gráfico de quesito y lista de falladas */
function pantallaResultados(ok, n, w, ttl, btns) {
  atajo = null;
  const p = n ? Math.round(100 * ok / n) : 0;
  app.innerHTML = `<div class="c"><h2>${ttl}</h2><div class="r" style="align-items:center;gap:24px"><svg viewBox="0 0 100 100" width="150" height="150" role="img" aria-label="${p}% de acierto"><circle cx="50" cy="50" r="50" fill="var(--ko)"/><circle id="arc" cx="50" cy="50" r="25" fill="none" stroke="var(--ok)" stroke-width="50" stroke-dasharray="${p * 1.5708} 157.08" transform="rotate(-90 50 50)"/></svg><div><div style="font-size:40px;font-weight:700">${p}%</div><div class="ok">● ${ok} aciertos</div><div class="ko">● ${n - ok} fallos</div></div></div><h3>${w.length ? 'Tarjetas falladas' : '¡Sin fallos! 🎉'}</h3>${w.map(x => `<div class="row"><span class="ml"><b>${esc(x[0]) || '🖼 (imagen)'}</b> → ${esc(x[1]) || '🖼 (imagen)'}</span>${x[2] > 1 ? `<span class="ko">×${x[2]}</span>` : ''}</div>`).join('')}<div class="r">${btns}</div></div>`;
  const o = { v: 0 };
  animar({ targets: o, v: p, duration: 900, easing: 'easeOutCubic', update: () => $('#arc').setAttribute('stroke-dasharray', o.v * 1.5708 + ' 157.08') });
}
// ============================================================
// 8. MODO TEST
// ============================================================
/* Test: mini examen mixto, sin pistas, con nota final */
function modoTest() { const cs = mezclar(unidad.cards).slice(0, 20); if (!cs.length)
  return verUnidad(unidad.id); pasoTest(cs, 0, []); }
function pasoTest(cs, i, resultados) {
  atajo = null;
  if (i >= cs.length) {
    const w = resultados.filter(r => !r.ok).map(r => r.c), p = Math.round(100 * (cs.length - w.length) / cs.length);
    pantallaResultados(cs.length - w.length, cs.length, w.map(c => [c.t, c.d, 1]), '📝 Resultado del test', (w.length ? '<button class="b" id="rp">Practicar las falladas</button>' : '') + '<button class="b gh" onclick="modoTest()">Repetir test</button><button class="b gh" onclick="verUnidad(unidad.id)">Volver</button>');
    if (w.length)
      $('#rp').onclick = () => aprender(w);
    return;
  }
  app.innerHTML = `<header><button class="b gh" onclick="verUnidad(unidad.id)">✕ Salir</button><span class="mu">Pregunta ${i + 1} / ${cs.length}</span></header><div class="c" id="q"></div>`;
  pregunta(cs[i], ['m', 't', 'w', 'm'][Math.random() * 4 | 0], 0, ok => { calificar(cs[i], ok); resultados.push({ c: cs[i], ok }); pasoTest(cs, i + 1, resultados); });
}
// ============================================================
// 9. ARRANQUE
// ============================================================
inicio();
if (sb)
  sb.auth.onAuthStateChange((ev, s) => { if (ev == 'TOKEN_REFRESHED' || ev == 'USER_UPDATED' || (s && s.user.id == uid))
    return; setTimeout(() => alCambiarSesion(s), 0); });
