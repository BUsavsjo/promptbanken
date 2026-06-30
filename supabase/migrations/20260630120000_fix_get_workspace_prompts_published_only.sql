-- get_workspace_prompts only excluded status = 'archived', so draft and
-- review prompts (including ones just unpublished back to draft) were
-- still returned to MCP clients. Require status = 'published' instead,
-- matching what the publish/unpublish buttons in the admin UI imply.

create or replace function app_private.get_workspace_prompts(
    p_workspace_id uuid
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
begin
    select * into v_workspace
    from public.workspaces w
    where w.id = p_workspace_id
      and w.status = 'active';

    if not found then
        return;
    end if;

    if v_workspace.type = 'personal' then
        if v_workspace.plan = 'free' then
            -- Free: bara privata prompts
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
            where ci.workspace_id = p_workspace_id
              and ci.type         = 'prompt'
              and ci.visibility   = 'private'
              and ci.status       = 'published';

        else
            -- Pro+: privata och workspace-synliga
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
            where ci.workspace_id = p_workspace_id
              and ci.type         = 'prompt'
              and ci.visibility   in ('private', 'workspace')
              and ci.status       = 'published';
        end if;

    else
        -- Organisation: alla workspace-synliga prompts
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
        where ci.workspace_id = p_workspace_id
          and ci.type         = 'prompt'
          and ci.visibility   = 'workspace'
          and ci.status       = 'published';
    end if;
end;
$$;

revoke all on function app_private.get_workspace_prompts(uuid) from public;
