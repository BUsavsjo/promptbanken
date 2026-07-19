-- 20260719100000_open_catalog.sql
-- Delprojekt 6: katalog-Pro avvecklas. Allt kataloginnehåll (42 premium-
-- mallar + content_items-katalogen) blir öppet för alla. Pro behålls för
-- Valvet -- inga Valvet-gränser ändras. Alias-strategi: inga namn, vyer
-- eller kolumner tas bort (published_workspace_content, list_pro_templates
-- och is_unlocked behålls men returnerar nu den öppna mängden).
-- Spec: docs/superpowers/specs/2026-07-19-oppen-katalog-design.md

-- 1. Flippa katalogens workspace-rader till public (private = användares
-- egna utkast och rörs inte). enforce_content_access_model tillåter bara
-- plattformsadmin att göra prompts publika -- därför körs UPDATE:n med
-- plattformsägarens auth-kontext via set_config (samma mönster som
-- copy_catalog_item_to_valvet redan använder). Ingen trigger stängs av;
-- skyddet gäller oförändrat. Om ingen platform_owner finns (t.ex. tom
-- databas) hoppar blocket över flippen -- hängslen-villkoret i
-- copy-RPC:n (punkt 4) täcker kvarvarande workspace-rader.
do $$
declare
    v_owner uuid;
begin
    select user_id into v_owner
      from public.profiles
     where role = 'platform_owner'
     order by created_at
     limit 1;

    if v_owner is not null then
        perform set_config('request.jwt.claim.sub', v_owner::text, true);

        update public.content_items
           set visibility = 'public'
         where module = 'kommun' and visibility = 'workspace';
    end if;
end;
$$;

-- 2. list_pro_templates(): alltid upplåst, även utloggad.
create or replace function public.list_pro_templates()
returns table(
    id                uuid,
    area              text,
    area_label        text,
    title             text,
    syfte             text,
    output_format     text,
    prompt_text       text,
    tags              text[],
    risk_level        public.content_risk_level,
    security_examples text[],
    sort_order        integer,
    is_unlocked       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
    select t.id, t.area, t.area_label, t.title, t.syfte, t.output_format,
           t.prompt_text, t.tags, t.risk_level, t.security_examples,
           t.sort_order, true
      from public.pro_prompt_templates t
     order by t.sort_order;
$$;

revoke all on function public.list_pro_templates() from public;
grant execute on function public.list_pro_templates() to anon, authenticated;

-- 3. get_pro_templates_for_mcp_key(): samma -- nyckeln behöver inte längre
-- verifieras, men signaturen behålls som alias för befintliga MCP-klienter.
create or replace function public.get_pro_templates_for_mcp_key(p_key_hash text)
returns table(
    id                uuid,
    area              text,
    area_label        text,
    title             text,
    syfte             text,
    output_format     text,
    prompt_text       text,
    tags              text[],
    risk_level        public.content_risk_level,
    security_examples text[],
    sort_order        integer,
    is_unlocked       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
    select t.id, t.area, t.area_label, t.title, t.syfte, t.output_format,
           t.prompt_text, t.tags, t.risk_level, t.security_examples,
           t.sort_order, true
      from public.pro_prompt_templates t
     order by t.sort_order;
$$;

revoke all on function public.get_pro_templates_for_mcp_key(text) from public;
grant execute on function public.get_pro_templates_for_mcp_key(text) to anon, authenticated;

-- 4. copy_catalog_item_to_valvet: öppna synlighetsvillkoret. Definitionen
-- är verbatim från 20260718100000_copy_catalog_item_to_valvet.sql med två
-- ändringar: källrads-SELECT:ens villkor (visibility in ('public','workspace'))
-- och felmeddelandet (Pro-frasen borttagen). v_is_pro och kvotgrenen
-- BEHÅLLS -- kvoten är Valvets affärsgräns.
create or replace function app_private.copy_catalog_item_to_valvet(
    p_source_item_id uuid
)
returns public.content_items
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_ws              public.workspaces%rowtype;
    v_source          public.content_items%rowtype;
    v_existing        public.content_items%rowtype;
    v_row             public.content_items%rowtype;
    v_copy_count      integer;
    v_mapped_type     public.content_item_type;
    v_slug            text;
    v_is_pro          boolean;
    v_constraint_name text;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    -- 1. Anroparens personliga arbetsyta (samma join-mönster som
    -- ensure_personal_workspace()) -- inte bara lita på auth.uid() blint.
    select w.* into v_ws
      from public.workspaces w
      join public.profiles p on p.workspace_id = w.id
     where p.user_id = auth.uid()
       and w.type = 'personal'
       and w.status = 'active'
     order by p.created_at
     limit 1;

    if not found then
        raise exception 'Inget personligt workspace hittades.';
    end if;

    -- Pro-entitlement behövs fortfarande för kvotgrenen nedan.
    v_is_pro := app_private.has_active_pro_entitlement(v_ws.owner_user_id);

    -- 2. Källrad: hela katalogen är öppen (delprojekt 6). 'workspace'
    -- accepteras som hängslen ifall en rad missats av datamigreringen ovan.
    select * into v_source
      from public.content_items
     where id = p_source_item_id
       and module = 'kommun'
       and status = 'published'
       and visibility in ('public', 'workspace');

    if not found then
        raise exception 'Den här posten finns inte.';
    end if;

    -- 3. Dubblettkontroll: samma källa redan kopierad och inte arkiverad ->
    -- returnera den befintliga i stället för att skapa en ny.
    select * into v_existing
      from public.content_items
     where workspace_id = v_ws.id
       and module = 'valvet'
       and source_content_item_id = p_source_item_id
       and status <> 'archived';

    if found then
        return v_existing;
    end if;

    -- 4. Kvot: bara non-pro räknas. Query dedicated log table, not content_items.
    if not v_is_pro then
        select count(*) into v_copy_count
          from app_private.valvet_catalog_copies
         where workspace_id = v_ws.id
           and created_at >= date_trunc('month', now());

        if v_copy_count >= 5 then
            raise exception 'Månadskvoten på 5 kopior är förbrukad. Uppgradera till Pro för obegränsad kopiering.';
        end if;
    end if;

    -- 5. Typmappning: katalogen behåller sina egna typer, bara Valv-kopian
    -- förenklas till Valvets tvåtypersmodell.
    v_mapped_type := case when v_source.type = 'assistant'
                          then 'assistant'::public.content_item_type
                          else 'prompt'::public.content_item_type end;

    -- 6. Slug, samma kollisionsloop som save_my_item_for_key.
    v_slug := app_private.slugify_candidate(v_source.title, 'valv');
    while exists (select 1 from public.content_items where workspace_id = v_ws.id and slug = v_slug) loop
        v_slug := app_private.slugify_candidate(v_source.title, 'valv') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    end loop;

    perform set_config('request.jwt.claim.sub', v_ws.owner_user_id::text, true);

    -- 7. Insert: bara title/content/category/typ kopieras -- summary/audience
    -- finns på källraden men Valvets UI visar dem aldrig. Race-safe via
    -- unique index on (workspace_id, source_content_item_id) where active.
    -- The slug collision loop before insert is non-atomic; if two concurrent
    -- calls hit the same slug, only the dedup index (our new constraint) is
    -- meant to be caught; slug collisions are re-raised.
    begin
        insert into public.content_items (
            workspace_id, owner_user_id, created_by, type, module, title, slug,
            content, category, status, visibility, source, source_content_item_id
        ) values (
            v_ws.id, v_ws.owner_user_id, v_ws.owner_user_id, v_mapped_type, 'valvet',
            v_source.title, v_slug, v_source.content, v_source.category,
            'draft', 'private', 'catalog_copy', p_source_item_id
        )
        returning * into v_row;

        -- Log the copy only if a new row was actually created (not in the
        -- exception handler below, which only handles dedup index collisions).
        insert into app_private.valvet_catalog_copies (workspace_id, source_content_item_id)
        values (v_ws.id, p_source_item_id);

    exception when unique_violation then
        -- Determine which constraint fired. Only handle the dedup index case;
        -- re-raise slug collisions and any other unique violations.
        get stacked diagnostics v_constraint_name = constraint_name;
        if v_constraint_name = 'content_items_valvet_active_copy_per_source_idx' then
            -- Another concurrent call already inserted the copy for this source.
            -- Re-select and return it.
            select * into v_row
              from public.content_items
             where workspace_id = v_ws.id
               and module = 'valvet'
               and source_content_item_id = p_source_item_id
               and status <> 'archived';

            if not found then
                raise exception 'Kunde inte hitta den befintliga kopian efter en samtidig skrivning — försök igen.';
            end if;
        else
            -- Slug collision or other unique violation; re-raise as-is.
            raise;
        end if;
    end;

    return v_row;
end;
$$;

revoke all on function app_private.copy_catalog_item_to_valvet(uuid) from public;
