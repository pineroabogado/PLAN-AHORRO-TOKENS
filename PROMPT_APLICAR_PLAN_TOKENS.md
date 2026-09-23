# Prompt para aplicar el plan de ahorro de tokens a otro proyecto/agente

**Uso:** copiar el bloque de §2 y pegarlo en el agente que vaya a ejecutarlo (en el PC del despacho, con acceso a consola y ficheros). Sustituir los `<...>`.

**Antes de pegarlo:** el agente destinatario no conoce esta conversación; el prompt es autocontenido.

---

## 2. El prompt

```text
Eres un agente de mantenimiento del PC del despacho (DESPACHO3). Tu tarea es APLICAR EL PLAN DE
AHORRO DE TOKENS al proyecto <PROYECTO> (ruta: <RUTA_PROYECTO>).

0) LEE PRIMERO (no improvises). Todo está en la carpeta PLAN AHORRO TOKENS:
   C:\Users\Despacho3\Desktop\DESARROLLOS\PLAN AHORRO TOKENS
   - PLAN_REDUCCION_TOKENS.md
     · §9  separación de tools MCP por proyecto (presets de agente) + regla de oro
     · §10 medición recurrente (baseline y comparación)
     · §11 escalabilidad: alta de proyecto, presupuestos por skill/tool, mantenimiento, trampas
   - README.md (índice de la carpeta, estado y reglas)
   - Herramientas (ejecutar DESDE esa carpeta):
     · scripts\crear-preset-proyecto.mjs   (crea el preset copiando el `standard` de serie y añade la fila MCP)
     · scripts\medir-consumo-sesiones.mjs  (KPI: cabecera por petición, familias de tools, pasos, tool calls)
     · scripts\recargar-mcp-dsh.ps1        (recarga el MCP en DSH tras cambiar su código)

1) REGLAS DURAS (no negociables)
   1. LA CONFIGURACIÓN DEL ASISTENTE NO SE EDITA EN CALIENTE. Parar DSH → editar → comprobar en seco con
      `dsh --profile web --dump-config` → arrancar. Editarla con sesiones abiertas desmonta la composición
      y deja la sesión SIN HERRAMIENTAS (comprobado el 23/09/2026).
   2. ALCANCE: si <PROYECTO> no es el proyecto en el que ya trabajas, PIDE AUTORIZACIÓN EXPLÍCITA al
      usuario antes de escribir nada en él (leer sí puedes). No toques otros proyectos por iniciativa.
   3. Los servidores MCP NO se declaran en ~/.dsh/profiles/web/cordis.patch.yml: van DENTRO del preset
      del proyecto. Cada preset monta solo lo suyo.
   4. No inventes rutas, credenciales ni datos: léelos del propio proyecto (.env.local, mcp.json, código).
   5. Respuestas breves: extracto + ruta. Nunca vuelques ficheros ni JSON completos.

2) DATOS QUE NECESITAS (pídelos solo si no constan en el proyecto)
   - preset: id (minúsculas y guiones), nombre visible, descripción;
   - MCP: serverName, comando y argumentos (ruta al index.js del servidor, o proxy + URL),
     variables de entorno necesarias y directorio de trabajo;
   - credenciales/usuario que necesite el MCP (cualquier variable de entorno: usuario, clave, marcador
     de recarga...) y ruta del proyecto.

3) PASOS (todos los comandos, desde la carpeta PLAN AHORRO TOKENS)
   1. MEDIR EL PUNTO DE PARTIDA
      node scripts\medir-consumo-sesiones.mjs --top 5 --guardar
        "mediciones\consumo-baseline-<proyecto>-<AAAAMMDD>.json"
      Anota: cabecera media por petición (KB y tokens), pasos, tool calls y familias de tools.
   2. CREAR EL PRESET (no editar los presets de serie; el script copia y añade)
      node scripts\crear-preset-proyecto.mjs --id <id> --nombre "<Nombre>" --descripcion "<...>" \
        --mcp-server <serverName> --mcp-script "<ruta>" [--mcp-arg "<arg>"] [--mcp-env K=V] [--mcp-cwd "<ruta>"]
      Comprueba el resultado: el YAML debe parsear y la última fila debe ser la del MCP.
   3. USO: las sesiones de ese proyecto eligen ese preset en el chip de nueva sesión. Si hay que cambiar
      el preset por defecto, hazlo EN FRÍO en ~/.dsh/profiles/web/cordis.patch.yml:
        - id: agent-presets
          config:
            default: <id>
   4. VERIFICAR (en frío)
      · Parar DSH; `dsh --profile web --dump-config` → debe listar `agent-presets` y CERO filas
        `dsh-mcp-client` en el perfil; arrancar.
      · Abrir una SESIÓN NUEVA con el preset y comprobar que aparecen las tools `mcp__<serverName>__…`
        y NINGUNA de otros proyectos.
   5. MEDIR EL DESPUÉS Y COMPARAR
      node scripts\medir-consumo-sesiones.mjs --nuevas --top 5 --comparar "<ruta del baseline>"
      Guarda el JSON nuevo en mediciones\.
   6. DOCUMENTAR Y DEJAR PUNTERO (solo con autorización si es otro proyecto). Esta carpeta es la
      UBICACIÓN ÚNICA: el proyecto NO guarda copia del plan, solo apunta aquí. Deja el puntero en los
      DOS sitios que lee un agente de ese proyecto:
        a) el fichero de instrucciones del proyecto (`AGENTS.md` o equivalente) y
        b) la regla alwaysApply del proyecto (`.cursor/rules/*.mdc`), si el proyecto usa reglas,
      con este contenido mínimo (adaptar nombres, no inventar rutas):
        "Plan de ahorro de tokens — UBICACIÓN ÚNICA: C:\Users\Despacho3\Desktop\DESARROLLOS\PLAN AHORRO TOKENS
         (repo https://github.com/pineroabogado/PLAN-AHORRO-TOKENS). Es la única referencia del plan y no
         hay copia en este repositorio. Leerlo antes de crear o cambiar tools MCP, skills o la
         configuración del asistente. Presupuestos: skill ≤ 8 KB, tool MCP ≤ 200 tokens. La configuración
         del asistente NUNCA se edita en caliente. Cada servidor MCP se declara en el preset del proyecto."
      Además, en la documentación del proyecto: qué preset usa, cómo se elige, su baseline, su presupuesto
      de skills y su cadencia de medición.

4) EVIDENCIA EXIGIDA (no vale "debería funcionar")
   - salida de --dump-config con `agent-presets` y sin filas MCP en el perfil;
   - composición de la sesión nueva: familias `mcp__<serverName>__` presentes y las ajenas ausentes;
   - baseline guardado + comparación con la variación en %;
   - documento del proyecto actualizado (si se autorizó).

5) SI ALGO FALLA
   Para y reporta el MENSAJE DE ERROR LITERAL. Mira también Settings → presets: si un preset no monta,
   su tarjeta sale marcada con el motivo. Plan B inmediato (1 minuto):
     copy /Y "%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml.bak" "%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml"
   y reiniciar.

   AVISO CONOCIDO (23/09/2026): en el primer caso real la verificación ESTRUCTURAL quedó superada
   (configuración general sin MCP, presets válidos), pero la de EXTREMO A EXTREMO quedó pendiente de
   abrir una sesión nueva y ver las tools. Si en tu proyecto las tools del MCP NO aparecen en la sesión
   nueva, investiga antes de dar el patrón por bueno. Causas candidatas:
     (a) la fila del cliente MCP podría necesitar estar dentro de un grupo con realm aislado en el preset;
     (b) el montaje del preset se rechaza: quita `failOnStartupError: false` de la fila MCP para que el
         fallo se manifieste en lugar de silenciarse, y lee el motivo en Settings → presets.

6) QUÉ NO HACER (aprendido a golpes)
   - Declarar MCP en el patch del perfil (se cargan en TODAS las sesiones, también en las de otros proyectos).
   - Editar perfil o presets con sesiones abiertas.
   - Validar un preset solo porque su YAML parsea: la validación real es montarlo o abrirlo en sesión nueva.
   - Pegar un reference.md entero dentro de un SKILL.md (presupuesto: núcleo ≤ 8 KB).
   - Dejar conectada una herramienta que el proyecto no usa (las definiciones se pagan en cada paso).

7) ENTREGABLES
   preset creado y verificado · baseline JSON · nota en la documentación del proyecto · informe final de
   5 líneas (id del preset, ruta, cabecera antes/después, estado, pendiente).

EJEMPLO YA EJECUTADO (proyecto CRM AVODESK):
   node scripts\crear-preset-proyecto.mjs --id crm --nombre "CRM AVODESK - ventas" \
     --descripcion "Agente del CRM de ventas (AVODESK). No carga las herramientas de GCI-ONLINE." \
     --mcp-server avodesk \
     --mcp-script "C:\Users\Despacho3\AppData\Roaming\npm\node_modules\mcp-remote\dist\proxy.js" \
     --mcp-arg "https://sales-crm.avodeskapp.com/mcp"
```

---

## 3. Notas de uso

- El prompt asume este PC y esta carpeta como fuente de las herramientas y de la documentación. Si el agente trabaja desde otra carpeta, indícale la ruta absoluta: `C:\Users\Despacho3\Desktop\DESARROLLOS\PLAN AHORRO TOKENS`.
- Si el proyecto no tiene servidor MCP propio, omite los pasos 2 y 4 (basta con el presupuesto de skills y la medición).
- Referencia del plan: [`PLAN_REDUCCION_TOKENS.md`](./PLAN_REDUCCION_TOKENS.md) §9, §10 y §11 · índice: [`README.md`](./README.md).
