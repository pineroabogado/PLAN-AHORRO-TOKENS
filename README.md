# PLAN AHORRO TOKENS

**Ruta única para todos los agentes.** Esta carpeta es el punto de entrada del plan de reducción de consumo de tokens del asistente (DeepSeek Harness) en este PC. Está pensada para **cualquier agente, con cualquier nombre y para cualquier proyecto**: no depende de un dominio, de un servidor MCP concreto ni de un repositorio concreto.

**Ruta:** `C:\Users\Despacho3\Desktop\DESARROLLOS\PLAN AHORRO TOKENS`
**Repositorio:** https://github.com/pineroabogado/PLAN-AHORRO-TOKENS (rama `main`)
**Última actualización:** 23 de septiembre de 2026

---

## 1. Qué problema resuelve

El gasto del asistente no está en «respuestas largas» solamente: lo que más pesa es **lo que se reenvía en cada paso** (el prompt de sistema y, sobre todo, las **definiciones de todas las tools MCP conectadas**). Si varios proyectos conectan sus servidores MCP en la configuración general, **cada sesión carga el manual de todos los demás**.

Medido en este PC: **97–100 KB de cabecera por petición (~25.000 tokens)** con dos servidores MCP cargados, frente a **28 KB (~7.200)** sin ninguno.

Plan completo, con cifras y fases: [`PLAN_REDUCCION_TOKENS.md`](./PLAN_REDUCCION_TOKENS.md).

---

## 2. Contenido de la carpeta

| Fichero | Para qué |
|---|---|
| [`PLAN_REDUCCION_TOKENS.md`](./PLAN_REDUCCION_TOKENS.md) | El plan: análisis medido, fases, KPIs, separación de MCP por proyecto (§9), medición recurrente (§10), escalabilidad y mantenimiento (§11) |
| [`PROMPT_APLICAR_PLAN_TOKENS.md`](./PROMPT_APLICAR_PLAN_TOKENS.md) | Prompt autocontenido para pegar en cualquier agente y que aplique el plan a un proyecto |
| [`scripts/medir-consumo-sesiones.mjs`](./scripts/medir-consumo-sesiones.mjs) | Medidor/KPI: cabecera por petición, familias de tools MCP detectadas dinámicamente, pasos, llamadas a tools, resultados grandes |
| [`scripts/crear-preset-proyecto.mjs`](./scripts/crear-preset-proyecto.mjs) | Alta de un proyecto: crea su preset de agente (copia del `standard` de serie + su fila de servidor MCP) |
| [`scripts/recargar-mcp-dsh.ps1`](./scripts/recargar-mcp-dsh.ps1) | Fuerza la recarga de los MCP tras cambiar su código (reconoce cualquier marcador `*CLIENT_TAG`) |
| [`mediciones/`](./mediciones) | Histórico de mediciones comparables (una por fecha) + baseline |

Lanzador de escritorio: `..\MCP\Recargar-MCP-GCI.bat` (llama al script de recarga de esta carpeta).

---

## 3. Cómo lo usa un agente (flujo genérico)

1. **Leer** `PLAN_REDUCCION_TOKENS.md` (§9, §10, §11) y este README.
2. **Medir** el punto de partida y guardarlo como baseline:
   `node scripts/medir-consumo-sesiones.mjs --top 5 --guardar mediciones/consumo-<proyecto>-<AAAAMMDD>.json`
3. **Crear el preset del proyecto** (su configuración MCP va aquí, nunca en la configuración general):
   `node scripts/crear-preset-proyecto.mjs --id <proyecto> --nombre "<Nombre>" --descripcion "<...>" --mcp-server <serverName> --mcp-script "<ruta>" [--mcp-arg <a>] [--mcp-env CLAVE=valor] [--mcp-cwd "<ruta>"]`
4. **Verificar en frío**: parar el asistente → `dsh --profile web --dump-config` (no debe haber filas de MCP en la configuración general) → arrancar → abrir **sesión nueva** con ese preset y comprobar que aparecen las tools `mcp__<serverName>__…` y **ninguna** de otros proyectos.
5. **Medir el después** y comparar:
   `node scripts/medir-consumo-sesiones.mjs --nuevas --top 5 --comparar mediciones/<baseline>.json`
6. **Documentar** en el proyecto (con autorización, si es de otro ámbito) y **repetir la medición cada viernes**.

Presupuesto obligatorio al crear agentes o skills nuevos: **núcleo de skill ≤ 8 KB**, **definición de tool MCP ≤ 200 tokens**, sin dejar conectada ninguna herramienta que el proyecto no use, y nada de pegar documentos enteros dentro de un skill.

---

## 4. Reglas que no se negocian

1. **La configuración del asistente no se edita en caliente.** Parar → editar → `dsh --profile web --dump-config` → arrancar. Editarla con sesiones abiertas desmonta la composición y **deja la sesión sin herramientas** (comprobado).
2. **Cada servidor MCP se declara en el preset de su proyecto**, nunca en la configuración general (se aplicaría a todas las sesiones y a todos los proyectos).
3. **Los presets de serie no se editan**: se copian (el script ya lo hace).
4. **Alcance:** escribir en un proyecto ajeno requiere autorización explícita del usuario. Leer no requiere permiso.
5. **Respuestas breves**: extracto y ruta; nunca volcados completos de ficheros o JSON.
6. **Tras cambiar el código de un MCP**: lanzar `..\MCP\Recargar-MCP-GCI.bat` o `scripts\recargar-mcp-dsh.ps1`. Los presets se montan al crear la sesión, así que si el cambio no llega a una sesión abierta, **abre una sesión nueva con ese preset**.
7. **Ninguna capacidad nueva entra sin declarar su coste medido.** Si no se puede medir, no se aprueba.

---

## 5. Estado del plan

| Fase | Estado |
|---|---|
| Medición recurrente (baseline + comparación) | ✅ implantada y verificada |
| Separación de los MCP por proyecto (un preset por proyecto) | ✅ implantada y verificada en la estructura · ⏳ falta la comprobación de extremo a extremo en una sesión nueva del primer proyecto |
| Presupuestos de skill/tool y mantenimiento (§11) | ✅ documentados · ⏳ pendientes de aplicar |
| Disciplina de salida, configuración general a índice, adelgazar definiciones de tools, trocear skills grandes | ⏳ pendientes |

**Caso medido (ejemplo real, 23/09/2026):** al descargar dos servidores MCP de la configuración general, la cabecera por petición pasó de **97–100 KB (~25.000 tokens)** a **28 KB (~7.200)**: cada sesión de un proyecto dejó de cargar el manual del otro (**~10–17 k tokens menos por petición**).

---

## 6. Lo que no se mueve de sitio

| Elemento | Ruta | Motivo |
|---|---|---|
| Presets de agente (uno por proyecto) | `~/.dsh/.agent-presets/<id>/` | El asistente los lee de ahí; moverlos rompe la carga |
| Configuración general del asistente | `~/.dsh/profiles/web/cordis.patch.yml` | Idem |
| Mediciones y baseline | `mediciones/` de esta carpeta | Histórico comparable |

> Esta carpeta es **transversal** (fuera de los repositorios de proyecto) y tiene **repositorio propio**: https://github.com/pineroabogado/PLAN-AHORRO-TOKENS (rama `main`). Los ficheros `.bak` que generan los scripts están ignorados por `.gitignore`.
>
> **Publicar cambios:** `git -C "C:\Users\Despacho3\Desktop\DESARROLLOS\PLAN AHORRO TOKENS" add -A && git commit -m "<mensaje>" && git push`
