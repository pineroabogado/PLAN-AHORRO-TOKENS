# Prompt para encargar a cualquier agente la aplicación del plan de reducción de tokens

**Uso:** copiar el bloque de §2 tal cual y entregarlo al agente que vaya a ejecutarlo (pegado en su chat, o como encargo escrito). **No hay que rellenar nada**: el prompt no presupone quién lo recibe, ni el nombre del agente, ni la máquina, ni el proyecto.

**Por qué es aséptico:** no asigna rol («eres un…»), no nombra ningún equipo ni despacho, no exige saber de antemano el proyecto destino (el agente lo deduce del directorio en el que trabaja y, si no está claro, lo pregunta), y no depende de la conversación en la que se generó.

---

## 1. Qué obtiene quien lo ejecuta

Un encargo cerrado, con: fuente única donde leer el plan, reglas que no se negocian, pasos con los comandos exactos, evidencia exigida, qué hacer si falla, qué no hacer y entregables. Todo lo que el agente necesita está en el propio texto o en la carpeta que este indica.

---

## 2. El prompt

```text
TAREA
Reducir el consumo de tokens de este entorno de agentes, aplicándolo a UN proyecto concreto y
dejándolo medido, separado y documentado. No es un informe ni una propuesta: hay que ejecutarlo y
demostrarlo con evidencia.

QUIÉN LO EJECUTA
Cualquier agente con acceso a consola y a ficheros. No se presupone ningún rol, nombre, especialidad
ni conocimiento previo. Si te falta un dato, pídelo; no lo supongas.

ALCANCE
- Proyecto destino: el proyecto en cuyo directorio estás trabajando. Si no estás en ninguno, o hay
  varios candidatos, PREGUNTA cuál antes de escribir nada.
- Si el proyecto destino no es el tuyo habitual: puedes LEER lo que necesites, pero no escribas en él
  hasta que quien te encarga la tarea lo autorice expresamente.
- Fuera de alcance: cualquier otro proyecto, cambiar el comportamiento funcional del proyecto, y
  tocar credenciales o datos.

FUENTE ÚNICA (leer antes de actuar; no improvises)
<CARPETA_DEL_PLAN>            (en este entorno: C:\Users\Despacho3\Desktop\DESARROLLOS\PLAN AHORRO TOKENS)
- README.md                     → índice de la carpeta, reglas y estado del plan
- PLAN_REDUCCION_TOKENS.md      → §9 separación de los MCP por proyecto · §10 medición recurrente
                                  (baseline y comparación) · §11 escalabilidad, presupuestos y trampas
- scripts\                      → herramientas; ejecutar SIEMPRE desde esa carpeta:
    · crear-preset-proyecto.mjs   crea el preset del proyecto (copia el `standard` de serie y le añade su fila MCP)
    · medir-consumo-sesiones.mjs  KPI: cabecera por petición (KB y tokens), familias de tools, pasos, tool calls
    · recargar-mcp-dsh.ps1        fuerza la recarga de los servidores MCP tras cambiar su código
Si esa carpeta no existe o no es accesible, PARA y dilo: sin la fuente única no se aplica nada.

POR QUÉ (modelo mental, 4 líneas)
El gasto no está solo en las respuestas: en cada paso se reenvía el prompt de sistema y, sobre todo,
las DEFINICIONES DE TODAS las tools conectadas. Si en el entorno hay varios proyectos con servidores
MCP declarados a la vez, cada sesión paga el manual de todos los demás. La solución no es escribir
menos, es que cada proyecto cargue solo lo suyo y que sus skills y tools tengan tamaño presupuestado.

REGLAS DURAS (no negociables)
1. LA CONFIGURACIÓN DEL ASISTENTE NO SE EDITA EN CALIENTE. Parar el asistente → editar → comprobar en
   seco con `dsh --profile web --dump-config` → arrancar. Editarla con sesiones abiertas desmonta la
   composición y deja la sesión SIN HERRAMIENTAS (comprobado el 23/09/2026).
2. ALCANCE: escribir en un proyecto que no es el tuyo exige autorización expresa de quien te encarga
   la tarea. Leer no requiere permiso.
3. Los servidores MCP NO se declaran en la configuración general del perfil
   (~/.dsh/profiles/web/cordis.patch.yml): van DENTRO del preset del proyecto. Cada preset monta solo
   lo suyo.
4. No inventes rutas, credenciales ni datos: léelos del propio proyecto (.env.local, mcp.json, código).
5. Respuestas breves: extracto y ruta. Nunca vuelques ficheros ni JSON completos.
6. Nada entra sin coste medido: si no se puede medir, no se aprueba.

DATOS QUE NECESITAS (dedúcelos del proyecto; pídelos solo si no constan)
- preset: id (minúsculas y guiones), nombre visible, descripción;
- MCP: nombre del servidor, comando y argumentos (ruta al index.js del servidor, o proxy + URL),
  variables de entorno necesarias y directorio de trabajo;
- usuario o credenciales que el MCP necesite, y ruta del proyecto.

PASOS (ejecutar en orden; todos los comandos, desde la carpeta del plan)
1. MEDIR EL PUNTO DE PARTIDA
   node scripts\medir-consumo-sesiones.mjs --top 5 --guardar "mediciones\consumo-baseline-<proyecto>-<AAAAMMDD>.json"
   Anota: cabecera media por petición (KB y tokens), pasos, tool calls y familias de tools detectadas.
2. CREAR EL PRESET (no editar los presets de serie: el script copia y añade)
   node scripts\crear-preset-proyecto.mjs --id <id> --nombre "<Nombre>" --descripcion "<...>" ^
     --mcp-server <servidor> --mcp-script "<ruta>" [--mcp-arg "<arg>"] [--mcp-env CLAVE=valor] [--mcp-cwd "<ruta>"]
   (en PowerShell el salto de línea es `; en bash, \)
   Comprueba el resultado: el YAML debe parsear y la última fila debe ser la del MCP.
3. USO: las sesiones de ese proyecto eligen ese preset en el selector de sesión nueva. Si hay que
   cambiar el preset por defecto, hazlo EN FRÍO en ~/.dsh/profiles/web/cordis.patch.yml:
     - id: agent-presets
       config:
         default: <id>
4. VERIFICAR (en frío)
   · Parar el asistente; `dsh --profile web --dump-config` → debe listar `agent-presets` y CERO filas
     `dsh-mcp-client` en el perfil; arrancar.
   · Abrir una SESIÓN NUEVA con el preset y comprobar que aparecen las tools `mcp__<servidor>__…`
     y NINGUNA de otros proyectos.
5. MEDIR EL DESPUÉS Y COMPARAR
   node scripts\medir-consumo-sesiones.mjs --nuevas --top 5 --comparar "<ruta del baseline>"
   Guarda el JSON nuevo en mediciones\.
6. DEJAR PUNTERO Y DOCUMENTAR (solo con autorización, si el proyecto no es el tuyo)
   Esta carpeta es la UBICACIÓN ÚNICA del plan: el proyecto NO guarda copia, solo apunta aquí. Deja el
   puntero en los DOS sitios que lee un agente de ese proyecto:
     a) su fichero de instrucciones (AGENTS.md o equivalente), y
     b) su regla alwaysApply (.cursor/rules/*.mdc), si el proyecto usa reglas,
   con este texto (adaptar nombres; no inventar rutas):
     "Plan de ahorro de tokens — UBICACIÓN ÚNICA: <CARPETA_DEL_PLAN> (repo
      https://github.com/pineroabogado/PLAN-AHORRO-TOKENS). Es la única referencia del plan y no hay
      copia en este repositorio. Leerlo antes de crear o cambiar tools MCP, skills o la configuración
      del asistente. Presupuestos: skill ≤ 8 KB, tool MCP ≤ 200 tokens. La configuración del asistente
      NUNCA se edita en caliente. Cada servidor MCP se declara en el preset del proyecto."
   Además, en la documentación del proyecto: qué preset usa, cómo se elige, su baseline, su presupuesto
   de skills y su cadencia de medición.

EVIDENCIA EXIGIDA (no vale «debería funcionar»)
- salida de --dump-config con `agent-presets` y sin filas MCP en el perfil;
- composición de la sesión nueva: familias `mcp__<servidor>__` presentes y las ajenas ausentes;
- baseline guardado + comparación, con la variación en %;
- documento del proyecto actualizado (si se autorizó).

SI ALGO FALLA
Para y reporta el MENSAJE DE ERROR LITERAL (no lo resumas). Mira además el apartado de presets en los
ajustes del asistente: si un preset no monta, su tarjeta aparece marcada con el motivo. Plan B
inmediato (1 minuto) — restaurar la copia de seguridad de la configuración y reiniciar:
  copy /Y "%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml.bak" "%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml"

AVISO CONOCIDO (23/09/2026): en el primer caso real la verificación ESTRUCTURAL quedó superada
(configuración general sin MCP y presets válidos), pero la de EXTREMO A EXTREMO quedó pendiente de
abrir una sesión nueva y ver las tools. Si en tu caso las tools del MCP NO aparecen en la sesión nueva,
investiga antes de dar el patrón por bueno. Causas candidatas:
  (a) la fila del cliente MCP podría necesitar estar dentro de un grupo con realm aislado en el preset;
  (b) el montaje del preset se rechaza: quita `failOnStartupError: false` de la fila MCP para que el
      fallo se manifieste en lugar de silenciarse, y lee el motivo en los ajustes de presets.

QUÉ NO HACER (aprendido a golpes)
- Declarar MCP en el patch del perfil: se cargan en TODAS las sesiones, también en las de otros proyectos.
- Editar el perfil o los presets con sesiones abiertas.
- Validar un preset solo porque su YAML parsea: la validación real es montarlo o abrirlo en sesión nueva.
- Pegar un reference.md entero dentro de un SKILL.md (presupuesto: núcleo ≤ 8 KB).
- Dejar conectada una herramienta que el proyecto no usa: sus definiciones se pagan en cada paso.

ENTREGABLES
preset creado y verificado · baseline JSON guardado · puntero dejado en el proyecto (si se autorizó) ·
informe final de 5 líneas: id del preset, ruta del proyecto, cabecera antes/después, estado, pendiente.

CASO YA EJECUTADO (sirve de ejemplo de los comandos; otro proyecto distinto tendrá otros datos)
  node scripts\crear-preset-proyecto.mjs --id crm --nombre "CRM AVODESK - ventas" ^
    --descripcion "Agente del CRM de ventas (AVODESK). No carga las herramientas de GCI-ONLINE." ^
    --mcp-server avodesk ^
    --mcp-script "C:\Users\Despacho3\AppData\Roaming\npm\node_modules\mcp-remote\dist\proxy.js" ^
    --mcp-arg "https://sales-crm.avodeskapp.com/mcp"
```

---

## 3. Notas de uso

- **No hay nada que sustituir.** `<CARPETA_DEL_PLAN>` aparece solo como recordatorio de cuál es la raíz de todo; el prompt ya lleva la ruta real al lado. El nombre del proyecto no se pone: lo determina el directorio en el que trabaja el agente y, si hay duda, el propio prompt le obliga a preguntar.
- **Un solo valor a tener en cuenta:** si el agente trabaja en otro equipo donde la carpeta del plan está en otra ruta, dale la ruta absoluta correcta.
- **Si el proyecto no tiene servidor MCP propio**, dile que omita los pasos 2 y 4: quedan el presupuesto de skills, la medición y el puntero.
- **Si el proyecto no usa Cursor ni reglas `.mdc`**, el puntero se deja solo en su fichero de instrucciones (o en su documentación de agentes).
- Referencia del plan: [`PLAN_REDUCCION_TOKENS.md`](./PLAN_REDUCCION_TOKENS.md) §9, §10 y §11 · índice: [`README.md`](./README.md).
