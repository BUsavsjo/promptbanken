-- Delade addon-ytor har inga egna MCP-nycklar (nås via medlemmarnas personliga
-- Pro-nycklar). Dessutom sänks Pro-taket för personliga MCP-nycklar 5 -> 3.

create or replace function app_private.enforce_mcp_key_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    workspace_record public.workspaces%rowtype;
    license_record   public.pro_licenses%rowtype;
    existing_count   integer;
    key_limit        integer;
begin
    if not (new.scopes @> array['mcp']::text[]) then
        return new;
    end if;

    select * into workspace_record from public.workspaces where id = new.workspace_id;

    if workspace_record.type = 'personal' then
        key_limit := case when workspace_record.plan = 'pro' then 3 else 1 end;

        select count(*) into existing_count
          from public.api_keys
         where workspace_id = new.workspace_id
           and scopes @> array['mcp']::text[]
           and revoked_at is null;

        if existing_count >= key_limit then
            raise exception 'Personliga konton på %-planen kan ha max % aktiva MCP-nycklar.', workspace_record.plan, key_limit;
        end if;

    elsif workspace_record.type = 'organization' and workspace_record.license_id is null then
        -- Delad addon-yta: inga egna MCP-nycklar. Nås via medlemmarnas
        -- personliga Pro-nycklar.
        raise exception 'Delade arbetsytor har inga egna MCP-nycklar. Använd medlemmarnas personliga Pro-nycklar.';

    elsif workspace_record.type = 'organization' and workspace_record.license_id is not null then
        select * into license_record from public.pro_licenses where id = workspace_record.license_id;

        select count(*) into existing_count
          from public.api_keys k
         where k.workspace_id in (select app_private.license_group_workspace_ids(new.workspace_id))
           and k.scopes @> array['mcp']::text[]
           and k.revoked_at is null;

        key_limit := coalesce(license_record.max_mcp_keys_total, 1);

        if existing_count >= key_limit then
            raise exception 'Licensen har nått gränsen på % MCP-nycklar totalt.', key_limit;
        end if;
    end if;

    return new;
end;
$$;

revoke all on function app_private.enforce_mcp_key_limit() from public;

-- Håll plan_limits konsekvent med enforce_mcp_key_limit: Pro = 3 MCP-nycklar.
create or replace function app_private.plan_limits(p_plan public.workspace_plan)
returns table(max_prompts integer, max_mcp_keys integer, max_members integer, max_workspaces integer)
language sql
immutable
set search_path = ''
as $$
    select
        case p_plan when 'free' then 3 when 'pro' then 100 when 'start' then 200 when 'plus' then 500 when 'enterprise' then 1000 else 3 end,
        case p_plan when 'free' then 1 when 'pro' then 3 when 'start' then 2 when 'plus' then 5 when 'enterprise' then 10 else 1 end,
        case p_plan when 'free' then 1 when 'pro' then 1 when 'start' then 10 when 'plus' then 50 when 'enterprise' then 250 else 1 end,
        case p_plan when 'free' then 1 when 'pro' then 1 when 'start' then 1 when 'plus' then 5 when 'enterprise' then 999999 else 1 end;
$$;
