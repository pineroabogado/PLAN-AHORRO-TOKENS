/**
 * Medidor de consumo por sesion de DeepSeek Harness (KPI de reduccion de tokens).
 *
 * Lee las sesiones de $DSH_HOME/sessions/**\/*.jsonl.zstd (zstd multi-frame),
 * descomprime y agrega por tipo de registro. NO vuelca contenido de sesion.
 *
 * Distingue dos cubos:
 *   - CONTEXTO: lo que se reenvia al modelo (mensajes finales, tool call/result,
 *     mensajes de usuario, cabeceras de peticion).
 *   - LOG: artefactos de streaming y marcas de step/turn (se guardan pero NO se
 *     reenvian como contexto): assistant/chunk, reasoning-chunks, text-chunks,
 *     tool-call-chunks, step/*, turn/*.
 *
 * Uso (desde la carpeta PLAN AHORRO TOKENS):
 *   node scripts/medir-consumo-sesiones.mjs                          # top 5 sesiones
 *   node scripts/medir-consumo-sesiones.mjs --top 10
 *   node scripts/medir-consumo-sesiones.mjs --nuevas --top 5 --comparar mediciones/consumo-baseline-2026-09-23.json
 *   node scripts/medir-consumo-sesiones.mjs --top 5 --guardar mediciones/consumo-<fecha>.json
 *
 * Referencia: ..\PLAN_REDUCCION_TOKENS.md (§10 medición recurrente)
 */
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const args = process.argv.slice(2)
const top = Number((args[args.indexOf('--top') + 1] || 5)) || 5
const onlyJson = args.includes('--json')
const arg = (n) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] || null : null
}
const guardarEn = arg('guardar')   // escribe el informe como baseline (JSON)
const compararCon = arg('comparar') // compara con un baseline guardado

/**
 * Familias de tools MCP detectadas dinamicamente en cada cabecera:
 * cualquier nombre `mcp__<servidor>__` (no hay lista fija: vale para cualquier proyecto).
 */
const RX_FAMILIA_MCP = /mcp__[A-Za-z0-9_-]{1,32}__/g

const DSH_HOME = process.env.DSH_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.dsh')
const sessionsRoot = path.join(DSH_HOME, 'sessions')
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

const CONTEXTO = new Set([
  'assistant/message', 'tool/call', 'tool/result', 'user/message', 'system/message',
  'request/context', 'request/header', 'session', 'permission/preset', 'sandbox/mode', 'approval/policy'
])

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.jsonl.zstd')) out.push(p)
  }
  return out
}

/** Descomprime un .zstd con varios frames concatenados (Node solo lee el primero). */
function loadSession(file) {
  const buf = fs.readFileSync(file)
  const offsets = []
  let i = -1
  while ((i = buf.indexOf(MAGIC, i + 1)) >= 0) offsets.push(i)
  const partes = []
  let fallidos = 0
  for (const off of offsets) {
    try { partes.push(zlib.zstdDecompressSync(buf.subarray(off))) } catch { fallidos++ }
  }
  return { texto: Buffer.concat(partes).toString('utf8'), frames: offsets.length, fallidos }
}

if (!fs.existsSync(sessionsRoot)) {
  console.error(`No existe ${sessionsRoot}`)
  process.exit(1)
}

// Una sesión puede tener varias proyecciones (session.jsonl.zstd / session.v3.jsonl.zstd):
// se conserva la mayor por carpeta para no contar dos veces.
const porCarpeta = new Map()
for (const f of walk(sessionsRoot)) {
  const dir = path.dirname(f)
  const prev = porCarpeta.get(dir)
  if (!prev || fs.statSync(f).size > fs.statSync(prev).size) porCarpeta.set(dir, f)
}
/** Crea una sesión: lectura barata del primer frame (contiene la cabecera `session`). */
function fechaCreacion(file) {
  try {
    const buf = fs.readFileSync(file)
    const off = buf.indexOf(MAGIC)
    if (off < 0) return 0
    const cab = zlib.zstdDecompressSync(buf.subarray(off)).toString('utf8').split('\n')[0]
    const m = cab.match(/"createdAt"\s*:\s*(\d+)/)
    return m ? Number(m[1]) : 0
  } catch { return 0 }
}

const todas = [...porCarpeta.values()].filter((f) => fs.statSync(f).size > 50 * 1024)
const files = args.includes('--nuevas')
  ? todas.map((f) => ({ f, t: fechaCreacion(f) })).sort((a, b) => b.t - a.t).slice(0, top).map((x) => x.f)
  : todas.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size).slice(0, top)

const informe = []
for (const f of files) {
  const { texto, frames } = loadSession(f)
  const lines = texto.split('\n').filter(Boolean)
  const sizePorTipo = {}
  const nPorTipo = {}
  const tools = {}
  const resSizes = []
  const headerLens = []
  const familias = new Set()
  let contextoChars = 0
  let logChars = 0

  for (const l of lines) {
    const m = l.match(/"type"\s*:\s*"([^"]{1,40})"/)
    const k = m ? m[1] : 'sin_type'
    sizePorTipo[k] = (sizePorTipo[k] || 0) + l.length
    nPorTipo[k] = (nPorTipo[k] || 0) + 1
    if (CONTEXTO.has(k)) contextoChars += l.length
    else if (/chunks$/.test(k) || /^(step|turn)\//.test(k)) logChars += l.length
    else contextoChars += l.length

    if (k === 'tool/result') resSizes.push(l.length)
    if (k === 'request/header') {
      headerLens.push(l.length)
      const fam = [...new Set([...l.matchAll(RX_FAMILIA_MCP)].map((x) => x[0]))].sort()
      if (fam.length) familias.add(fam.join('+'))
    }
    if (k === 'tool/call') {
      const t = l.match(/"name"\s*:\s*"([a-zA-Z0-9_:]+)"/)
      if (t) tools[t[1]] = (tools[t[1]] || 0) + 1
    }
  }

  resSizes.sort((a, b) => b - a)
  const suma = (arr) => arr.reduce((a, b) => a + b, 0)
  const MB = (n) => +(n / 1048576).toFixed(2)
  const tok = (n) => Math.round(n / 4)

  informe.push({
    sesion: f.split(path.sep).slice(-2)[0],
    fichero_KB: Math.round(fs.statSync(f).size / 1024),
    frames_zstd: frames,
    MB_texto: MB(texto.length),
    MB_contexto: MB(contextoChars),
    MB_log_streaming: MB(logChars),
    pasos: nPorTipo['step/start'] || 0,
    turnos: nPorTipo['turn/start'] || 0,
    tool_calls: nPorTipo['tool/call'] || 0,
    tokens_aprox_contexto: tok(contextoChars),
    // Gasto fijo: lo que se reenvía en CADA petición (prompt + definiciones de tools).
    cabecera_peticion: {
      generaciones: headerLens.length,
      max_KB: Math.round(Math.max(0, ...headerLens) / 1024),
      media_KB: Math.round(headerLens.reduce((a, b) => a + b, 0) / (headerLens.length || 1) / 1024),
      tokens_max: tok(Math.max(0, ...headerLens)),
      tokens_media: tok(headerLens.reduce((a, b) => a + b, 0) / (headerLens.length || 1)),
      familias_tools: [...familias]
    },
    desglose_MB: Object.entries(sizePorTipo)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([k, v]) => `${k}=${MB(v)}`),
    tool_results: {
      n: resSizes.length,
      MB: MB(suma(resSizes)),
      max_KB: Math.round((resSizes[0] || 0) / 1024),
      mas_de_8KB: resSizes.filter((s) => s > 8192).length,
      mas_de_32KB: resSizes.filter((s) => s > 32768).length,
      mediana_KB: Math.round((resSizes[Math.floor(resSizes.length / 2)] || 0) / 1024)
    },
    top_tools: Object.entries(tools).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`)
  })
}

const agregado = {
  sesiones: informe.length,
  MB_contexto_total: +informe.reduce((a, s) => a + s.MB_contexto, 0).toFixed(2),
  pasos_total: informe.reduce((a, s) => a + s.pasos, 0),
  tool_calls_total: informe.reduce((a, s) => a + s.tool_calls, 0),
  tool_results_mas_de_8KB: informe.reduce((a, s) => a + s.tool_results.mas_de_8KB, 0),
  cabecera_media_KB: Math.round(informe.reduce((a, s) => a + s.cabecera_peticion.media_KB, 0) / (informe.length || 1)),
  cabecera_media_tokens: Math.round(informe.reduce((a, s) => a + s.cabecera_peticion.tokens_media, 0) / (informe.length || 1))
}

// Baseline: guardar / comparar
const instantanea = { fecha: new Date().toISOString(), agregado, sesiones: informe.map((s) => ({ sesion: s.sesion, MB_contexto: s.MB_contexto, pasos: s.pasos, tool_calls: s.tool_calls, cabecera: s.cabecera_peticion })) }

if (guardarEn) {
  fs.writeFileSync(guardarEn, JSON.stringify(instantanea, null, 2))
  console.log(`baseline guardado en ${guardarEn}`)
}

if (compararCon && fs.existsSync(compararCon)) {
  const base = JSON.parse(fs.readFileSync(compararCon, 'utf8'))
  const d = (a, b) => (b === 0 ? 'n/a' : `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%`)
  const A = base.agregado || {}
  console.log('\n=== COMPARATIVA CON BASELINE ===')
  console.log(JSON.stringify({
    baseline: base.fecha,
    cabecera_media_KB: { antes: A.cabecera_media_KB, ahora: agregado.cabecera_media_KB, variacion: d(agregado.cabecera_media_KB, A.cabecera_media_KB) },
    cabecera_media_tokens: { antes: A.cabecera_media_tokens, ahora: agregado.cabecera_media_tokens, variacion: d(agregado.cabecera_media_tokens, A.cabecera_media_tokens) },
    tool_calls_total: { antes: A.tool_calls_total, ahora: agregado.tool_calls_total },
    tool_results_mas_de_8KB: { antes: A.tool_results_mas_de_8KB, ahora: agregado.tool_results_mas_de_8KB }
  }, null, 2))
}

if (onlyJson) {
  console.log(JSON.stringify({ agregado, sesiones: informe }, null, 2))
} else {
  console.log('=== CONSUMO DE SESIONES DSH ===')
  console.log(JSON.stringify(agregado, null, 2))
  for (const s of informe) {
    console.log('\n--- ' + s.sesion + ' ---')
    console.log(JSON.stringify(s, null, 2))
  }
}
