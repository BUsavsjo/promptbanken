# MCP-exponering av promptpaket (delprojekt 4)

**Datum:** 2026-07-19
**Status:** Godkänd design (produktmodell och regler dikterade av Peter i konversationen 2026-07-19, "Rätt modell blir...")
**Berörda repos:** `promptbanken` (fyra nya `_for_key`-RPC:er), `mcp_promptbanken` (fyra nya/justerade MCP-tools)

## Produktmodell (Peters formulering, bindande)

Tre tydliga nivåer i Valvet:

| Innehåll | Betydelse |
|---|---|
| Bläddra i Promptbanken | Hela katalogen |
| Aktiverade paket | Utvalda standardmallar nära till hands |
| Mitt Valv | Egna, kopierade och redigerbara mallar |

- **Aktivera paket** = användaren väljer vilka centrala promptpaket som ska
  finnas tillgängliga i Valvets arbetsyta. Tekniskt en ren
  prenumerationsflagga (`valvet_package_activations`, delprojekt 3) —
  påverkar inte vad `list_pro_templates()` returnerar, bara vad som visas
  expanderat i webbens UI. Produktmässigt formar den ändå användarens
  personliga arbetsyta, och är därför värd att exponera via MCP.
- **Kopiera prompt** = användaren skapar en egen redigerbar version i sitt
  privata Valv (`content_items`, räknas mot månadskvoten).
- **Ej aktiverade paket** syns inte i Valvets normala vy men kan alltid
  hittas via "Bläddra i Promptbanken".

## Scope

Denna spec gäller enbart promptpaketen (`pro_prompt_templates`, de 7
områdena/42 mallarna) — inte `content_items`-katalogen (kommun-posterna),
vilket uttryckligen lämnas oexponerat via MCP tills vidare (beslutat i
konversationen).

## Bindande regler (Peters formulering)

1. AI:n får gärna föreslå aktivering.
2. Aktivering och avaktivering ska kräva ett uttryckligt användarönskemål —
   detta är en instruktion till den anropande modellen (verktygets
   docstring), inte en teknisk spärr servern kan verkställa.
3. Kopiering ska alltid kräva tydlig bekräftelse eftersom den skapar
   innehåll och påverkar kvoten — `confirm` måste vara explicit `true`,
   servern verkställer detta (samma mönster som `archive_my_item_for_key`).

## Verktyg

Fem verktyg totalt, varav ett redan finns:

- **`list_pro_templates`** (befintligt, ingen logikändring). Fungerar redan
  som paketlistning — returnerar `area`/`area_label` för alla 42 mallar.
  Docstring utökas med en mening om att `area` motsvarar ett promptpaket.
- **`list_active_packages`** (nytt, read-only). Returnerar vilka `area`
  anroparens workspace har aktiverat.
- **`activate_package(area)`** / **`deactivate_package(area)`** (nya,
  idempotenta). Docstring: "Only call this when the user has explicitly
  asked to activate/deactivate a package — do not call it proactively just
  because it seems helpful."
- **`copy_template_to_valvet(template_id, confirm)`** (nytt skrivverktyg).
  `confirm` måste vara `true`, annars avvisas anropet.

## DB (`promptbanken`, en migration)

Fyra nya `_for_key`-RPC:er, samma mönster som `save_my_item_for_key`/
`archive_my_item_for_key`: slå upp `api_keys` → `workspaces` (kräver
`revoked_at is null`, `scopes @> array['mcp']`, `mcp_enabled = true`,
`status = 'active'`), annars `raise exception 'Ogiltig nyckel.'`.

1. **`copy_template_to_valvet_for_key(p_key_hash, p_template_id, p_confirm)`**
   — spegel av webbens `copy_template_to_valvet` (delprojekt 3) men
   nyckelhash-baserad:
   - `if p_confirm is distinct from true then raise exception 'confirm måste vara true för att kopiera en mall.';`
     (exakt samma formuleringsmönster som `archive_my_item_for_key`).
   - Rate limit 20 anrop/60s per nyckel (samma räkning som
     `save_my_item_for_key`, delad räknare över alla skrivverktyg via
     `mcp_write_attempts`).
   - Samma delade månadskvot som webbens kopiering (Free 5/mån via
     `app_private.valvet_catalog_copies`, `has_active_pro_entitlement`
     avgör obegränsat för Pro).
   - Samma mappning som webb-RPC:n: `type='prompt'`, `content=prompt_text`,
     `category=area_label`, `status='draft'`, `visibility='private'`,
     `source='catalog_copy'`.
   - På lyckad insert: logga `mcp_write_attempts` med
     `tool='copy_template_to_valvet'`, `outcome='success'`. Avvisade försök
     loggas separat av Python-lagret efter fångat fel (samma tvåfas-mönster
     som övriga skrivverktyg — en `raise` rullar tillbaka hela
     transaktionen, så loggning måste ske utanför den).
2. **`activate_package_for_key(p_key_hash, p_area)`** — validerar nyckeln,
   `insert into valvet_package_activations (workspace_id, area) values (...) on conflict (workspace_id, area) do nothing`
   (idempotent). **Rör aldrig `mcp_write_attempts`** — varken rate-limit-
   check eller loggning. Motivering: om aktivering loggades i samma tabell
   skulle den falla in i det delade 60s-fönstret som `copy_template_to_valvet`
   och `save_my_item` räknar mot, vilket vore fel eftersom aktivering
   uttryckligen INTE ska vara rate-limiterad. Att hålla den helt utanför
   tabellen är enklast och garanterar det.
3. **`deactivate_package_for_key(p_key_hash, p_area)`** — samma
   nyckelvalidering, `delete from valvet_package_activations where workspace_id=... and area=...`.
   Idempotent (borttagning av redan inaktivt paket är en säker no-op).
4. **`list_active_packages_for_key(p_key_hash) returns table(area text)`**
   — samma nyckelvalidering, `select area from valvet_package_activations where workspace_id = ...`.

Alla fyra: `security definer`, `set search_path = ''`, `app_private.`-
implementation + tunn `public.`-wrapper, `revoke all from public`,
`grant execute to anon` (samma grant-nivå som övriga `_for_key`-RPC:er —
nyckelhashen är i sig beviset på behörighet).

## MCP-server (`mcp_promptbanken`)

- `vault.py` (eller ny fil `packages.py` om `vault.py` börjar bli stor —
  avgörs i implementationsplanen) får fyra nya Python-funktioner som anropar
  RPC:erna via `_call_rpc`, samma stil som befintliga `list_items`/
  `save_item`/`archive_item`.
- `mcp_server.py`: fyra nya `@mcp.tool()`-funktioner + motsvarande poster i
  `_tool_definitions()` och `tools/call`-dispatchen (samma tre ställen som
  varje befintligt verktyg kräver) + REST-endpoints under
  `/api/v1/vault/packages` (GET för list_active, POST för activate,
  DELETE eller POST .../deactivate) — exakt mönster avgörs i
  implementationsplanen utifrån hur `/api/v1/vault/items` redan är byggd.
- `hosted_guard.py`s allowlist utökas med de fyra nya verktygen (samma steg
  som krävdes för `list_my_private_prompts` m.fl., se `CLAUDE.md`).
- `copy_template_to_valvet`s Python-lager låter fel propagera (samma
  motivering som `save_item`: en tyst tom retur döljer att skrivningen
  faktiskt misslyckades) och loggar avvisade försök via
  `log_write_attempt(mcp_key, 'copy_template_to_valvet', outcome)` efter
  fångat fel — samma mönster som `archive_item`.

## Docstring-krav (verkställs i kod, granskas i implementation)

- `activate_package`/`deactivate_package`: engelsk docstring måste
  uttryckligen instruera modellen att bara anropa verktyget på ett
  uttryckligt användarönskemål, inte proaktivt.
- `copy_template_to_valvet`: docstring måste nämna att `confirm=true`
  krävs och att anropet skapar en riktig, kvot-räknad Valv-post.

## Felhantering

Alla RPC:ers `raise exception`-meddelanden är på svenska (samma konvention
som övriga Valvet-RPC:er). Python-lagret låter dem propagera för
skrivverktyget (`copy_template_to_valvet`) och returnerar tomma
listor/`None` för läsverktygen (`list_active_packages`) vid saknad/ogiltig
nyckel — samma asymmetri som redan finns mellan `vault.py`s läs- och
skrivfunktioner.

## Verifiering

1. SQL-checklista (`verify_mcp_packages.sql`): nyckelvalidering (ogiltig
   nyckel avvisas på alla fyra), aktivera/avaktivera-rundtur är idempotent,
   `copy_template_to_valvet_for_key` med `p_confirm=false` avvisas utan att
   skapa någon rad, med `p_confirm=true` lyckas och räknas mot samma kvot
   som webbens kopiering, rate-limit-testet (21 snabba anrop) avvisar det
   21:a men aktivera/avaktivera är opåverkade av samma räknare.
2. `curl tools/call` mot VPS:en efter deploy för alla fyra nya verktyg, med
   och utan giltig nyckel.
3. Manuellt scenario: aktivera ett paket via MCP, verifiera i webben att
   paketet visas expanderat i "Bläddra i Promptbanken"; kopiera en mall via
   MCP med `confirm=true`, verifiera att den dyker upp under "Mina
   insättningar" i webben.

## Utanför scope

`content_items`-katalogen (kommun-posterna) via MCP, handkuraterade paket,
notifiering vid kataloguppdateringar, ändring av `list_pro_templates`s
befintliga beteende.
