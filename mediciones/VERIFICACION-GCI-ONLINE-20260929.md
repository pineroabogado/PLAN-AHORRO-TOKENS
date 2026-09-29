# Verificación GCI-ONLINE — 29/09/2026

| Campo | Valor |
|---|---|
| Preset | `gci` (`~/.dsh/.agent-presets/gci/agent.cordis.yml`, MCP `gci` / `mcp-gci-online`) |
| Proyecto | `C:\Users\Despacho3\Desktop\DESARROLLOS\GCI-ONLINE` |
| Perfil web | `default: gci`; `dump-config` → **0** `dsh-mcp-client` (MCP solo en presets) |
| Baseline | `consumo-baseline-gci-online-20260929.json` — cabecera media ~42 KB / ~10.8k tok (mixto histórico) |
| Post / muestra | `consumo-gci-online-post-20260929.json` — sesión solo-`mcp__gci__` (~62 KB cabecera en esa sesión); sesión sin MCP tools ~28 KB / ~7.2k tok |
| Pendiente | Abrir siempre sesión **nueva** con preset `gci` para no heredar familias mixtas `mcp__avodesk__+mcp__gci__` de sesiones viejas |
