-- B2: godkännandesteg för Förvaltning/Kommun (plus/enterprise).
--
-- Tidigare aktiverade create_pro_order() FULL kapacitet direkt för alla
-- org-nivåer -- vem som helst med ett konto kunde självbetjäna sig en
-- Kommun-licens (1000 mallar, 250 medlemmar, 10 MCP-nycklar) innan någon
-- granskat beställningen, och kunde upprepa det obegränsat. Det är en
-- oacceptabel risk inför publik release för offentlig sektor.
--
-- Ny modell:
--   pro   (personlig)  -> aktiveras direkt (lågt missbruksvärde)
--   start (Team)       -> aktiveras direkt (självbetjäning, fast pris)
--   plus/enterprise    -> BARA en väntande förfrågan (pending), ingen
--                         licens/arbetsyta skapas. Plattformsadmin
--                         aktiverar via admin_activate_pro_order() efter
--                         att offert/avtal är på plats.
--
-- create_pro_order() får en ny returkolumn `activated` så frontend vet
-- om kontot aktiverades direkt eller om det blev en förfrågan.

-- Signaturen (returkolumnerna) ändras -> måste droppas först.
drop function if exists public.create_pro_order(public.workspace_plan, integer, text, text, text, text, text, text);

create or replace function public.create_pro_order(
    p_requested_plan       public.workspace_plan,
    p_requested_workspaces integer,
    p_billing_company_name text,
    p_billing_org_number   text,
    p_billing_address      text,
    p_billing_reference    text,
    p_billing_email        text,
    p_workspace_name       text default null
)
returns table(
    order_id     uuid,
    license_id   uuid,
    workspace_id uuid,
    activated    boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id  uuid := auth.uid();
    limits           record;
    new_license_id   uuid;
    new_workspace_id uuid;
    new_order_id     uuid;
    candidate_slug   text;
    suffix           integer := 0;
    personal_ws_id   uuid;
    resolved_name    text;
    open_requests    integer;
begin
    if current_user_id is null then
        raise exception 'Inloggning krävs.';
    end if;

    select * into limits from app_private.plan_limits(p_requested_plan);

    -- Personligt Pro: aktivera direkt på anroparens egna personliga workspace.
    if p_requested_plan = 'pro' then
        select p.workspace_id into personal_ws_id
          from public.profiles p
          join public.workspaces w on w.id = p.workspace_id
         where p.user_id = current_user_id
           and w.type = 'personal'
         order by p.created_at
         limit 1;

        if personal_ws_id is null then
            raise exception 'Inget personligt workspace hittades.';
        end if;

        update public.workspaces
           set plan        = 'pro',
               plan_source  = 'invoice',
               max_prompts  = limits.max_prompts,
               api_enabled  = true,
               mcp_enabled  = true
         where id = personal_ws_id;

        insert into public.pro_orders (
            license_id, workspace_id, user_id, requested_plan, requested_workspaces,
            status, billing_company_name, billing_org_number, billing_address,
            billing_reference, billing_email
        ) values (
            null, personal_ws_id, current_user_id, p_requested_plan, 1,
            'pending', p_billing_company_name, p_billing_org_number, p_billing_address,
            p_billing_reference, p_billing_email
        )
        returning id into new_order_id;

        return query select new_order_id, null::uuid, personal_ws_id, true;
        return;
    end if;

    -- Förvaltning/Kommun (plus/enterprise): skapa BARA en väntande
    -- förfrågan. Ingen licens, ingen arbetsyta, ingen rolländring förrän
    -- plattformsadmin godkänner via admin_activate_pro_order().
    if p_requested_plan in ('plus', 'enterprise') then
        -- Begränsa antalet öppna förfrågningar per användare (anti-spam).
        select count(*) into open_requests
          from public.pro_orders
         where user_id = current_user_id
           and license_id is null
           and workspace_id is null
           and status = 'pending';

        if open_requests >= 3 then
            raise exception 'Du har redan flera öppna förfrågningar. Vänta tills vi kontaktat dig innan du skickar fler.';
        end if;

        insert into public.pro_orders (
            license_id, workspace_id, user_id, requested_plan, requested_workspaces,
            status, billing_company_name, billing_org_number, billing_address,
            billing_reference, billing_email, note
        ) values (
            null, null, current_user_id, p_requested_plan,
            least(greatest(coalesce(p_requested_workspaces, 1), 1), limits.max_workspaces),
            'pending', p_billing_company_name, p_billing_org_number, p_billing_address,
            p_billing_reference, p_billing_email,
            nullif(trim(p_workspace_name), '')
        )
        returning id into new_order_id;

        return query select new_order_id, null::uuid, null::uuid, false;
        return;
    end if;

    -- Team (start): självbetjäning -- skapa licens + första arbetsytan direkt.
    resolved_name := coalesce(nullif(trim(p_workspace_name), ''), p_billing_company_name);

    insert into public.pro_licenses (
        plan, owner_user_id, max_workspaces, max_members_total,
        max_prompts_total, max_mcp_keys_total, plan_source
    ) values (
        p_requested_plan, current_user_id,
        least(greatest(coalesce(p_requested_workspaces, 1), 1), limits.max_workspaces),
        limits.max_members, limits.max_prompts, limits.max_mcp_keys, 'invoice'
    )
    returning id into new_license_id;

    candidate_slug := app_private.slugify_candidate(resolved_name, 'workspace');
    while exists (select 1 from public.workspaces where slug = candidate_slug) loop
        suffix := suffix + 1;
        candidate_slug := substr(app_private.slugify_candidate(resolved_name, 'workspace'), 1, 44) || '-' || suffix::text;
    end loop;

    insert into public.workspaces (
        name, slug, type, plan, owner_user_id, license_id,
        max_prompts, api_enabled, mcp_enabled
    ) values (
        coalesce(nullif(resolved_name, ''), 'Arbetsyta'), candidate_slug, 'organization',
        p_requested_plan, current_user_id, new_license_id,
        limits.max_prompts, true, true
    )
    returning id into new_workspace_id;

    insert into public.profiles (user_id, workspace_id, role)
    values (current_user_id, new_workspace_id, 'workspace_owner');

    insert into public.pro_orders (
        license_id, workspace_id, user_id, requested_plan, requested_workspaces,
        status, billing_company_name, billing_org_number, billing_address,
        billing_reference, billing_email
    ) values (
        new_license_id, new_workspace_id, current_user_id, p_requested_plan, p_requested_workspaces,
        'pending', p_billing_company_name, p_billing_org_number, p_billing_address,
        p_billing_reference, p_billing_email
    )
    returning id into new_order_id;

    return query select new_order_id, new_license_id, new_workspace_id, true;
end;
$$;

revoke all on function public.create_pro_order(public.workspace_plan, integer, text, text, text, text, text, text) from public;
grant execute on function public.create_pro_order(public.workspace_plan, integer, text, text, text, text, text, text) to authenticated;

-- ============================================================
-- Aktivera en godkänd Förvaltning/Kommun-förfrågan (plattformsadmin).
-- Skapar licensen + första arbetsytan och gör beställaren till
-- workspace_owner -- samma provisioning som Team-grenen ovan, men
-- utförd först efter manuell granskning/avtal.
-- ============================================================
create or replace function public.admin_activate_pro_order(p_order_id uuid)
returns table(
    license_id   uuid,
    workspace_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    order_record     public.pro_orders%rowtype;
    limits           record;
    new_license_id   uuid;
    new_workspace_id uuid;
    candidate_slug   text;
    suffix           integer := 0;
    resolved_name    text;
begin
    if not app_private.current_user_is_platform_owner() then
        raise exception 'Endast plattformsadmin kan aktivera beställningar.';
    end if;

    select * into order_record from public.pro_orders where id = p_order_id;
    if not found then
        raise exception 'Beställningen hittades inte.';
    end if;

    if order_record.license_id is not null then
        raise exception 'Beställningen är redan aktiverad.';
    end if;

    if order_record.requested_plan not in ('plus', 'enterprise') then
        raise exception 'Bara Förvaltning/Kommun-förfrågningar aktiveras manuellt.';
    end if;

    select * into limits from app_private.plan_limits(order_record.requested_plan);
    resolved_name := coalesce(nullif(trim(order_record.note), ''), order_record.billing_company_name, 'Arbetsyta');

    insert into public.pro_licenses (
        plan, owner_user_id, max_workspaces, max_members_total,
        max_prompts_total, max_mcp_keys_total, plan_source
    ) values (
        order_record.requested_plan, order_record.user_id,
        least(greatest(coalesce(order_record.requested_workspaces, 1), 1), limits.max_workspaces),
        limits.max_members, limits.max_prompts, limits.max_mcp_keys, 'invoice'
    )
    returning id into new_license_id;

    candidate_slug := app_private.slugify_candidate(resolved_name, 'workspace');
    while exists (select 1 from public.workspaces where slug = candidate_slug) loop
        suffix := suffix + 1;
        candidate_slug := substr(app_private.slugify_candidate(resolved_name, 'workspace'), 1, 44) || '-' || suffix::text;
    end loop;

    insert into public.workspaces (
        name, slug, type, plan, owner_user_id, license_id,
        max_prompts, api_enabled, mcp_enabled
    ) values (
        resolved_name, candidate_slug, 'organization',
        order_record.requested_plan, order_record.user_id, new_license_id,
        limits.max_prompts, true, true
    )
    returning id into new_workspace_id;

    insert into public.profiles (user_id, workspace_id, role)
    values (order_record.user_id, new_workspace_id, 'workspace_owner')
    on conflict (user_id, workspace_id) do nothing;

    update public.pro_orders
       set license_id = new_license_id,
           workspace_id = new_workspace_id,
           status = 'invoiced'
     where id = p_order_id;

    return query select new_license_id, new_workspace_id;
end;
$$;

revoke all on function public.admin_activate_pro_order(uuid) from public;
grant execute on function public.admin_activate_pro_order(uuid) to authenticated;
