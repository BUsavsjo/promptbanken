-- Förgrena medlemsgränsen: addon-ytor (license_id null + addon-rad) styrs av
-- shared_workspace_addons (Pro-krav + max_members). Org-licensytor (license_id
-- finns) styrs av pro_licenses som tidigare. Personliga ytor: ingen gräns.

create or replace function app_private.enforce_org_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    workspace_record public.workspaces%rowtype;
    license_record   public.pro_licenses%rowtype;
    addon_record     public.shared_workspace_addons%rowtype;
    existing_count   integer;
begin
    select * into workspace_record
      from public.workspaces
     where id = new.workspace_id;

    if workspace_record.type <> 'organization' then
        return new;
    end if;

    -- Delad addon-yta: license_id null OCH en addon-rad finns.
    if workspace_record.license_id is null then
        select * into addon_record
          from public.shared_workspace_addons
         where workspace_id = workspace_record.id;

        if not found then
            -- Org-yta utan licens och utan addon-rad: ovanligt; blockera för säkerhets skull.
            raise exception 'Organisationsytan saknar både licens och addon-konfiguration.';
        end if;

        -- Hård Pro-spärr per medlem.
        if not app_private.has_active_pro_entitlement(new.user_id) then
            raise exception 'Alla medlemmar i en delad arbetsyta måste ha en aktiv Pro-plan.';
        end if;

        select count(*) into existing_count
          from public.profiles p
         where p.workspace_id = workspace_record.id;

        if existing_count >= coalesce(addon_record.max_members, 5) then
            raise exception 'Den delade arbetsytan har nått gränsen på % medlemmar.', addon_record.max_members;
        end if;

        return new;
    end if;

    -- Org-licensyta: befintlig licensgräns, summerad över syskonytor.
    select * into license_record
      from public.pro_licenses
     where id = workspace_record.license_id;

    select count(*) into existing_count
      from public.profiles p
     where p.workspace_id in (select app_private.license_group_workspace_ids(new.workspace_id));

    if existing_count >= coalesce(license_record.max_members_total, 1) then
        raise exception 'Licensen har nått gränsen på % medlemmar totalt.', license_record.max_members_total;
    end if;

    return new;
end;
$$;

revoke all on function app_private.enforce_org_member_limit() from public;
