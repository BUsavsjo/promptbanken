-- Team-MCP-nycklar: vilken nyckel får se vad.
--
-- Modell (bekräftad):
-- - Standardmallar (öppna prompts.json-filer) är redan tillgängliga för
--   alla oavsett nyckel -- ingen databaslogik inblandad.
-- - Pro-premiummallar (get_pro_templates_for_mcp_key) är redan
--   tillgängliga för VILKEN SOM HELST giltig nyckel på ett workspace med
--   Pro/Team/Förvaltning/Kommun-plan -- ingen ändring behövs.
-- - Workspace-delade prompts (visibility='workspace') ska vara
--   tillgängliga för VILKEN SOM HELST giltig nyckel på workspacet.
-- - Workspacets EGNA (privata, ägarens) prompts ska bara vara
--   tillgängliga via den FÖRSTA/primära nyckeln som skapades för
--   workspacet (den nyckel som "hör till" den som skapade workspacet).
--   Om teamet skapar ytterligare nycklar (för delade botar/integrationer
--   som fler använder) ska DE nycklarna bara ge workspace+pro+standard,
--   inte den enskilda ägarens privata prompts -- annars skulle en delad
--   bot-nyckel kunna läcka en kollegas privata anteckningar.
--
-- "Primär nyckel" räknas dynamiskt (första icke-återkallade MCP-nyckeln
-- för workspacet, efter created_at) istället för att lagras som en egen
-- kolumn -- så att om den nyckeln återkallas tar nästa nyckel över rollen
-- automatiskt.

create or replace function app_private.get_workspace_prompts_for_key(
    p_key_hash text
)
returns table(
    id          uuid,
    title       text,
    summary     text,
    content     text,
    visibility  text,
    category    text,
    audience    text,
    status      text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_workspace public.workspaces%rowtype;
    v_is_primary_key boolean := false;
begin
    select w.* into v_workspace
    from public.api_keys k
    join public.workspaces w on w.id = k.workspace_id
    where k.key_hash    = p_key_hash
      and k.revoked_at  is null
      and k.scopes      @> array['mcp']::text[]
      and w.mcp_enabled = true
      and w.status      = 'active'
    limit 1;

    if not found then
        return;
    end if;

    if v_workspace.type = 'personal' then
        if v_workspace.plan = 'free' then
            return query
            select
                ci.id,
                ci.title,
                ci.summary,
                ci.content,
                ci.visibility::text,
                ci.category,
                ci.audience,
                ci.status::text
            from public.content_items ci
            where ci.workspace_id = v_workspace.id
              and ci.type         = 'prompt'
              and ci.visibility   = 'private'
              and ci.status       = 'published';

        else
            return query
            select
                ci.id,
                ci.title,
                ci.summary,
                ci.content,
                ci.visibility::text,
                ci.category,
                ci.audience,
                ci.status::text
            from public.content_items ci
            where ci.workspace_id = v_workspace.id
              and ci.type         = 'prompt'
              and ci.visibility   in ('private', 'workspace')
              and ci.status       = 'published';
        end if;

    else
        -- Är den här nyckeln den första/primära MCP-nyckeln för workspacet?
        select (k.id = (
            select k2.id
              from public.api_keys k2
             where k2.workspace_id = v_workspace.id
               and k2.revoked_at   is null
               and k2.scopes       @> array['mcp']::text[]
             order by k2.created_at asc
             limit 1
        ))
          into v_is_primary_key
          from public.api_keys k
         where k.key_hash = p_key_hash;

        return query
        select
            ci.id,
            ci.title,
            ci.summary,
            ci.content,
            ci.visibility::text,
            ci.category,
            ci.audience,
            ci.status::text
        from public.content_items ci
        where ci.workspace_id = v_workspace.id
          and ci.type         = 'prompt'
          and ci.status       = 'published'
          and (
              ci.visibility = 'workspace'
              or (
                  v_is_primary_key
                  and ci.visibility = 'private'
                  and ci.owner_user_id = v_workspace.owner_user_id
              )
          );
    end if;
end;
$$;

revoke all on function app_private.get_workspace_prompts_for_key(text) from public;
grant execute on function app_private.get_workspace_prompts_for_key(text) to mcp_server;

-- Publik wrapper för den lokala stdio-MCP-servern (samma förtroendemodell
-- som redan gäller för get_pro_templates_for_mcp_key/list_pro_templates:
-- att känna till en giltig, oåterkallad nyckel-hash är i sig beviset på
-- behörighet).
create or replace function public.get_workspace_prompts_for_key(
    p_key_hash text
)
returns table(
    id          uuid,
    title       text,
    summary     text,
    content     text,
    visibility  text,
    category    text,
    audience    text,
    status      text
)
language sql
security definer
set search_path = ''
as $$
    select * from app_private.get_workspace_prompts_for_key(p_key_hash);
$$;

revoke all on function public.get_workspace_prompts_for_key(text) from public;
grant execute on function public.get_workspace_prompts_for_key(text) to anon, authenticated;
