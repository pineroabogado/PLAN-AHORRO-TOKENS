/**
 * Crea (o actualiza) un PRESET DE AGENTE por proyecto en DeepSeek Harness.
 * Generico: vale para cualquier proyecto, agente o servidor MCP.
 *
 * Por qué: el contexto de cada paso incluye las definiciones de TODAS las tools
 * MCP conectadas. Si varios proyectos declaran sus MCP en el patch del perfil,
 * CADA sesion carga los juegos de tools de los demas aunque no los use. Un preset
 * por proyecto monta solo el suyo.
 *
 * Qué hace:
 *   1. Copia la composición de serie `standard` (agente completo ya cargable)
 *      al root de usuario: <DSH_HOME>/.agent-presets/<id>/.
 *   2. Escribe `preset.yml` (name/description; una fila de roster sin
 *      metadatos se muestra con el nombre de la carpeta).
 *   3. Añade al final de `agent.cordis.yml` la fila del cliente MCP del proyecto
 *      (transport stdio). El cliente MCP solo inyecta el registro `tools` y no
 *      publica servicio, así que la fila va suelta (igual que `tool-fs`).
 *
 * El preset NO se aplica a sesiones ya abiertas: se elige al crear sesión
 * (chip de nueva sesión) o fijando el default. Ver ..\PLAN_REDUCCION_TOKENS.md
 * (carpeta PLAN AHORRO TOKENS).
 *
 * Uso (desde la carpeta PLAN AHORRO TOKENS):
 *   node scripts/crear-preset-proyecto.mjs --id <proyecto> --nombre "<Nombre visible>" \
 *     --descripcion "<para que sirve este agente>" \
 *     --mcp-server <serverName> --mcp-script "<ruta al index.js del servidor MCP>" \
 *     [--mcp-arg "<arg>"] [--mcp-env CLAVE=valor] [--mcp-cwd "<ruta>"] [--forzar] [--dry-run]
 *
 *   --mcp-env admite cualquier variable (credenciales, usuario, marcador de recarga...).
 *   Ejemplo real ya ejecutado (proyecto CRM): ver PROMPT_APLICAR_PLAN_TOKENS.md
 *
 *   --origen RUTA   Composición de partida (por defecto, el `standard` de serie)
 *   --forzar        Sobrescribe si el preset ya existe (conserva su preset.yml salvo --nombre)
 *   --dry-run       Muestra lo que haría, sin escribir
 */
import fs from 'fs'
import path from 'path'
import os from 'os'

function arg(n) {
  const i = process.argv.indexOf(`--${n}`)
  if (i < 0) return null
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : null
}
const argsAll = (n) => {
  const out = []
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === `--${n}` && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) out.push(process.argv[i + 1])
  }
  return out
}
const has = (n) => process.argv.includes(`--${n}`)

const id = arg('id')
const nombre = arg('nombre')
const descripcion = arg('descripcion') || ''
const mcpServer = arg('mcp-server')
const mcpScript = arg('mcp-script')
const mcpCwd = arg('mcp-cwd') || null
const mcpNode = arg('mcp-node') || process.execPath
const mcpEnv = argsAll('mcp-env')
const mcpArgs = argsAll('mcp-arg')
const forzar = has('forzar')
const dryRun = has('dry-run')

if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  console.error('Falta --id válido ([a-z0-9][a-z0-9-]*).')
  process.exit(1)
}
if (!mcpServer || !mcpScript) {
  console.error('Faltan --mcp-server y --mcp-script.')
  process.exit(1)
}

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const destinoDir = path.join(DSH_HOME, '.agent-presets', id)
const destinoComposicion = path.join(destinoDir, 'agent.cordis.yml')
const destinoMeta = path.join(destinoDir, 'preset.yml')

// 1) Composición de partida: `standard` de serie (o --origen)
function localizarOrigen() {
  const explicito = arg('origen')
  if (explicito) return explicito
  const base = path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets')
  const cand = path.join(base, 'standard', 'agent.cordis.yml')
  if (fs.existsSync(cand)) return cand
  // Búsqueda tolerante: primer dsh-agent-presets que aparezca bajo el npm global
  const npmRoot = path.join(process.env.APPDATA || '', 'npm', 'node_modules')
  if (fs.existsSync(npmRoot)) {
    const pila = [npmRoot]
    while (pila.length) {
      const dir = pila.pop()
      let entradas = []
      try { entradas = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
      for (const e of entradas) {
        if (!e.isDirectory()) continue
        const p = path.join(dir, e.name)
        if (e.name === 'dsh-agent-presets') {
          const c = path.join(p, 'presets', 'standard', 'agent.cordis.yml')
          if (fs.existsSync(c)) return c
        }
        if (e.name.startsWith('@deepseek-ai') || e.name === 'node_modules') pila.push(p)
      }
    }
  }
  return null
}

const origen = localizarOrigen()
if (!origen || !fs.existsSync(origen)) {
  console.error('No encuentro la composición de partida `standard`. Usa --origen RUTA.')
  process.exit(2)
}

const existe = fs.existsSync(destinoComposicion)
if (existe && !forzar) {
  console.error(`El preset "${id}" ya existe: ${destinoComposicion}\nUsa --forzar para sobrescribir.`)
  process.exit(3)
}

// 2) Texto de la composición: copia + fila MCP
const base = fs.readFileSync(origen, 'utf8')
const salto = base.includes('\r\n') ? '\r\n' : '\n'

const envLineas = mcpEnv.length
  ? mcpEnv.map((kv) => {
      const i = kv.indexOf('=')
      const k = i > 0 ? kv.slice(0, i) : kv
      const v = i > 0 ? kv.slice(i + 1) : ''
      return `      ${k}: '${v}'`
    })
  : []

const fila = [
  '',
  '# ── MCP de dominio del proyecto (añadido por scripts/crear-preset-proyecto.mjs) ──',
  '# El cliente MCP solo inyecta el registro `tools` (no publica servicio): la fila',
  '# va suelta, igual que `tool-fs` / `tool-jobs` en `standard`. Cada preset de',
  '# proyecto monta SU servidor MCP, de modo que la sesión no carga el coste fijo',
  '# (definiciones de tools) de los proyectos que no está tocando.',
  `- id: mcp-${mcpServer}-online`,
  `  name: '@deepseek-ai/dsh-mcp-client'`,
  '  config:',
  `    serverName: ${mcpServer}`,
  '    transport: stdio',
  `    command: '${mcpNode.replace(/\\/g, '\\')}'`,
  '    args:',
  `      - '${mcpScript}'`,
  ...mcpArgs.map((a) => `      - '${a}'`),
  envLineas.length ? '    env:' : null,
  ...envLineas,
  mcpCwd ? `    cwd: '${mcpCwd}'` : null,
  '    failOnStartupError: false',
  ''
].filter((l) => l !== null).join(salto)

const meta = [
  `name: ${nombre || id}`,
  `description: ${descripcion || `Preset del proyecto ${id}.`}`,
  ''
].join(salto)

if (dryRun) {
  console.log(JSON.stringify({ id, origen, destinoDir, existe, fila_mcp: fila.split(salto).filter(Boolean).length + ' líneas', meta }, null, 2))
  process.exit(0)
}

fs.mkdirSync(destinoDir, { recursive: true })
fs.writeFileSync(destinoComposicion, base + fila, { encoding: 'utf8' })
fs.writeFileSync(destinoMeta, meta, { encoding: 'utf8' })

console.log(JSON.stringify({
  ok: true,
  preset: id,
  composicion: destinoComposicion,
  metadata: destinoMeta,
  origen,
  bytes: fs.statSync(destinoComposicion).size,
  filas_mcp: [`mcp-${mcpServer}-online`],
  siguiente: 'Reiniciar DSH; el preset se elige al crear sesión (o se fija como default).'
}, null, 2))
