-- Kontextstyrd hämtning. Behörighet != hämtning. Default = bara privat yta.
-- Hård gräns: personlig nyckel når aldrig plus/enterprise.

-- Droppa den gamla enparametriga varianten så inga anropare når den gamla
-- obegränsade logiken (från 20260704110000_team_mcp_key_scope.sql).
drop function if exists app_private.get_workspace_prompts_for_key(text);
drop function if exists public.get_workspace_prompts_for_key(text);

create or replace function app_private.get_workspace_prompts_for_key(
    p_key_hash     text,
    p_scope        text default null,
    p_workspace_id uuid default null
)
returns table(
    id uuid, title text, summary text, content text,
    visibility text, category text, audience text, status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_key       public.api_keys%rowtype;
    v_key_ws    public.workspaces%rowtype;
    v_target_ws public.workspaces%rowtype;
    v_owner_id  uuid;
    v_is_primary_key boolean := false;
begin
    select k.* into v_key
      from public.api_keys k
     where k.key_hash   = p_key_hash
       and k.revoked_at is null
       and k.scopes     @> array['mcp']::text[]
     limit 1;
    if not found then return; end if;

    select w.* into v_key_ws
      from public.workspaces w
     where w.id = v_key.workspace_id
       and w.mcp_enabled = true
       and w.status = 'active';
    if not found then return; end if;

    -- ===== ORG-NYCKLAR (plus/enterprise): oförändrad världsseparation =====
    if v_key_ws.type = 'organization' and v_key_ws.license_id is not null then
        select (v_key.id = (
            select k2.id from public.api_keys k2
             where k2.workspace_id = v_key_ws.id
               and k2.revoked_at is null
               and k2.scopes @> array['mcp']::text[]
             order by k2.created_at asc limit 1
        )) into v_is_primary_key;

        return query
        select ci.id, ci.title, ci.summary, ci.content, ci.visibility::text,
               ci.category, ci.audience, ci.status::text
          from public.content_items ci
         where ci.workspace_id = v_key_ws.id
           and ci.type = 'prompt'
           and ci.status = 'published'
           and (
               ci.visibility = 'workspace'
               or (v_is_primary_key and ci.visibility = 'private' and ci.owner_user_id = v_key_ws.owner_user_id)
           );
        return;
    end if;

    -- ===== PERSONLIGA NYCKLAR (free/pro) =====
    if v_key_ws.type = 'personal' then
        v_owner_id := v_key_ws.owner_user_id;

        -- Kontext: en specifik delad addon-yta.
        if p_workspace_id is not null then
            select w.* into v_target_ws
              from public.workspaces w
             where w.id = p_workspace_id
               and w.type = 'organization'
               and w.license_id is null
               and w.plan = 'start'
               and w.status = 'active'
               and exists (select 1 from public.shared_workspace_addons a where a.workspace_id = w.id);
            if not found then return; end if;  -- inte en addon-yta -> hård gräns

            if not exists (
                select 1 from public.profiles p
                 where p.workspace_id = v_target_ws.id and p.user_id = v_owner_id
            ) then
                return;  -- inte medlem
            end if;

            return query
            select ci.id, ci.title, ci.summary, ci.content, ci.visibility::text,
                   ci.category, ci.audience, ci.status::text
              from public.content_items ci
             where ci.workspace_id = v_target_ws.id
               and ci.type = 'prompt'
               and ci.status = 'published'
               and ci.visibility = 'workspace';
            return;
        end if;

        -- Default / scope='private': bara användarens egna personliga mallar.
        return query
        select ci.id, ci.title, ci.summary, ci.content, ci.visibility::text,
               ci.category, ci.audience, ci.status::text
          from public.content_items ci
         where ci.workspace_id = v_key_ws.id
           and ci.type = 'prompt'
           and ci.status = 'published'
           and ci.owner_user_id = v_owner_id
           and ci.visibility in ('private', 'workspace');
        return;
    end if;

    -- Fallthrough (t.ex. org-yta utan licens = addon; sådana har inga nycklar): inget.
    return;
end;
$$;

revoke all on function app_private.get_workspace_prompts_for_key(text, text, uuid) from public;
grant execute on function app_private.get_workspace_prompts_for_key(text, text, uuid) to mcp_server;

-- Publik wrapper (samma förtroendemodell som tidigare).
create or replace function public.get_workspace_prompts_for_key(
    p_key_hash text, p_scope text default null, p_workspace_id uuid default null
)
returns table(
    id uuid, title text, summary text, content text,
    visibility text, category text, audience text, status text
)
language sql
security definer
set search_path = ''
as $$
    select * from app_private.get_workspace_prompts_for_key(p_key_hash, p_scope, p_workspace_id);
$$;

revoke all on function public.get_workspace_prompts_for_key(text, text, uuid) from public;
grant execute on function public.get_workspace_prompts_for_key(text, text, uuid) to anon, authenticated;

-- Discovery: vilka delade addon-ytor nyckelägaren är medlem i (metadata).
create or replace function public.list_shared_workspaces_for_key(p_key_hash text)
returns table(workspace_id uuid, name text)
language sql
security definer
set search_path = ''
as $$
    select w.id, w.name
      from public.api_keys k
      join public.workspaces kw on kw.id = k.workspace_id and kw.type = 'personal'
      join public.profiles p on p.user_id = kw.owner_user_id
      join public.workspaces w on w.id = p.workspace_id
      join public.shared_workspace_addons a on a.workspace_id = w.id
     where k.key_hash = p_key_hash
       and k.revoked_at is null
       and k.scopes @> array['mcp']::text[]
       and w.type = 'organization'
       and w.license_id is null
       and w.plan = 'start'
       and w.status = 'active';
$$;

revoke all on function public.list_shared_workspaces_for_key(text) from public;
grant execute on function public.list_shared_workspaces_for_key(text) to anon, authenticated;
