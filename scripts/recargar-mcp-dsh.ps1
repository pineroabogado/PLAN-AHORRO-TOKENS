<#
.SYNOPSIS
    Fuerza la recarga de los servidores MCP en DeepSeek Harness (DSH). Generico: vale para cualquier proyecto.

.DESCRIPTION
    Un servidor MCP es un proceso hijo que arranca con `node <ruta>\index.js`: Node lee el
    codigo AL ARRANCAR, de modo que los cambios en su codigo no surten efecto hasta
    respawnear ese proceso.

    El cliente MCP reconecta cuando cambia de forma EFECTIVA su entrada de configuracion.
    Un cambio de solo comentario NO dispara la recarga (comprobado). Por eso este script sube
    el marcador de recarga con la fecha/hora actual.

    RECONOCE CUALQUIER MARCADOR cuyo nombre termine en `CLIENT_TAG` (p. ej. MCP_CLIENT_TAG,
    GCI_MCP_CLIENT_TAG, CRM_CLIENT_TAG...) dentro de:
      1. ~/.dsh/.agent-presets/<id>/agent.cordis.yml   (un preset por proyecto; lo normal hoy)
      2. ~/.dsh/profiles/web/cordis.patch.yml          (patch del perfil; compatibilidad)
    Si un fichero no tiene marcador pero si una variable `*USER_ID`, le anade uno.
    Guarda copia previa en `<fichero>.bak`.

.PARAMETER EsperaSegundos
    Segundos a esperar tras el cambio (10).

.PARAMETER RutaFichero
    Fichero concreto a modificar (pruebas o casos sueltos). Si se indica, no busca.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File "...\PLAN AHORRO TOKENS\scripts\recargar-mcp-dsh.ps1"
    powershell -NoProfile -ExecutionPolicy Bypass -File "...\recargar-mcp-dsh.ps1" -EsperaSegundos 20
    powershell -NoProfile -ExecutionPolicy Bypass -File "...\recargar-mcp-dsh.ps1" -RutaFichero "C:\tmp\copia.yml"

.NOTES
    ASCII a proposito: Windows PowerShell 5.1 lee los .ps1 sin BOM con la codificacion ANSI.
    AVISO: los presets se montan al crear la sesion; si el cambio de codigo no llega a una
    sesion ya abierta, abre una SESION NUEVA con el preset del proyecto.
#>
[CmdletBinding()]
param(
    [int]$EsperaSegundos = 10,
    [string]$RutaFichero = ''
)

$ErrorActionPreference = 'Stop'
$homeDir = $env:USERPROFILE

function Get-Candidatos {
    if ($RutaFichero) { return @($RutaFichero) }
    $lista = @()
    $presetsDir = Join-Path $homeDir '.dsh\.agent-presets'
    if (Test-Path -LiteralPath $presetsDir) {
        foreach ($d in Get-ChildItem -LiteralPath $presetsDir -Directory) {
            $f = Join-Path $d.FullName 'agent.cordis.yml'
            if (Test-Path -LiteralPath $f) { $lista += $f }
        }
    }
    $lista += (Join-Path $homeDir '.dsh\profiles\web\cordis.patch.yml')
    return $lista
}

# Marcador generico: cualquier variable de entorno acabada en CLIENT_TAG.
$rxTag = [regex]"(?m)^([ \t]*[A-Z][A-Z0-9_]*CLIENT_TAG:[ \t]*)\x27([^\x27]*)\x27"
# Respaldo 1: cualquier variable acabada en USER_ID (para insertar el marcador si no existe).
$rxUser = [regex]"(?m)^([ \t]*[A-Z][A-Z0-9_]*USER_ID:[^\r\n]*)"
# Respaldo 2: cualquier fila de servidor MCP (serverName:) aunque no tenga env todavia.
$rxServer = [regex]"(?m)^([ \t]*)serverName:[^\r\n]*"
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

Write-Host ''
Write-Host '=== Recarga de los MCP (DeepSeek Harness) ===' -ForegroundColor Cyan

$tocados = @()
$sinMarcador = @()

foreach ($f in (Get-Candidatos)) {
    if (-not (Test-Path -LiteralPath $f)) { continue }
    $texto = [System.IO.File]::ReadAllText($f)
    $m = $rxTag.Match($texto)

    if ($m.Success) {
        $anterior = $m.Groups[2].Value
        $reemplazo = $m.Groups[1].Value + [char]39 + "reload-$stamp" + [char]39
        $textoNuevo = $texto.Remove($m.Index, $m.Length).Insert($m.Index, $reemplazo)
    } else {
        $salto = if ($texto.Contains("`r`n")) { "`r`n" } else { "`n" }
        $mu = $rxUser.Match($texto)
        if ($mu.Success) {
            $textoNuevo = $texto.Insert($mu.Index + $mu.Length, $salto + $mu.Groups[1].Value + "MCP_CLIENT_TAG: 'reload-$stamp'")
            $anterior = '(no existia)'
        } else {
            # Fila MCP sin env: se le crea el bloque env con el marcador, bien indentado.
            $ms = $rxServer.Match($texto)
            if (-not $ms.Success) { $sinMarcador += $f; continue }
            $ind = $ms.Groups[1].Value
            $bloque = $salto + $ind + 'env:' + $salto + $ind + "  MCP_CLIENT_TAG: 'reload-$stamp'"
            $textoNuevo = $texto.Insert($ms.Index + $ms.Length, $bloque)
            $anterior = '(no existia)'
        }
    }

    if ($textoNuevo -eq $texto) { continue }
    Copy-Item -LiteralPath $f -Destination ($f + '.bak') -Force
    [System.IO.File]::WriteAllText($f, $textoNuevo, (New-Object System.Text.UTF8Encoding($false)))
    $tocados += $f
    Write-Host ("  marcador: {0}  ->  reload-{1}" -f $anterior, $stamp) -ForegroundColor Green
    Write-Host ("  fichero : {0}" -f $f)
}

if ($tocados.Count -eq 0) {
    Write-Host '[ERROR] No he encontrado ningun fichero con marcador de recarga (*CLIENT_TAG) ni variable *USER_ID.' -ForegroundColor Red
    Write-Host '        Revisa que exista ~/.dsh/.agent-presets/<proyecto>/agent.cordis.yml con su fila MCP.' -ForegroundColor Red
    if ($sinMarcador.Count) { Write-Host ('        Sin marcador: ' + ($sinMarcador -join '; ')) -ForegroundColor Yellow }
    exit 2
}

Write-Host ("Cambio aplicado en {0} fichero(s) (UTF-8 sin BOM, saltos de linea preservados)." -f $tocados.Count)

if ($EsperaSegundos -gt 0) {
    Write-Host ("Esperando {0} s a que DSH reconecte..." -f $EsperaSegundos)
    Start-Sleep -Seconds $EsperaSegundos
}

Write-Host ''
Write-Host '[OK] Recarga solicitada.' -ForegroundColor Green
Write-Host 'Verificacion: pide al agente una llamada a una tool mcp__<servidor>__...'
Write-Host 'Si el cambio era de codigo y no llega: abre una SESION NUEVA con el preset del proyecto.'
Write-Host 'Rollback: copia el .bak sobre el fichero correspondiente.'
exit 0
