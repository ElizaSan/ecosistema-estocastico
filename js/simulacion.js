new MutationObserver(()=>{for(const c of document.querySelectorAll('.stack td:not([data-l])')){let i=0,p=c;while(p=p.previousElementSibling)i+=p.colSpan;c.dataset.l=c.closest('table').rows[0].cells[i]?.textContent||''}}).observe(document,{childList:true,subtree:true})


{
// ================================================================
// 1. NÚMEROS ALEATORIOS CON SEMILLA (misma semilla = mismo mundo)
// ================================================================
function crearRng(semilla) {
  let a = semilla >>> 0;
  return function () {              // mulberry32
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {               // distribución normal (Box-Muller)
  return Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(2 * Math.PI * rng());
}

// ================================================================
// 2. RUIDO DE PERLIN 3D (x, y = posición; z = tiempo)
// ================================================================
function crearPerlin(rng) {
  const p = new Uint8Array(512), perm = [];
  for (let i = 0; i < 256; i++) perm.push(i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  function grad(h, x, y, z) {
    h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  return function (x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
                     lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
                lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
                     lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  };
}

// ================================================================
// 3. CONSTANTES DEL MODELO (las "reglas simples")
// ================================================================
const ANCHO = 200, ALTO = 125;      // celdas del mundo
const RMAX = 2;                     // recurso máximo por celda
const COSTO_BASE = 0.07;            // energía por existir
const COSTO_MOV = 0.1;              // multiplica velocidad²
const COSTO_PERC = 0.008;           // por cada celda de percepción
const MORDIDA = 0.4;                // cuánto come por tick
const MAX_ORG = 5000;               // tope de seguridad
const DURACION = 10000;             // ticks que dura una prueba
const MUESTREO = 20;                // cada cuántos ticks se guarda la población
const LIMITES = { vel: [0.2, 2.0], per: [1, 8], umb: [8, 40] };

// ================================================================
// 4. CREAR UN MUNDO
// ================================================================
function crearMundo(params) {
  const rng = crearRng(params.semilla);
  const ruido = crearPerlin(rng);
  const n = ANCHO * ALTO;
  const m = {
    params, rng, ruido, tick: 0, tiempoRuido: 0,
    capacidad: new Float32Array(n),  // cuánto recurso puede tener cada celda
    recurso: new Float32Array(n),    // cuánto tiene ahora
    orgs: [], historia: [], genMax: 0, terminado: false, resultado: null
  };
  actualizarCapacidad(m);
  m.recurso.set(m.capacidad);
  for (let i = 0; i < params.poblacion; i++) {
    m.orgs.push({
      x: rng() * ANCHO, y: rng() * ALTO, ang: rng() * Math.PI * 2,
      energia: 12, edad: 0, edadMax: 800 + rng() * 800, gen: 0,
      vel: 0.6 + rng() * 0.4, per: 2 + rng() * 2, umb: 15 + rng() * 6,
      tono: rng() * 360                // "linaje": se hereda, solo sirve para colorear
    });
  }
  return m;
}

// El terreno: ruido fractal (varias capas/octavas). Más aleatoriedad = más octavas = terreno más rugoso.
function actualizarCapacidad(m) {
  const { ruido } = m, z = m.tiempoRuido;
  const octavas = 1 + Math.round(m.params.azar * 3);
  for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) {
    let v = 0, amp = 1, f = 0.02, total = 0;
    for (let o = 0; o < octavas; o++) { v += amp * ruido(x * f, y * f, z * (o + 1)); total += amp; amp *= 0.5; f *= 2; }
    v /= total;                                   // aprox. entre -0.7 y 0.7
    const c = Math.min(1, Math.max(0, (v + 0.0) * 2.5));
    m.capacidad[y * ANCHO + x] = c * RMAX;
  }
}

// ================================================================
// 5. UN PASO DE SIMULACIÓN (un "tick")
// ================================================================
function paso(m) {
  const { params, rng, recurso, capacidad } = m;
  // 5a. El terreno se transforma lentamente
  m.tiempoRuido += params.trans * 0.0006;
  if (m.tick % 10 === 0 && params.trans > 0) actualizarCapacidad(m);
  // 5b. Los recursos se regeneran hacia su capacidad
  for (let i = 0; i < recurso.length; i++) recurso[i] += params.regen * (capacidad[i] - recurso[i]);

  // 5c. Cada organismo actúa
  const hijos = [];
  for (const o of m.orgs) {
    const celda = (o.y | 0) * ANCHO + (o.x | 0);
    let costo = COSTO_BASE + COSTO_PERC * o.per;
    if (recurso[celda] > 0.25 && rng() > params.azar * 0.5) {
      // Regla 1: si hay comida aquí, come
      const come = Math.min(recurso[celda], MORDIDA);
      recurso[celda] -= come; o.energia += come;
    } else {
      // Regla 2: si no, mira a su alrededor y se mueve hacia lo mejor que ve
      let mejor = -1, mejorAng = o.ang;
      for (let k = 0; k < 6; k++) {
        const a = rng() * Math.PI * 2;
        const px = (o.x + Math.cos(a) * o.per + ANCHO) % ANCHO, py = (o.y + Math.sin(a) * o.per + ALTO) % ALTO;
        const val = recurso[(py | 0) * ANCHO + (px | 0)];
        if (val > mejor) { mejor = val; mejorAng = a; }
      }
      if (mejor > 0.1) o.ang = mejorAng;
      o.ang += (rng() - 0.5) * Math.PI * params.azar;   // aleatoriedad en el rumbo
      o.x = (o.x + Math.cos(o.ang) * o.vel + ANCHO) % ANCHO;
      o.y = (o.y + Math.sin(o.ang) * o.vel + ALTO) % ALTO;
      costo += COSTO_MOV * o.vel * o.vel;
    }
    o.energia -= costo;
    o.edad++;
    // Regla 3: con suficiente energía se divide en dos (con mutación)
    if (o.energia > o.umb && m.orgs.length + hijos.length < MAX_ORG) {
      o.energia = o.energia / 2 - 1;
      const h = {
        x: o.x, y: o.y, ang: rng() * Math.PI * 2, energia: o.energia, edad: 0,
        edadMax: 800 + rng() * 800, gen: o.gen + 1,
        vel: mutar(o.vel, 'vel', params.evo, rng), per: mutar(o.per, 'per', params.evo, rng),
        umb: mutar(o.umb, 'umb', params.evo, rng), tono: (o.tono + gauss(rng) * params.evo * 40 + 360) % 360
      };
      if (h.gen > m.genMax) m.genMax = h.gen;
      hijos.push(h);
    }
  }
  // Regla 4: muere sin energía o por vejez
  m.orgs = m.orgs.filter(o => o.energia > 0 && o.edad < o.edadMax).concat(hijos);

  m.tick++;
  if (m.tick % MUESTREO === 0) m.historia.push(m.orgs.length);
  if (m.orgs.length === 0 || m.tick >= DURACION) { m.terminado = true; m.resultado = clasificar(m); }
}

function mutar(valor, gen, tasa, rng) {
  const [min, max] = LIMITES[gen];
  return Math.min(max, Math.max(min, valor * (1 + gauss(rng) * tasa)));
}

// ================================================================
// 6. CLASIFICAR EL RESULTADO
// ================================================================
const CATEGORIAS = {
  extinto:   { nombre: 'Extinto',     color: 'var(--bad)',  texto: 'No logró adaptarse y desapareció pronto.' },
  efimero:   { nombre: 'Efímero',     color: 'var(--warn)', texto: 'Sobrevivió un tiempo, pero colapsó.' },
  declive:   { nombre: 'En declive',  color: '#b07cc6',     texto: 'Llegó al final, pero su población cae con fuerza.' },
  oscilante: { nombre: 'Oscilante',   color: 'var(--cyc)',  texto: 'Sobrevive con auges y caídas fuertes.' },
  estable:   { nombre: 'Estable',     color: 'var(--ok)',   texto: 'Encontró un equilibrio autosostenible.' }
};
function clasificar(m) {
  if (m.orgs.length === 0) return m.tick < 2000 ? 'extinto' : 'efimero';
  const ventana = m.historia.slice(-150);              // últimos 3000 ticks
  const media = ventana.reduce((a, b) => a + b, 0) / ventana.length;
  const desv = Math.sqrt(ventana.reduce((a, b) => a + (b - media) ** 2, 0) / ventana.length);
  const cv = desv / media;                             // coeficiente de variación
  const tercio = Math.floor(ventana.length / 3);
  const inicio = ventana.slice(0, tercio).reduce((a, b) => a + b, 0) / tercio;
  const fin = ventana.slice(-tercio).reduce((a, b) => a + b, 0) / tercio;
  if (fin < inicio * 0.5) return 'declive';
  return cv < 0.2 ? 'estable' : 'oscilante';
}


// ================================================================
// 7. DIBUJO
// ================================================================
const lienzo = document.getElementById('mundo'), ctx = lienzo.getContext('2d');
const terreno = document.createElement('canvas'); terreno.width = ANCHO; terreno.height = ALTO;
const tctx = terreno.getContext('2d'), img = tctx.createImageData(ANCHO, ALTO);
const ESC = lienzo.width / ANCHO;

function dibujar(m) {
  const d = img.data;
  for (let i = 0; i < m.recurso.length; i++) {
    const r = m.recurso[i] / RMAX, c = m.capacidad[i] / RMAX;
    d[i * 4] = 18 + 20 * (1 - c);
    d[i * 4 + 1] = 22 + 150 * r + 20 * c;
    d[i * 4 + 2] = 18 + 60 * r;
    d[i * 4 + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(terreno, 0, 0, lienzo.width, lienzo.height);
  // organismos agrupados por color (más rápido que cambiar fillStyle cada vez)
  const grupos = {};
  for (const o of m.orgs) { const g = Math.round(o.tono / 15) * 15; (grupos[g] ||= []).push(o); }
  for (const g in grupos) {
    ctx.fillStyle = `hsl(${g},90%,65%)`;
    for (const o of grupos[g]) ctx.fillRect(o.x * ESC - 1.5, o.y * ESC - 1.5, 3, 3);
  }
}

const gLienzo = document.getElementById('grafica'), gctx = gLienzo.getContext('2d');
function dibujarGrafica(m) {
  const W = gLienzo.clientWidth, H = gLienzo.clientHeight, dpr = window.devicePixelRatio || 1;
  if (gLienzo.width !== W * dpr) { gLienzo.width = W * dpr; gLienzo.height = H * dpr; }
  gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  gctx.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.body);
  gctx.strokeStyle = css.getPropertyValue('--line'); gctx.lineWidth = 1;
  gctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  gctx.fillStyle = css.getPropertyValue('--muted'); gctx.font = '13px "IBM Plex Sans", sans-serif';
  gctx.fillText('Población en el tiempo', 8, 18);
  if (!m || m.historia.length < 2) return;
  const total = DURACION / MUESTREO, maxP = Math.max(10, ...m.historia);
  gctx.fillText(String(maxP), W - 8 - gctx.measureText(String(maxP)).width, 18);
  gctx.beginPath();
  m.historia.forEach((p, i) => {
    const x = (i / total) * W, y = H - 6 - (p / maxP) * (H - 30);
    i ? gctx.lineTo(x, y) : gctx.moveTo(x, y);
  });
  gctx.strokeStyle = '#e8a33d'; gctx.lineWidth = 2; gctx.stroke();
}

function promedio(orgs, k) { return orgs.length ? (orgs.reduce((a, o) => a + o[k], 0) / orgs.length).toFixed(2) : '–'; }
function actualizarStats(m) {
  document.getElementById('sPob').textContent = m.orgs.length;
  document.getElementById('sTick').textContent = m.tick;
  document.getElementById('sGen').textContent = m.genMax;
  document.getElementById('sVel').textContent = promedio(m.orgs, 'vel');
  document.getElementById('sPer').textContent = promedio(m.orgs, 'per');
  document.getElementById('sUmb').textContent = promedio(m.orgs, 'umb');
  document.getElementById('barra').style.width = (m.tick / DURACION * 100) + '%';
}

// ================================================================
// 8. CONTROLES
// ================================================================
const $ = id => document.getElementById(id);
const deslizadores = [['pPob', 'vPob', 0], ['pTrans', 'vTrans', 1], ['pAzar', 'vAzar', 2], ['pEvo', 'vEvo', 2], ['pRegen', 'vRegen', 3], ['pVelSim', 'vVelSim', 0]];
for (const [inp, val, dec] of deslizadores) {
  const f = () => $(val).textContent = Number($(inp).value).toFixed(dec);
  $(inp).addEventListener('input', f); f();
}
function leerParams() {
  return {
    poblacion: +$('pPob').value, trans: +$('pTrans').value, azar: +$('pAzar').value,
    evo: +$('pEvo').value, regen: +$('pRegen').value, semilla: Math.floor(+$('pSemilla').value) || 1
  };
}
function ponerParams(p) {
  $('pPob').value = p.poblacion; $('pTrans').value = p.trans; $('pAzar').value = p.azar;
  $('pEvo').value = p.evo; $('pRegen').value = p.regen; $('pSemilla').value = p.semilla;
  for (const [inp] of deslizadores) $(inp).dispatchEvent(new Event('input'));
}

let mundo = null, corriendo = false;
function bucle() {
  if (!corriendo || !mundo) return;
  const pasos = +$('pVelSim').value;
  for (let i = 0; i < pasos && !mundo.terminado; i++) paso(mundo);
  dibujar(mundo); dibujarGrafica(mundo); actualizarStats(mundo);
  if (mundo.terminado) return terminar();
  requestAnimationFrame(bucle);
}
function iniciar() {
  mundo = crearMundo(leerParams());
  corriendo = true;
  $('overlay').classList.add('hidden');
  $('bPausa').disabled = false; $('bPausa').textContent = 'Pausa';
  $('bIniciar').textContent = 'Reiniciar';
  requestAnimationFrame(bucle);
}
function terminar() {
  corriendo = false;
  const cat = CATEGORIAS[mundo.resultado];
  $('ovTitulo').textContent = cat.nombre;
  $('ovTexto').textContent = `${cat.texto} Duró ${mundo.tick} ticks, generación ${mundo.genMax}.`;
  $('overlay').classList.remove('hidden');
  $('bPausa').disabled = true;
  guardar({
    resultado: mundo.resultado, ticks: mundo.tick, pobFinal: mundo.orgs.length, gen: mundo.genMax,
    params: mundo.params, vel: promedio(mundo.orgs, 'vel'), fecha: Date.now()
  });
}
$('bIniciar').addEventListener('click', iniciar);
$('bPausa').addEventListener('click', () => {
  if (!mundo || mundo.terminado) return;
  corriendo = !corriendo;
  $('bPausa').textContent = corriendo ? 'Pausa' : 'Continuar';
  if (corriendo) requestAnimationFrame(bucle);
});
$('bDado').addEventListener('click', () => $('pSemilla').value = Math.floor(Math.random() * 999999));

// ================================================================
// 9. CATÁLOGO (se guarda en este navegador)
// ================================================================
const CLAVE = 'ecosistema-catalogo';
let catalogo = [];
try { catalogo = JSON.parse(localStorage.getItem(CLAVE)) || []; } catch (e) { catalogo = []; }
function guardar(reg) {
  catalogo.unshift(reg);
  catalogo = catalogo.slice(0, 100);
  try { localStorage.setItem(CLAVE, JSON.stringify(catalogo)); } catch (e) {}
  pintarCatalogo();
}
function pintarCatalogo() {
  $('conteo').innerHTML = Object.entries(CATEGORIAS).map(([k, c]) =>
    `<span class="pill"><span class="dot" style="background:${c.color}"></span>${c.nombre} <b>${catalogo.filter(r => r.resultado === k).length}</b></span>`).join('');
  if (!catalogo.length) { $('catalogo').innerHTML = '<p class="empty">Aún no hay mundos. Cada simulación terminada aparecerá aquí.</p>'; return; }
  $('catalogo').innerHTML = `<div class="scroll"><table class="stack"><thead><tr>
    <th>Resultado</th><th class="num">Ticks</th><th class="num">Pob. final</th><th class="num">Gen.</th><th>Parámetros</th><th></th></tr></thead><tbody>` +
    catalogo.map((r, i) => {
      const c = CATEGORIAS[r.resultado], p = r.params;
      return `<tr><td><span class="dot" style="background:${c.color}"></span>${c.nombre}</td>
        <td class="num">${r.ticks}</td><td class="num">${r.pobFinal}</td><td class="num">${r.gen}</td>
        <td>pob ${p.poblacion} · trans ${p.trans} · azar ${p.azar} · evo ${p.evo} · regen ${p.regen} · semilla ${p.semilla}</td>
        <td><button data-i="${i}" class="repetir">Repetir</button></td></tr>`;
    }).join('') + '</tbody></table></div>';
}
$('catalogo').addEventListener('click', e => {
  const b = e.target.closest('.repetir'); if (!b) return;
  ponerParams(catalogo[+b.dataset.i].params);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('bBorrar').addEventListener('click', () => {
  catalogo = []; try { localStorage.removeItem(CLAVE); } catch (e) {}
  pintarCatalogo();
});

pintarCatalogo();
const vistaPrevia = crearMundo(leerParams()); dibujar(vistaPrevia); dibujarGrafica(null);
new ResizeObserver(() => dibujarGrafica(mundo)).observe(gLienzo);
}
