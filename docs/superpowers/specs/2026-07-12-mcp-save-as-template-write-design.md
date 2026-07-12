# MCP write: "Spara detta som mall" (save_workspace_prompt)

## Syfte

Låta en användare i en pågående AI-chatt (Claude, ChatGPT, Copilot eller annan MCP-klient) be modellen "spara det här som en mall" och få en generaliserad, GDPR-kontrollerad prompt sparad i sin egen personliga Pro-arbetsyta i Promptbanken — utan att lämna chatten. Detta är den lokala MCP-serverns (`promptbanken/mcp-server/server/`) första write-funktion; servern har hittills bara varit läsning.

Gated till nycklar med `plan = 'pro'`. Free-nycklar kan inte skriva via MCP i denna version.

## Bakgrund

All skrivning till `content_items` sker idag via den inloggade webb-frontend (`admin.js`), skyddad av RLS-policyer och triggern `app_private.enforce_content_access_model()` som är hårt knuten till `auth.uid()` (kräver en riktig inloggad Supabase-session). MCP-anrop har ingen sådan session — bara en `X-MCP-Key`/nyckelhash, verifierad via `app_private.verify_mcp_key(p_key_hash)`. Läs-sidans RPC:er (`get_pro_templates_for_mcp_key`, `get_workspace_prompts_for_key`) löser detta genom att vara egna SECURITY DEFINER-funktioner som litar på nyckelhashen istället för `auth.uid()`. Write-funktionen behöver samma förtroendeväxling, men måste dessutom passera den befintliga INSERT-triggern på `content_items` utan att försvaga den för webbflödet.

Servern kör aldrig någon egen AI-modell (uttalad avgränsning i `mcp_promptbanken/PROJECT.md`, gäller samma princip här). Generalisering av innehåll (ta bort namn/personnummer, ersätta med platshållare, föreslå titel/kategori) och godkännande-steget sker alltså helt på klientmodellens sida (Claude/ChatGPT/Copilot) innan den anropar write-verktyget — servern kan inte tekniskt verifiera att en människa faktiskt godkänt något i en annan klients gränssnitt. Detta är en medveten designbegränsning, inte ett hål: samma modell som redan litar på klienten för `compile_skill_prompt`/`check_input_risk`-flödet.

## Flöde

1. Användaren ber klientmodellen spara chatten/instruktionen som mall.
2. Klientmodellen (inte servern) generaliserar innehållet: tar bort namn/personnummer/org-specifika detaljer, ersätter med platshållare, föreslår titel + kategori.
3. Klientmodellen visar förslaget för användaren och väntar på godkännande — detta styrs av verktygets beskrivningstext, inte av server-logik.
4. Klientmodellen anropar det befintliga verktyget `check_input_risk` på den genererade mallen (inte råchatten).
5. Om `check_input_risk` flaggar risk: klientmodellen visar vad som flaggades, användaren redigerar eller avbryter. Ingen serverspärr — `RiskChecker` varnar redan idag, blockerar aldrig (oförändrat beteende).
6. Vid godkännande anropar klientmodellen det nya verktyget `save_workspace_prompt(title, content, category, source)` med samma `X-MCP-Key`/env-nyckel som redan används för läsning.
7. Servern validerar nyckeln, kräver `plan = 'pro'`, skriver posten, returnerar resultat (lyckades/fel) till klientmodellen som visar det för användaren.

Inget mellanlagrat "förslag" hålls kvar på servern mellan steg 3 och 6 — ett enda write-anrop, ingen sessionstate.

## RPC-design

Ny SECURITY DEFINER-funktion i `promptbanken`-repots Supabase-schema:

```sql
create or replace function app_private.save_prompt_for_key(
    p_key_hash text,
    p_title text,
    p_content text,
    p_category text,
    p_source text default 'manual'
) returns public.content_items
```

**Förtroendeväxling utan att ändra befintlig trigger:** funktionen slår upp `workspace_id`/`owner_user_id`/`plan` via samma väg som `verify_mcp_key` redan använder, avvisar om `plan <> 'pro'` eller nyckeln är ogiltig/återkallad. Innan INSERT sätts en transaktionslokal session-inställning:

```sql
perform set_config('request.jwt.claim.sub', owner_user_id::text, true);
```

`auth.uid()` läser just denna inställning (Supabase/PostgREST-konvention). Eftersom `set_config(..., true)` bara gäller den aktuella transaktionen, och funktionen är SECURITY DEFINER (bara exekverbar av `anon` som en hel, redan validerad enhet — ingen klient kan sätta detta värde själv utan att gå via funktionen), ser den redan existerande triggern `enforce_content_access_model()` ett giltigt `auth.uid()` som matchar `created_by`/`owner_user_id`. Alla befintliga regler (max_prompts-gräns, visibility-regler för personal/pro-workspace, publik-spärr) återanvänds **oförändrade** — ingen duplicerad valideringslogik i den nya funktionen.

Insert-värden: `workspace_id` (från nyckeln), `type='prompt'`, `title`, `content`, `category`, `visibility='private'` (låst — write-verktyget skriver aldrig `workspace`/`public`, se Skopning), `status='draft'`, `created_by`/`owner_user_id` = `owner_user_id`, `source`.

**Ny kolumn:** `content_items.source text not null default 'manual' check (source in ('manual', 'chat_extraction'))`. Ren metadata, påverkar ingen befintlig rad (default `'manual'`).

Grant: `execute on function app_private.save_prompt_for_key to anon` — samma förtroendemodell som `get_pro_templates_for_mcp_key`/`get_workspace_prompts_for_key` (nyckelhashen är beviset på behörighet, ingen ytterligare Postgres-roll behövs).

Felfall funktionen ger tydliga svenska `raise exception`-meddelanden för (fångas och paketeras av Python-lagret nedan):
- Ogiltig/återkallad/saknad nyckel
- Nyckelns plan är inte `pro`
- `max_prompts`-gräns nådd (redan befintligt triggerfel, återanvänds rakt av)

## Skopning / permissions

Låst till egen personlig Pro-arbetsyta i v1. `visibility` hårdkodas till `'private'` i funktionen — klienten kan inte skicka in ett annat värde. Delning till `shared_workspace_addons` är explicit utanför scope denna version; kan läggas till senare (t.ex. ett `p_workspace_id`-parameter som gör samma medlemskaps-/rollkontroll som `get_workspace_prompts_for_key` redan gör) utan att ändra kontraktet för v1-anrop.

## Kategorisering

`category` är fritext i databasen (`content_items.category text`, ingen enum) — klientmodellen kan skicka valfri sträng. Ingen servervalidering av kategorival utöver att fältet inte är tomt. Klientmodellen föreslår kategori, användaren kan ändra fritt innan godkännande (sker på klientsidan, ingen serverlogik). Ingen confidence-tröskel eller låst sex-kategorimodell i v1 — det fanns aldrig i den faktiska databasen, bara en plan för Free-låsning till en fast standardkategori (separat, obyggd TODO-punkt, orört av denna design).

## Dubblettkontroll

Ingen i v1. Användaren ser eventuella dubbletter själv i "Mina prompts" i `admin.html` och kan radera manuellt.

## Felrapportering vid missad GDPR-risk

Ingen separat rapporteringsväg i v1. Användaren äger raden och kan redigera/radera den direkt i `admin.html` (befintlig funktionalitet) om `check_input_risk` missade något känsligt.

## Telemetri

`source` (`manual` | `chat_extraction`) sparas som vanlig kolumn på raden — ingen extra loggning eller skuggkopia av chattinnehåll. Klientmodellen sätter `source='chat_extraction'` när anropet kommer från "spara som mall"-flödet; `manual` är standard för framtida andra anropsvägar.

## Kodändringar

### `promptbanken/supabase/migrations/`

Ny migration (t.ex. `20260712100000_save_prompt_for_key.sql`):
- `alter table public.content_items add column if not exists source text not null default 'manual' check (source in ('manual', 'chat_extraction'));`
- `create or replace function app_private.save_prompt_for_key(...)` enligt RPC-designen ovan.
- `grant execute on function app_private.save_prompt_for_key(text, text, text, text, text) to anon;`

### `promptbanken/mcp-server/server/pro_templates.py` (eller ny modul, t.ex. `write_tools.py`)

Ny metod på samma klientmönster som `ProTemplatesClient` (stdlib `urllib`, samma `_call_rpc`-hjälpare, samma `p_key_hash`-payload):

```python
def save_prompt(self, title: str, content: str, category: str, source: str = "manual") -> dict[str, Any]:
    return self._call_rpc("save_prompt_for_key", {
        "p_title": title,
        "p_content": content,
        "p_category": category,
        "p_source": source,
    })
```

RPC-fel (t.ex. "inte Pro", "gräns nådd") kommer som ett `HTTPError` från PostgREST — samma mönster som `_call_rpc` redan hanterar, omvandlas till ett läsbart `RuntimeError`. Verktygsfunktionen i `mcp_server.py` fångar detta och returnerar ett strukturerat felobjekt (`{"status": "error", "message": ...}`) istället för att låta undantaget krascha MCP-anropet, så att klientmodellen kan visa felet för användaren.

### `promptbanken/mcp-server/server/mcp_server.py`

Nytt `@mcp.tool()`:

```python
@mcp.tool()
def save_workspace_prompt(title: str, content: str, category: str, source: str = "manual") -> dict[str, Any]:
    """Spara en genererad, redan GDPR-granskad mall i användarens Pro-arbetsyta.
    VIKTIGT för anropande modell: generalisera innehållet (ta bort namn/personnummer/
    org-specifika detaljer) och kör check_input_risk på den genererade mallen INNAN
    detta verktyg anropas. Visa förslaget för användaren och invänta uttryckligt
    godkännande före anrop — detta verktyg utför skrivningen direkt utan eget
    bekräftelsesteg. Kräver en Pro-nyckel (PROMPTBANKEN_MCP_KEY); free-nycklar avvisas."""
    ...
```

Verktygsbeskrivningen är den enda platsen där godkännande-kravet uttrycks — bär hela ansvaret för att klientmodeller (Claude/ChatGPT/Copilot) följer flödet, eftersom servern inte kan tvinga fram det tekniskt.

### Ej berört

- `mcp_promptbanken` (hostade repot) — ingen write där, oförändrad read-only-gräns.
- `check_input_risk`, `RiskChecker` — återanvänds oförändrade.
- `enforce_content_access_model()`-triggern — återanvänds helt oförändrad, bara ett nytt sätt att nå fram till ett giltigt `auth.uid()`.
- `admin.html`/`admin.js` — ingen UI-ändring krävs, raden dyker upp under befintliga "Mina prompts" som vilken annan prompt som helst (status `draft`).

## Testplan

Manuell verifiering (matchar befintligt mönster i repot, inga automatiserade tester):

1. `ast.parse` på ändrade Python-filer.
2. `python -c`-skript: anropa `save_prompt` med en påhittad/ogiltig nyckel → tydligt fel, ingen krasch.
3. Mot staging: skapa en riktig Pro-testnyckel, anropa `save_workspace_prompt` via MCP JSON-RPC → verifiera att raden dyker upp i `content_items` med rätt `workspace_id`/`owner_user_id`/`visibility='private'`/`status='draft'`/`source`.
4. Samma anrop med en Free-nyckel → avvisas med tydligt planfel, ingen rad skapas.
5. Fyll en test-arbetsyta till `max_prompts`-gränsen, verifiera att nästa `save_workspace_prompt`-anrop får samma gränsfel som webb-UI redan ger.
6. Verifiera att `admin.html` "Mina prompts" visar den MCP-skapade raden identiskt med en webb-skapad rad.
7. Rensa testnyckel/testdata efter verifiering (samma rutin som tidigare Pro-testnyckel-arbete, se `LOG.md` i `mcp_promptbanken`).

## Uttryckligen utanför scope v1

- Delning till `shared_workspace_addons` via write-verktyget.
- Semantisk/dubblettdetektering.
- Versionshistorik på mallar.
- Separat "rapportera missad GDPR-risk"-väg.
- Confidence-tröskel eller låst kategorienum.
- Write-stöd i den hostade `mcp_promptbanken`-servern.
