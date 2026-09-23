# Plan de reducción de consumo de tokens — agentes del despacho

**Fecha:** 23 de septiembre de 2026
**Ubicación:** `C:\Users\Despacho3\Desktop\DESARROLLOS\PLAN AHORRO TOKENS` (carpeta transversal, fuera del repo GCI-ONLINE)
**Ámbito:** cualquier agente del asistente, con cualquier nombre y para cualquier proyecto: skills, tools MCP, consultas a base de datos/scripts y documentación de dominio.
**Medidor:** `node scripts/medir-consumo-sesiones.mjs` (ejecutar desde esta carpeta; KPI reproducible, sin volcar contenido de sesión).

---

## 1. Resumen ejecutivo

El consumo no se explica por «respuestas largas» solamente. Hay **tres multiplicadores** que se combinan:

1. **Contexto fijo por paso** (definiciones de tools MCP + `AGENTS.md` + rules): se reenvía en **cada** paso del agente. Medido: solo el MCP `gci` son **~8.750 tokens/paso**; con `avodesk` y las tools del harness se estima **~30.000–38.000 tokens/paso**.
2. **Número de pasos**: la sesión medida hizo **300 pasos / 340 llamadas a tools**. El contexto fijo × pasos es el gasto dominante.
3. **Salidas**: los mensajes del asistente son el **27,6%** del texto de una sesión y hasta el **64%** en otra; los `tool_result` gordos (46–97 por sesión > 8 KB, máx. 116 KB) añaden el resto.

**Conclusión:** el mayor ahorro no está en escribir más corto, sino en **reducir lo que se reenvía en cada paso** (tools MCP y contexto de arranque) y en **recortar las salidas de las tools**.

### Estado de implantación (23/09/2026)

| Fase | Estado |
|---|---|
| **2.1 Separación de MCP por proyecto** (presets de agente) | ✅ **Implantado** — ver §9. Medido: cabecera de petición de 97-100 KB (~25.000 t) a 28 KB (~7.200 t) al descargar los MCP del perfil |
| **0. Medición recurrente** | ✅ **Implantado** — baseline guardado y comparación automatizada (§10) |
| **4.3 Archivar skills legacy** (205 KB) | ⏳ Pendiente |
| **1. Disciplina de salida** | ⏳ Pendiente (regla escrita, aplicación manual) |
| **2.2 `AGENTS.md` a índice** (19,9 KB → ~6 KB) | ⏳ Pendiente |
| **3. Adelgazar tools MCP** (10 tools > 200 t) | ⏳ Pendiente |
| **4.1 Trocear skill de comunicaciones** (128 KB) | ⏳ Pendiente |
| **5. Lotes y caché de contexto en fichero** | ⏳ Pendiente |

---

## 2. Inventario de herramientas y su coste

### 2.1 Contexto fijo por paso (se paga en cada petición)

| Bloque | Medida | Tokens aprox. |
|---|---|---|
| MCP `gci-online` — 29 tools | **medido**: 35.009 chars de JSON (`tools/list`) | **~8.750** |
| MCP `avodesk` (CRM) — 42 tools | estimado (descripciones largas + `describe_schema`) | ~10.500–17.000 |
| Tools del harness (read/write/edit/pwsh/grep/glob/subagent/…) | estimado | ~4.000–6.000 |
| `AGENTS.md` (instrucciones de workspace) | **medido**: 19,9 KB | ~5.000 |
| Rules `alwaysApply` (5: prioridad MCP, privacidad, alcance, Neo, GitHub) | **medido**: ~6 KB | ~1.500 |
| **Total fijo por paso** | | **~30.000–38.000** |

Tools MCP más caras (medido, `gci`):

| Tool | Tokens de definición |
|---|---|
| `registrar_factura_recibida` | 613 |
| `subir_documento_expediente` | 595 |
| `alta_expediente` | 483 |
| `registrar_factura_emitida` | 463 |
| `actualizar_evento_calendario` | 462 |
| `registrar_entrega_a_cuenta` | 445 |
| `renombrar_documento` | 386 |
| `crear_evento_calendario` | 372 |
| `registrar_suplido` | 345 |
| `crear_procedimiento_expediente` | 314 |

> El bloque contable (5 tools) suma **~2.270 tokens/paso**; el bloque documentos, **~1.100**.

### 2.2 Skills (se cargan bajo demanda, pero enteras)

| Skill | KB | Tokens aprox. |
|---|---|---|
| `gci_agente-gestor-de-comunicaciones/SKILL.md` | **128,0** | **~32.000** |
| `gci_agente-registro-de-gastos-fiscales/SKILL.md` | 55,7 | ~13.900 |
| `gci_agente-gestor-de-expedientes-y-agenda/SKILL.md` | 54,3 | ~13.600 |
| `gci_agente-gestor-documental-lexnet/SKILL.md` | 38,4 | ~9.600 |
| `gci_agente-gestor-de-minutacion…/SKILL.md` | 35,4 | ~8.800 |
| `…/reference.md` (comunicaciones / gastos / expedientes) | 27,0 / 29,3 / 22,7 | ~6.800 / ~7.300 / ~5.700 |
| **Total `gci_*` (20 ficheros)** | **466,3** | **~116.600** |
| **Total legacy sin `gci_` (37 ficheros)** | **205,4** | **~51.400** |
| **Total skills** | **671,6** | **~168.000** |

La carga de **una sola** skill de comunicaciones cuesta hoy más que **3,6 pasos completos** de contexto fijo.

### 2.3 Documentación de dominio (si el agente la lee, entra entera)

| Documento | KB |
|---|---|
| `CASOS_USO_AGENTE_IA.md` | 117,1 |
| `AGENTE_IA.md` | 49,2 |
| `Guardado Inteligente de Adjuntos.md` | 17,7 |
| `ACCIONES_GUIADAS.md` | 14,1 |

### 2.4 Coste variable por operación

- **Tool results** (mediana ~1 KB) pero cola muy pesada: **190 resultados > 8 KB** en las 3 sesiones mayores; **6–17 > 32 KB**; máximo **116 KB**.
- **`pwsh`** es la tool más invocada: **104–297 llamadas por sesión** (volcados de consola, listados de directorio, JSON de scripts).
- **`read`/`grep`**: 66–126 / 30–74 por sesión; leer un `SKILL.md` de 128 KB de golpe cuesta ~32.000 tokens.
- **Consultas a Supabase/scripts**: los scripts imprimen el JSON completo (a veces > 100 KB) y ese volcado entra en contexto.

---

## 3. Medición real (3 sesiones mayores, 23/09/2026)

| Métrica | Sesión A | Sesión B | Sesión C |
|---|---|---|---|
| Texto de sesión | 10,35 MB | 15,29 MB | 6,77 MB |
| **Contexto (se reenvía)** | **6,73 MB** | ~13 MB | ~5,5 MB |
| Log de streaming (no contexto) | 3,61 MB | ~2 MB | ~1,2 MB |
| Pasos | 300 | ~590 | ~570 |
| Llamadas a tools | 340 | 904 | 380 |
| `assistant/message` (salidas) | **27,6%** | **64,0%** | 59% |
| `tool/result` | 13,4% | 22,6% | 21% |
| Resultados > 8 KB | 46 | 97 | 47 |
| Resultado máximo | 116 KB | 116 KB | 59 KB |

**Agregado de las 3 sesiones:** 28,68 MB de contexto (~7,2 M tokens), **1.464 pasos**, **1.608 llamadas a tools**.

Dato de contexto: en la sesión A, con ~30–38 k tokens/paso de contexto fijo y 300 pasos, **solo el andamiaje** (tools + instrucciones) ronda **9–11 M tokens** de reenvío. Es el orden de magnitud del problema.

---

## 4. Diagnóstico: seis focos

| # | Foco | Evidencia | Palanca |
|---|------|-----------|---------|
| 1 | **Contexto fijo × pasos** | 29 tools gci = 8.750 t/paso; avodesk + harness ≈ 15–23 k t/paso más; 1.464 pasos medidos | Configuración del perfil + adelgazar definiciones |
| 2 | **Salidas del asistente** | 27,6%–64% del texto de sesión | Plantilla de respuesta y disciplina |
| 3 | **Skills monolíticos** | comunicaciones 128 KB (~32 k t) de una carga | Trocear: núcleo + referencias temáticas |
| 4 | **Tool results gordos** | 190 resultados > 8 KB; máx. 116 KB; `pwsh` 104–297/sesión | Truncado por defecto + salida a fichero |
| 5 | **Duplicación legacy** | 37 ficheros / 205 KB (reference.md completos duplicados) | Archivar; dejar redirects de ~0,3 KB |
| 6 | **Docs de dominio enteras** | 117 KB + 49 KB si se leen | Índices + secciones bajo demanda |

---

## 5. Plan de implementación

### Fase 0 — Medir (hecho / continuo)

- Medidor: `node scripts/medir-consumo-sesiones.mjs --top 5`.
- Frecuencia: **viernes** (junto al informe del despacho). Guardar la salida como KPI.
- Baseline actual (3 sesiones): 28,68 MB de contexto · 1.464 pasos · 1.608 tool calls · 190 resultados > 8 KB.

### Fase 1 — Disciplina de salida (inmediato, 0 código) · objetivo −30% del variable

1. **Prohibido volcar JSON/ficheros completos** en la respuesta: máximo un extracto y la **ruta**. Los datos completos van a fichero.
2. **Plantilla de cierre fija** (ya exigida por Neo): agente + canal + resultado en tabla; sin repetir lo ya dicho.
3. **Un mensaje por tarea**, no narración paso a paso.
4. **`pwsh` siempre con salida recortada**: `Select-Object -First N`, `Measure-Object` o volcado a fichero + lectura del extracto.
5. **`read` con `offset`/`limit`** y `grep` antes de leer; nunca leer un SKILL.md entero si basta la sección.

### Fase 2 — Contexto fijo (configuración, 1 sesión de trabajo) · objetivo −15/−20 k tokens/paso

1. **Un preset de agente por proyecto** (cada servidor MCP en el preset de su proyecto, nunca en la configuración general): ahorro medido **10–17 k tokens/paso** en el caso de ejemplo. Es el mayor ahorro unitario. **Implantado** — ver §9.
2. **Configuración general de instrucciones → índice**: los resúmenes por agente ya viven en la documentación de cada agente; en el fichero global basta la tabla «si dice X → Y» + reglas transversales. Ahorro estimado ~3.500 t/paso (en el caso medido: de 19,9 KB a ~6 KB).
3. **Reglas `alwaysApply`**: revisar cuántas hay y si alguna puede pasar a referencia del agente correspondiente. Ahorro estimado ~500–1.000 t/paso.

### Fase 3 — Definiciones de tools MCP (en el servidor MCP del proyecto, 2–3 sesiones) · objetivo −3/−4 k tokens/paso

1. **Adelgazar descripciones**: mover el detalle de campos al README del servidor. Objetivo: ninguna tool > 200 tokens de definición (en el caso medido, 10 la superaban).
2. **Devolver solo campos necesarios** (nada de `select('*')` en salidas): menos `tool_result` y menos ruido en el razonamiento.
3. **Paginación y truncado por defecto** en tools de listado (`limit` bajo, resumen + `total`).
4. **Evaluar división por dominios** (varios servidores MCP por proyecto, cargando solo el que toque en cada flujo). Ahorro potencial: 4–6 k tokens/paso.
5. Regla de diseño nueva: **toda tool nueva debe justificar su coste en tokens** (definición + salida típica).

### Fase 4 — Skills por capas (3–5 sesiones) · objetivo: núcleo ≤ 8 KB por skill

1. **Reescribir `gci_agente-gestor-de-comunicaciones`** (128 KB) en: `SKILL.md` núcleo (≤8 KB: flujo, criterios ★, reglas duras) + `reference/email.md`, `reference/whatsapp.md`, `reference/informes.md`, `reference/icas-to.md`, `reference/plantillas.md`. Ahorro por carga: de ~32.000 a ~2.000 t + la referencia que se use.
2. Mismo patrón en gastos (55,7), expedientes (54,3), LexNET (38,4) y minutación (35,4).
3. **Archivar las 37 skills legacy** (205 KB): dejar solo redirects de ~0,3 KB (ya existen) y sacar del árbol los `reference.md` duplicados. Evita cargas erróneas y ruido de enrutado.
4. Regla: **cargar la referencia solo si el paso la necesita** (cita explícita de sección).

### Fase 5 — Flujo de trabajo (continuo)

1. **Lotes**: un script que resuelve 5 pasos (como `crear-cita-cliente.mjs`) en vez de 5 llamadas a tools. Objetivo: bajar de ~9 tool calls/turno a ≤4.
2. **Caché de contexto en fichero** (`_cache/expediente-E-XX.json` en el repo) y citar la ruta en lugar de reinyectar los mismos datos en cada paso.
3. **Subagentes con prompt mínimo y salida estructurada** (JSON corto), nunca con volcados.
4. **Compactación por umbral** y al cerrar cada hito (no esperar al límite de ventana).
5. **Sesión por tarea**: cerrar la sesión al terminar el flujo evita arrastrar 10 MB de historia.

---

## 6. KPIs y objetivo

| KPI | Baseline (3 sesiones) | Objetivo 30 días |
|---|---|---|
| MB de contexto por sesión | 9,6 MB de media | **≤4 MB** |
| Tokens de contexto por paso | ~20–26 k | **≤12 k** |
| Tool calls por turno | ~9,4 | **≤4** |
| Resultados > 8 KB | 190 | **≤40** |
| Salidas del asistente (% del texto) | 27–64% | **≤20%** |
| Carga de skill de comunicaciones | ~32.000 t | **≤2.500 t** |

**Objetivo global: −50% de tokens por tarea en 30 días**, sin perder trazabilidad (IDs y datos siguen informándose, pero en tabla y no en volcado).

---

## 7. Acciones inmediatas (esta semana)

1. Medir baseline con el medidor y guardarlo (hecho: §3).
2. Aplicar Fase 1 (disciplina de salida) — coste 0, efecto inmediato.
3. Un preset de agente por proyecto, con sus MCP dentro (Fase 2.1). **Hecho** — ver §9.
4. Adelgazar la configuración general de instrucciones a índice (Fase 2.2).
5. Archivar las skills duplicadas u obsoletas de cada proyecto (Fase 4.3).
6. Empezar el troceado de las skills más grandes (Fase 4.1), que son el mayor coste unitario.

---

## 8. Referencias

- Medidor: [`scripts/medir-consumo-sesiones.mjs`](./scripts/medir-consumo-sesiones.mjs)
- Creador de presets por proyecto: [`scripts/crear-preset-proyecto.mjs`](./scripts/crear-preset-proyecto.mjs)
- Recarga de los MCP: [`scripts/recargar-mcp-dsh.ps1`](./scripts/recargar-mcp-dsh.ps1) · lanzador `..\MCP\Recargar-MCP-GCI.bat`
- Baseline guardado (caso medido): [`mediciones/consumo-baseline-2026-09-23.json`](./mediciones/consumo-baseline-2026-09-23.json)
- Prompt para otros agentes: [`PROMPT_APLICAR_PLAN_TOKENS.md`](./PROMPT_APLICAR_PLAN_TOKENS.md)
- Índice de esta carpeta: [`README.md`](./README.md)

Ejemplos concretos de un proyecto (datos y no instrucciones): servidor MCP y sus tools → `..\GCI-ONLINE\mcp-gci\README.md`; instalación del MCP → `..\GCI-ONLINE\documentacion\01-inteligencia-artificial\MCP_GCI_INSTALACION.md`; registro de agentes de ese proyecto → `..\GCI-ONLINE\AGENTS.md`.

> **Ubicación:** esta carpeta es transversal y vive fuera de los repositorios de proyecto. Las rutas `..\<PROYECTO>\...` (ejemplo: `..\GCI-ONLINE\...`) apuntan a los repos.

---

## 9. Separación de tools MCP por proyecto — IMPLANTADO (23/09/2026)

**Problema resuelto:** las conexiones MCP se declaraban en la configuración general (patch del perfil), que se aplica a **todas** las sesiones. Así, una sesión de un proyecto cargaba también las tools de los demás (en el caso medido: ~42 tools ajenas en cada paso).

**Solución (genérica):** cada proyecto monta su servidor MCP en su **preset de agente** (ámbito de sesión). La configuración general ya no declara ninguno.

| Pieza | Dónde |
|---|---|
| Un preset por proyecto | `~/.dsh/.agent-presets/<proyecto>/agent.cordis.yml` (ejemplo real: `gci` y `crm`) |
| Preset por defecto de sesiones nuevas | `~/.dsh/profiles/web/cordis.patch.yml` → `agent-presets.default: <proyecto>` |
| Alta de un proyecto nuevo | `node scripts/crear-preset-proyecto.mjs --id <id> --mcp-server <serverName> --mcp-script <ruta> [--mcp-arg …] [--mcp-env K=V]` |

**Cómo se usa:** las sesiones nuevas abren con el preset por defecto; para otro proyecto, elegirlo en el **chip de nueva sesión** (o cambiar el default en **Settings → presets**). El preset queda fijado al crear la sesión: una sesión abierta no cambia.

### Regla de oro: la configuración del asistente NO se edita en caliente

Editar la configuración general o el apartado de presets **con sesiones abiertas** desmonta la composición a la que están unidas: la sesión se queda sin herramientas (comprobado el 23/09/2026; se recupera reiniciando el proceso). Procedimiento obligatorio:

1. **Parar** el asistente (`dsh web` / finalizar el proceso `node`).
2. Editar el fichero.
3. **Comprobar en seco**: `dsh --profile web --dump-config` (compone el árbol sin arrancar; sale con error si el patch no casa).
4. Arrancar y verificar en una **sesión nueva**.

Las ediciones triviales (subir un marcador de recarga `*CLIENT_TAG`) sí toleraban la recarga en caliente; las estructurales, no. Para eso está `scripts/recargar-mcp-dsh.ps1`.

---

## 10. Medición recurrente del ahorro

**KPI principal (nuevo): tamaño de la cabecera de petición** — lo que se reenvía en cada paso (prompt + definiciones de tools). Es el gasto que multiplica el ahorro.

```bash
# Desde esta carpeta (DESARROLLOS\PLAN AHORRO TOKENS)

# Medir y guardar/actualizar el baseline
node scripts/medir-consumo-sesiones.mjs --top 5 --guardar mediciones/consumo-<fecha>.json

# Medir las sesiones más recientes y comparar con el baseline
node scripts/medir-consumo-sesiones.mjs --nuevas --top 5 --comparar mediciones/consumo-baseline-2026-09-23.json
```

Mide por sesión: cabecera por petición (KB y tokens, máx. y media), familias de tools MCP presentes (detectadas dinámicamente, `mcp__<servidor>__`), pasos, llamadas a tools, resultados grandes y desglose por tipo de registro.

### Medición del cambio (sesión real, 23/09/2026)

Generaciones de cabecera de la misma sesión, en orden:

| Momento | Cabecera | Tokens aprox. | Tools MCP presentes |
|---|---|---|---|
| Con los dos MCP en el perfil | **97-100 KB** | **~25.000** | gci + avodesk |
| Solo gci | 35 KB | ~9.000 | gci |
| Tras el cambio (perfil sin MCP, preset `standard`) | **28 KB** | **~7.200** | ninguna |
| Sesión rota (sin herramientas) | 2 KB | ~430 | — |

**Lectura:** el bloque de definiciones de tools es prácticamente toda la cabecera (2 KB sin tools vs 100 KB con los dos MCP). Cada sesión de GCI deja de cargar el bloque del CRM: **~10-17 k tokens menos en cada petición**.

> Matiz importante: DSH ya recorta los resultados de tools a 8 KB (`tool-result-pruner`: 4 KB de cabecera + 1 KB de cola), así que un `tool_result` de 116 KB en el registro **no** llegó entero al modelo. Los 190 resultados > 8 KB del baseline son el registro en crudo; el gasto real en contexto es menor, pero sigue habiendo 190 recortes que empujan a repetir lecturas.

**Seguimiento:** repetir la comparación **cada viernes** y anotar el resultado en `mediciones/` (un JSON por fecha). Objetivo: cabecera media por petición ≤ 12 k tokens y tool calls por turno ≤ 4.

---

## 11. Escalabilidad y mantenimiento (para el siguiente agente)

### 11.1 Proyecto nuevo (5 minutos)

1. **Preset con su MCP** (nunca el patch del perfil):
   ```bash
   node scripts/crear-preset-proyecto.mjs --id <id> --nombre "<Nombre>" --descripcion "<...>" \
     --mcp-server <serverName> --mcp-script "<ruta index.js>" [--mcp-arg <a>] [--mcp-env K=V] [--mcp-cwd <ruta>]
   ```
   Copia la composición de serie `standard` (ya cargable) y añade **una** fila `dsh-mcp-client`. Valida el YAML al terminar.
2. **Parar DSH** y decidir el default en `~/.dsh/profiles/web/cordis.patch.yml` (o dejar el actual y elegir preset por sesión).
3. **Verificar en seco**: `dsh --profile web --dump-config` → debe listar `agent-presets` con el default elegido y **ninguna** fila `dsh-mcp-client` en el perfil.
4. Arrancar, abrir una **sesión nueva** con el preset y comprobar que aparecen las tools del proyecto y **no** las de los demás.
5. Medir: `node scripts/medir-consumo-sesiones.mjs --nuevas --top 3 --json` (mirar `cabecera_peticion.familias_tools`).

### 11.2 Agente o skill nuevo (presupuesto obligatorio)

| Elemento | Presupuesto | Por qué |
|---|---|---|
| `SKILL.md` (núcleo) | **≤ 8 KB** | se carga entera al invocar al agente; en el caso medido, la media era 8× eso |
| Detalle/extractos | en `reference/<tema>.md`, cargados **solo si se usan** | un `reference.md` de 29 KB cargado «por si acaso» cuesta 7.000 tokens |
| Tool MCP nueva | definición **≤ 200 tokens**; salida paginada y con campos mínimos | las definiciones se pagan en **cada** paso de **cada** sesión |
| Herramienta huérfana | **no dejarla conectada** | en el caso medido, ~42 tools ajenas suponían ~10-17 k tokens por paso en sesiones de otros proyectos |
| Documentación de dominio | índice + secciones | `CASOS_USO_AGENTE_IA.md` son 117 KB |

**Regla:** ninguna capacidad nueva entra sin declarar su coste medido. Si no se puede medir, no se aprueba.

### 11.3 Mantenimiento periódico

| Cuándo | Qué |
|---|---|
| **Viernes** | `medir-consumo-sesiones.mjs --nuevas --top 5 --comparar <baseline>` y guardar el JSON en `mediciones/` |
| Mensual | Revisar herramientas más pesadas (`tools/list` del MCP) y skills que hayan crecido por encima del presupuesto |
| Trimestral | Inventario de skills: borrar duplicados legacy y referencias sin uso |

**Umbrales de alarma** (si se superan, abrir tarea de reducción):

- cabecera media por petición **> 20 k tokens**;
- alguna `SKILL.md` **> 16 KB**;
- más de **4** resultados de tools > 32 KB en una sesión;
- tool calls por turno **> 6**.

### 11.4 Lo que NO hay que hacer (aprendido a golpes)

- ❌ Declarar MCP en el patch del **perfil** (se cargan en todas las sesiones).
- ❌ Editar el perfil o los presets **con sesiones abiertas** (deja la sesión sin herramientas; ver §9).
- ❌ Validar un preset solo por su forma: la validación real es montarlo o abrirlo en una sesión nueva.
- ❌ Copiar un `reference.md` entero dentro de un `SKILL.md`.
- ❌ Volcar en la respuesta el contenido de ficheros o JSON completos: extracto + ruta.


