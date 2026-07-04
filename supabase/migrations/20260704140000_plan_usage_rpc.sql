-- Adminsidan visade fel gränser för Team/Förvaltning/Kommun-konton:
-- mcpKeyLimit() i frontend hårdkodade bara free/pro (1 eller 5), och
-- "Mina prompts"-räknaren visade workspace.max_prompts (en kolumn per
-- arbetsyta) mot bara den inloggade användarens EGNA prompts -- medan
-- den verkliga, serverkontrollerade gränsen för organisationer är
-- licensens totalsumma över ALLA arbetsytor och ALLA medlemmar
-- (se enforce_content_access_model/enforce_mcp_key_limit/
-- enforce_org_member_limit). Den här funktionen exponerar samma
-- gränser+användning som triggrarna faktiskt räknar på, så UI kan visa
-- rätt siffror istället för att gissa.

create or replace function public.get_plan_usage(p_workspace_id uuid)
returns table(
    has_license      boolean,
    max_prompts      integer,
    max_mcp_keys     integer,
    max_members      integer,
    max_workspaces   integer,
    used_prompts     integer,
    used_mcp_keys    integer,
    used_members     integer,
    used_workspaces  integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_workspace public.workspaces%rowtype;
    v_license   public.pro_licenses%rowtype;
    v_ids       uuid[];
begin
    select * into v_workspace from public.workspaces where id = p_workspace_id;
    if not found then
        raise exception 'Workspace saknas.';
    end if;

    if not exists (
        select 1 from public.profiles
         where user_id = (select auth.uid()) and workspace_id = p_workspace_id
    ) and not app_private.current_user_is_platform_owner() then
        raise exception 'Åtkomst nekad.';
    end if;

    if v_workspace.type <> 'organization' or v_workspace.license_id is null then
        return query
        select
            false,
            v_workspace.max_prompts,
            (case when v_workspace.plan = 'pro' then 5 else 1 end),
            1,
            1,
            (select count(*)::int from public.content_items
              where workspace_id = p_workspace_id and type = 'prompt' and owner_user_id = (select auth.uid()) and status <> 'archived'),
            (select count(*)::int from public.api_keys
              where workspace_id = p_workspace_id and scopes @> array['mcp']::text[] and revoked_at is null),
            1,
            1;
        return;
    end if;

    select * into v_license from public.pro_licenses where id = v_workspace.license_id;
    select array_agg(id) into v_ids from public.workspaces w where w.id in (select app_private.license_group_workspace_ids(p_workspace_id));

    return query
    select
        true,
        v_license.max_prompts_total,
        v_license.max_mcp_keys_total,
        v_license.max_members_total,
        v_license.max_workspaces,
        (select count(*)::int from public.content_items
          where workspace_id = any(v_ids) and type = 'prompt' and status <> 'archived'),
        (select count(*)::int from public.api_keys
          where workspace_id = any(v_ids) and scopes @> array['mcp']::text[] and revoked_at is null),
        (select count(*)::int from public.profiles where workspace_id = any(v_ids)),
        (select count(*)::int from public.workspaces where id = any(v_ids));
end;
$$;

revoke all on function public.get_plan_usage(uuid) from public;
grant execute on function public.get_plan_usage(uuid) to authenticated;
