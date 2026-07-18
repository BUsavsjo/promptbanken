# Plan-/kvotsynk: textfixar, utökad get_plan_usage, Valvet-UI läser RPC

**Datum:** 2026-07-18
**Status:** Godkänd design
**Berörda repos:** `promptbanken` (migration, spec-markering), `valvet_promptbanken` (UI + text), `mcp_promptbanken` (dokumentation + verktygsbeskrivningar)

## Bakgrund

Analys av alla fyra repos (2026-07-18) visade två klasser av drift:

1. **Stale Pro-only-texter.** Produktbeslut 2026-07-18 (commit `495f547`, migration `20260718090000_valvet_free_update_archive_via_mcp.sql`) tillåter Free-plan att köra `update_my_item`/`archive_my_item` via MCP. Valvets `login.html`/`planer.html` var redan rätt, men tre ställen påstår fortfarande Pro-krav.
2. **Hårdkodade plangränser i klientkod.** Valvets `vault.js` hårdkodar valvgräns (50/1000) och MCP-nyckeltak (1/3). Värdena råkar stämma med DB-triggrarna idag, men inget hindrar att de glider isär. `get_plan_usage` exponerar inte Valvet-relevanta tal alls (räknar bara `type='prompt'`, dvs. kommun-katalogens cap).

Falsklarm som INTE ska åtgärdas: "Pro = 5 MCP-nycklar"-driften fanns inte — `20260706102500_addon_no_own_keys.sql` (senaste versionen av `enforce_mcp_key_limit`) sätter Pro = 3, vilket matchar både `planer.html` och Valvets konstanter.

## Sektion A — Textfixar

| Repo | Fil | Ändring |
|---|---|---|
| valvet_promptbanken | `vault.html` (~rad 208, MCP-guiden) | Ta bort påståendet att `update_my_item`/`archive_my_item` kräver Pro. Nytt budskap: alla Valvet-verktyg ingår i Free; Free begränsas av 5 nya sparningar/månad via MCP, Pro obegränsat. |
| mcp_promptbanken | `DECISIONS.md` (raderna 3–26) | Lägg tillägg daterat 2026-07-18: Pro-only-beslutet för update/archive upphävt av produktbeslut, referens till migration `20260718090000`. Skriv inte om historiken — lägg till. |
| mcp_promptbanken | `mcp-server/server/mcp_server.py` | Verktygsbeskrivningar för `update_my_item` och `archive_my_item` på BÅDA definitionsställena (`@mcp.tool()`-docstrings och `_tool_definitions()`): ta bort ev. Pro-krav i texten. Ingen logikändring — gating ligger i RPC:erna som redan är fixade. |
| promptbanken | `docs/superpowers/specs/2026-07-16-valvet-design.md` (raderna 77–78) | Markera update/archive-Pro-gaten som ersatt: notis med datum + hänvisning till `20260718090000`. |

## Sektion B — Migration: utöka `get_plan_usage`

Ny migration i `promptbanken/supabase/migrations/` (tidsstämpel efter `20260718100000`).

Postgres tillåter inte ändrad returtyp via `create or replace` → `drop function public.get_plan_usage(uuid);` följt av recreate. Grants återställs identiskt (`revoke all from public; grant execute to authenticated;`). Behåll `stable`, `security definer`, `set search_path = ''`.

Ny returtabell = befintliga 9 kolumner + sex nya:

```sql
returns table(
    has_license      boolean,
    max_prompts      integer,
    max_mcp_keys     integer,
    max_members      integer,
    max_workspaces   integer,
    used_prompts     integer,
    used_mcp_keys    integer,
    used_members     integer,
    used_workspaces  integer,
    valvet_items_used   integer,
    valvet_items_max    integer,
    monthly_saves_used  integer,  -- MCP save_my_item, innevarande kalendermånad
    monthly_saves_max   integer,  -- null = obegränsat (Pro)
    catalog_copies_used integer,
    catalog_copies_max  integer   -- null = obegränsat (Pro)
)
```

Beräkning (bara i personliga workspace-grenen; addon- och licensgrenarna returnerar 0 för `*_used` och `null` för `*_max`):

- **valvet_items_used/max:** spegla räknelogiken i `enforce_vault_item_limit` (`20260716101000_valvet_item_limit_trigger.sql`) exakt — aktiva (`status <> 'archived'`) `content_items` med `module='valvet'`, `workspace_id` = workspacet och `owner_user_id = auth.uid()`; max = 50 (`plan='free'`) / 1000 (annars).
- **monthly_saves_used/max:** `count(*)` från `app_private.mcp_write_attempts` där `workspace_id` = workspacet, `tool='save_my_item'`, `outcome='success'`, `created_at >= date_trunc('month', now())` — identiskt med spärren i `save_my_item_for_key` (`20260717090000`). Max = 5 för Free, `null` för Pro.
- **catalog_copies_used/max:** `count(*)` från `app_private.valvet_catalog_copies` där `workspace_id` = workspacet med samma månadsfönster — identiskt med spärren i `copy_catalog_item_to_valvet` (`20260718100000`). Max = 5 för Free, `null` för Pro.

Kompatibilitet: `admin.js` läser namngivna fält ur svaret och påverkas inte av tillagda kolumner. Inga andra kända konsumenter av RPC:n.

## Sektion C — Valvet-UI läser RPC

`valvet_promptbanken/src/vault.js`:

1. **Bootstrap:** där `workspaces` redan hämtas (`vault.js:92-96`) anropas även `supabase.rpc('get_plan_usage', { p_workspace_id })`. Svaret cachas i modulstate.
2. **Ersätt konstanter:** `vaultItemLimit()` (rad 52–54) och `MCP_KEY_LIMITS` (rad 421–425) läser statevärdena (`valvet_items_max`, `max_mcp_keys`) i stället för hårdkodade tal.
3. **Visa användning:** räknarbadgen visar `valvet_items_used av valvet_items_max` ("12 av 50"); MCP-vyn visar nyckelanvändning (`used_mcp_keys av max_mcp_keys`), månadssparningar ("2 av 5 sparningar via MCP denna månad") och katalogkopior ("0 av 5 katalogkopior denna månad"). `null`-max renderas "obegränsat".
4. **Uppdatering:** efter skapa/arkivera/återställ/nyckelhantering hämtas RPC:n om (eller uppdatera lokalt räknat värde — välj enklast vid implementation, men värdena får inte visas fel efter en åtgärd).
5. **Felhantering:** om RPC-anropet misslyckas faller UI:t tillbaka till dagens hårdkodade värden och döljer användningsräknarna. Gränserna upprätthålls oavsett server-side (triggrar/RPC:er) — klientvärdena är enbart UX.

## Testning/verifiering

- **Migration:** kör `supabase/tests/verify_valvet_rpcs.sql`-mönstret: anropa `get_plan_usage` som Free-användare med kända items/saves/kopior och verifiera de sex nya fälten; verifiera att admin-flödet (befintliga 9 fält) är oförändrat; verifiera addon-workspace ger 0/null.
- **UI:** manuell verifiering i browser — Free-konto: räknare visas, stämmer mot DB; simulera RPC-fel (blockera anrop i devtools) och bekräfta fallback; Pro-konto: "obegränsat".
- **Texter:** läskontroll att inget ställe längre påstår Pro-krav för update/archive (grep i alla tre repos).

## Utanför omfattning

- Paketlån, katalogflik i Valvet, ny huvudsajt, stdio-serverns utfasning — separata delprojekt enligt integrationsplanen 2026-07-18.
- Ingen ändring av själva gränsvärdena eller gating-logiken.
