/*
 * Mi Quizlet · lógica de la aplicación (JavaScript puro, sin framework)
 *
 * MODELO DE DATOS (se guarda tal cual en localStorage y en Supabase):
 *   db = { decks: [ { id, name, cards: [ { t, d, b, due } ] } ] }
 *     t   = término             d   = definición
 *     b   = "caja" Leitner 0-5  due = fecha (ms) del próximo repaso
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
  const { error } = await sb.from('user_data').upsert({ user_id: uid, data: JSON.parse(serializar()), updated_at: new Date().toISOString() });
  if (error)
    throw error;
  mostrarEstado('☁️ Guardado en tu cuenta');
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

catch (x) { } }
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
const normalizar = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)/g, '').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
const esCorrecta = (v, a) => { v = normalizar(v); return !!v && [a, ...a.split(/[;\/]/)].some(x => normalizar(x) == v); };
const preguntarPor = c => { const r = dir == 'mix' ? Math.random() < .5 : dir == 'dt'; return r ? [c.d, c.t, 't'] : [c.t, c.d, 'd']; };
addEventListener('keydown', ev => atajo && atajo(ev));
const animar = o => window.anime ? anime(o) : o.complete && o.complete(), escalonado = () => window.anime ? anime.stagger(60) : 0;
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
  const d = db.decks.find(x => x.id == id);
  app.innerHTML = `<header><h1>${d ? 'Editar' : 'Nueva'} unidad</h1></header><div class="c"><p class="mu s">Nombre</p><input id="nm" value="${d ? esc(d.name) : ''}" placeholder="Ej: Inglés – Tema 3"><p class="mu s">Tarjetas · Pulsa Enter para pasar de casilla. Si hay varias respuestas válidas, sepáralas con / o ;</p><div id="rows">${(d && d.cards.length ? d.cards : [{}, {}, {}, {}]).map(c => filaHtml(c.t, c.d)).join('')}</div><div class="r"><button class="b gh" onclick="anadirFila()">+ Añadir tarjeta</button></div><details><summary>Importar texto pegado (Quizlet, Excel…)</summary><p class="mu s">Una tarjeta por línea: término y definición separados por tabulador o ::</p><textarea id="tx" style="min-height:110px"></textarea><div class="r"><button class="b gh" onclick="importarTexto()">Añadir al listado</button></div></details><div class="r"><button class="b" onclick="guardarUnidad('${id || ''}')">Guardar</button><button class="b gh" onclick="${d ? `verUnidad('${id}')` : 'inicio()'}">Cancelar</button></div></div>`;
  $('#rows').onkeydown = ev => { if (ev.key != 'Enter')
    return; const r = ev.target.closest('.er'); if (!r)
    return; ev.preventDefault(); if (ev.target.classList.contains('t'))
    r.querySelector('.df').focus();
  else
    (r.nextElementSibling || anadirFila()).querySelector('.t').focus(); };
  if (!d)
    $('.t').focus();
}
function filaHtml(t, d) { return `<div class="er"><input class="t" placeholder="Término" value="${esc(t || '')}"><input class="df" placeholder="Definición" value="${esc(d || '')}"><button class="b gh" title="Quitar" onclick="this.parentNode.remove()">✕</button></div>`; }
function anadirFila(t, d) { $('#rows').insertAdjacentHTML('beforeend', filaHtml(t, d)); const r = $('#rows').lastElementChild; animar({ targets: r, opacity: [0, 1], translateY: [-8, 0], duration: 250, easing: 'easeOutCubic' }); return r; }
function importarTexto() { const x = $('#tx'); x.value.split('\n').map(l => l.split(/\t| :: |::/).map(s => s.trim())).filter(p => p[0] && p[1]).forEach(p => anadirFila(p[0], p.slice(1).join(' :: '))); x.value = ''; }
function guardarUnidad(id) {
  const nm = $('#nm').value.trim() || 'Sin título', old = id ? db.decks.find(x => x.id == id) : null, cs = [...document.querySelectorAll('.er')].map(r => [r.querySelector('.t').value.trim(), r.querySelector('.df').value.trim()]).filter(p => p[0] && p[1]).map(p => (old && old.cards.find(c => c.t == p[0] && c.d == p[1])) || { t: p[0], d: p.slice(1).join(' :: '), b: 0, due: 0 });
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
<div class="c">${unidad.cards.map(c => `<div class="row"><span>${c.b >= 3 ? '✅' : c.b ? '🟡' : '⚪'} <b>${esc(c.t)}</b></span><span class="mu">${esc(c.d)}</span></div>`).join('') || '<p class="mu">Esta unidad no tiene tarjetas. Pulsa Editar para añadirlas.</p>'}</div>`;
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
  const c = cs[i], [f, bk] = preguntarPor(c);
  let side = 0;
  app.innerHTML = `<header><button class="b gh" onclick="verUnidad(unidad.id)">✕ Salir</button><span class="mu">${i + 1} / ${cs.length}</span></header><div class="pv"><div class="c fc" id="cd">${esc(f)}</div></div><p class="mu s" style="text-align:center">Toca la tarjeta o pulsa espacio · ← todavía no · → la sé</p><div class="r" style="justify-content:center"><button class="b" id="no" style="background:var(--ko)">✗ Todavía no</button><button class="b" id="si" style="background:var(--ok)">✓ La sé</button></div>`;
  let busy = 0;
  const flip = () => { if (busy)
    return; busy = 1; animar({ targets: '#cd', rotateY: [0, 90], duration: 170, easing: 'easeInQuad', complete: () => { side ^= 1; const d = $('#cd'); d.textContent = side ? bk : f; d.style.background = side ? 'color-mix(in srgb,var(--ac) 9%,var(--sf))' : ''; animar({ targets: '#cd', rotateY: [-90, 0], duration: 230, easing: 'easeOutQuad', complete: () => busy = 0 }); } }); }, go = ok => { if (busy)
    return; busy = 1; calificar(c, ok); animar({ targets: '#cd', translateX: ok ? 300 : -300, rotate: ok ? 12 : -12, opacity: 0, duration: 260, easing: 'easeInQuad', complete: () => flashcards(cs, i + 1, ok ? ms : [...ms, c]) }); };
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
  const [q, a, f] = preguntarPor(c), pool = mezclar([...new Set(unidad.cards.filter(x => x != c).map(x => x[f]).filter(x => x != a))]);
  if (!pool.length)
    ty = 'w';
  else if (ty == 'm' && pool.length < 2)
    ty = 't';
  let sw = a;
  if (ty == 't' && Math.random() < .5)
    sw = pool[0];
  const kv = ty == 't' ? (sw == a ? '1' : '0') : a, lab = { m: 'Elige la respuesta', t: '¿Verdadero o falso?', w: 'Escribe la respuesta' }[ty];
  let h = `<p class="mu">${lab}</p><h2>${esc(q)}</h2>`;
  if (ty == 'm')
    h += mezclar([a, ...pool.slice(0, 3)]).map(x => `<button class="o" data-v="${esc(x)}">${esc(x)}</button>`).join('');
  if (ty == 't')
    h += `<h3>${esc(sw)}</h3><button class="o" data-v="1">Verdadero</button><button class="o" data-v="0">Falso</button>`;
  if (ty == 'w')
    h += `<input id="in" autocomplete="off" placeholder="Tu respuesta"><div class="r"><button class="b" id="ck">Comprobar</button><button class="b gh" id="ds">No lo sé</button></div>`;
  $('#q').innerHTML = h + '<div id="fb"></div>';
  animar({ targets: '#q .o', translateY: [12, 0], opacity: [0, 1], delay: escalonado(), duration: 320, easing: 'easeOutCubic' });
  const rev = (ok, w) => {
    if (!fb)
      return cb(ok);
    const z = $('#fb');
    if (ok) {
      z.innerHTML = '<b class="ok">✓ ¡Correcto!</b>';
      animar({ targets: '#fb', scale: [.6, 1], duration: 400, easing: 'easeOutElastic(1, .6)' });
      setTimeout(() => cb(true), 900);
      return;
    }
    animar({ targets: '#q', translateX: [0, -8, 8, -5, 5, 0], duration: 350, easing: 'easeInOutSine' });
    z.innerHTML = `<p class="ko"><b>✗ Respuesta correcta:</b> ${esc(a)}</p><div class="r"><button class="b" id="nx">Continuar</button>${w ? '<button class="b gh" id="ov">Estaba bien</button>' : ''}</div>`;
    $('#nx').onclick = () => cb(false);
    $('#nx').focus();
    if (w)
      $('#ov').onclick = () => cb(true);
  };
  if (ty == 'w') {
    const i = $('#in'), go = () => { const ok = esCorrecta(i.value, a); i.disabled = 1; $('#ck').disabled = $('#ds').disabled = 1; rev(ok, 1); };
    $('#ck').onclick = go;
    i.onkeydown = ev => { if (ev.key == 'Enter')
      go(); };
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
    const ms = [...L.m];
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
  app.innerHTML = `<div class="c"><h2>${ttl}</h2><div class="r" style="align-items:center;gap:24px"><svg viewBox="0 0 100 100" width="150" height="150" role="img" aria-label="${p}% de acierto"><circle cx="50" cy="50" r="50" fill="var(--ko)"/><circle id="arc" cx="50" cy="50" r="25" fill="none" stroke="var(--ok)" stroke-width="50" stroke-dasharray="${p * 1.5708} 157.08" transform="rotate(-90 50 50)"/></svg><div><div style="font-size:40px;font-weight:700">${p}%</div><div class="ok">● ${ok} aciertos</div><div class="ko">● ${n - ok} fallos</div></div></div><h3>${w.length ? 'Tarjetas falladas' : '¡Sin fallos! 🎉'}</h3>${w.map(x => `<div class="row"><span><b>${esc(x[0])}</b> → ${esc(x[1])}</span>${x[2] > 1 ? `<span class="ko">×${x[2]}</span>` : ''}</div>`).join('')}<div class="r">${btns}</div></div>`;
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
