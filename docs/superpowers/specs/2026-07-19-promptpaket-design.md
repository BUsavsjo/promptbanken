# Promptpaket — aktivera/avaktivera i Valvet (delprojekt 3)

**Datum:** 2026-07-19
**Status:** Godkänd design (modellval "Hybrid" + paket = de 7 områdena, bekräftat av Peter 2026-07-19; detaljbeslut fattade under mandatet "fortsätt tills visionen är klar")
**Berörda repos:** `promptbanken` (migration), `valvet_promptbanken` (UI)

## Produktmodell

- **Paket = de 7 områdena** i `pro_prompt_templates` (`area`/`area_label`).
  Ingen ny kurateringstabell — paketen härleds ur befintlig data (42 mallar).
- **Aktivering = prenumeration:** en rad per (workspace, area) i ny tabell.
  Ingen kopiering, ingen kvot, avaktivering tar bort raden. Aktiverade paket
  visas expanderade med sitt innehåll i Valvets "Bläddra i Promptbanken"-flik.
- **Hybrid:** varje mall i ett aktiverat paket har en "Kopiera till mitt
  Valv"-knapp som skapar en fristående, redigerbar kopia (ny RPC, se nedan)
  — samma månadskvot som katalogkopiorna (Free 5/mån, delad räknare).
- **MCP-exponering av paket/katalogsökning är delprojekt 4** — inget i denna
  spec rör MCP-servrarna.

## DB (`promptbanken`, en migration)

1. **`public.valvet_package_activations`**
   `(id uuid pk default gen_random_uuid(), workspace_id uuid not null fk→workspaces on delete cascade, area text not null, created_at timestamptz default now(), unique(workspace_id, area))`.
   RLS: select/insert/delete `to authenticated` där `workspace_id` hör till
   anroparens profil OCH workspacet är personligt
   (`exists (select 1 from profiles p join workspaces w on w.id=p.workspace_id where p.user_id=auth.uid() and p.workspace_id=valvet_package_activations.workspace_id and w.type='personal')`).
   `with check` samma villkor på insert. Ingen update-policy (raden är binär).
   Grant select/insert/delete till `authenticated`. Webben läser/skriver
   direkt (samma mönster som Valvets övriga CRUD via RLS).
   Ingen validering att `area` finns i `pro_prompt_templates` (fritext-área;
   en aktivering av okänd area visar bara ett tomt paket — ofarligt).
2. **`public.copy_template_to_valvet(p_template_id uuid) returns content_items`**
   `security definer, set search_path=''`, auth.uid()-baserad, grant
   `authenticated`. Spegel av `app_private.copy_catalog_item_to_valvet` men
   källa = `public.pro_prompt_templates`:
   - Samma personliga-workspace-uppslag och kvotgren (Free: max 5/mån ur
     `app_private.valvet_catalog_copies`, delad räknare med katalogkopior —
     loggtabellens `source_content_item_id` saknar FK och får bära
     template-id).
   - Mappning: `type='prompt'`, `title=t.title`, `content=t.prompt_text`,
     `category=t.area_label`, `status='draft'`, `visibility='private'`,
     `source='catalog_copy'`, `source_content_item_id=null` (FK:n pekar på
     content_items och kan inte bära template-id).
   - **Ingen dubblettdedup** (till skillnad från katalogkopiering):
     `source_content_item_id` kan inte användas och ett extra spårningsfält
     är inte motiverat — två kopior av samma mall är ofarligt och användaren
     ser dem i sin lista. Dokumenterat beslut.
   - Slug-kollisionsloop och `enforce_vault_item_limit`-trigger som i
     förlagan.
3. `get_plan_usage`/kvot-RPC:er rörs inte — `catalog_copies_used` räknar
   loggtabellen och fångar template-kopior automatiskt.

## UI (`valvet_promptbanken`, fliken "Bläddra i Promptbanken")

Ny sektion **"Promptpaket"** ovanför katalog-listan:

- Vid flikladdning: hämta `list_pro_templates()` (öppen RPC) + användarens
  aktiveringar. Gruppera mallarna på `area`.
- En rad per område (`.item-row`, befintliga klasser): `area_label`,
  antal mallar, knapp **"Aktivera"**/**"Avaktivera"** (direkt
  insert/delete mot `valvet_package_activations`).
- Aktiverat paket renderas expanderat: mallens titel + `syfte` + knapp
  **"Kopiera till mitt Valv"** → `supabase.rpc('copy_template_to_valvet',
  { p_template_id })`, samma statushantering/kvottext som befintliga
  katalogkopieringen (`setErrorStatus`, `loadItems()`-refresh).
- Sök-fältet i fliken filtrerar även paketmallarna (klientside på
  titel/syfte/area_label) — ingen serverändring.
- Ingen ny CSS utöver befintliga komponentklasser.

## Felhantering

RPC:ns svenska felmeddelanden återanvänds (kvot, tak, auth). RLS-avvisad
insert/delete på aktiveringstabellen visas via `setErrorStatus`.

## Verifiering

1. SQL-checklista `verify_valvet_packages.sql`: RLS-negativtest (annan
   användares workspace_id avvisas), aktivera/avaktivera-rundtur,
   `copy_template_to_valvet` som Free (lyckas, räknas mot kvoten — 6:e
   kopian samma månad avvisas), kopia får rätt fält (type/category/content).
2. Browser: aktivera paket, se mallarna, kopiera en mall, se den under
   "Mina insättningar", avaktivera paketet (kopian ska vara kvar).

## Utanför scope

MCP-exponering (delprojekt 4), handkuraterade paket, dedup för
template-kopior, paket ur `content_items`-katalogen, notifiering vid
kataloguppdateringar.
