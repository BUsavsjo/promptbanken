-- Fas 2: exponera premium-mallarna för Promptbanken Pro via MCP.
--
-- list_pro_templates() (från 20260702160000_pro_prompt_templates.sql) littar
-- på auth.uid() och passar admin-UI:t/inloggade webbsessioner. Den lokala
-- MCP-servern (mcp-server/, stdio, körs på användarens egen dator) har
-- ingen Supabase-inloggning -- den känner bara till användarens råa
-- MCP-nyckel. Den här funktionen speglar samma teaser/unlocked-logik men
-- tar emot nyckelns hash istället för att läsa auth.uid().
--
-- Säkerhetsmodell: precis som verify_mcp_key/get_workspace_prompts_for_key
-- avslöjar denna funktion bara data om anroparen känner till en giltig,
-- oåterkallad MCP-nyckel -- att känna till key_hash är i sig beviset på
-- behörighet, så den kan beviljas till anon (samma säkerhetsnivå som en
-- vanlig publik "verifiera token"-endpoint).

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
language plpgsql
security definer
set search_path = ''
as $$
declare
    has_pro boolean := false;
begin
    select exists (
        select 1
          from public.api_keys k
          join public.workspaces w on w.id = k.workspace_id
         where k.key_hash    = p_key_hash
           and k.revoked_at  is null
           and k.scopes      @> array['mcp']::text[]
           and w.mcp_enabled = true
           and w.status      = 'active'
           and w.type        = 'personal'
           and w.plan        = 'pro'
           and (w.plan_expires_at is null or w.plan_expires_at > now())
    ) into has_pro;

    -- Okänd/återkallad nyckel: samma teaser som en utloggad besökare får,
    -- så MCP-verktyget alltid ger ett svar istället för ett auth-fel.
    return query
    select
        t.id,
        t.area,
        t.area_label,
        t.title,
        t.syfte,
        t.output_format,
        case when has_pro then t.prompt_text else null end,
        t.tags,
        t.risk_level,
        t.security_examples,
        t.sort_order,
        has_pro
    from public.pro_prompt_templates t
    order by t.sort_order;
end;
$$;

revoke all on function public.get_pro_templates_for_mcp_key(text) from public;
grant execute on function public.get_pro_templates_for_mcp_key(text) to anon, authenticated;
