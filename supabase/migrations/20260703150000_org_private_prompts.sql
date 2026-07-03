-- Bugfix: organisationsmedlemmar (Team/Förvaltning/Kommun) kunde bara
-- skapa workspace-synliga prompts -- enforce_content_access_model()
-- tvingade visibility='workspace' för alla i en organisation, vilket
-- blockerade privata prompts helt. RLS-läspolicyn stödjer redan
-- visibility='private' korrekt för organisationsmedlemmar (bara
-- ägaren ser sin egen privata prompt) -- det var bara triggern som
-- var för sträng. Nu tillåts både 'private' och 'workspace', precis
-- som redan gäller för personliga Pro-workspaces.

create or replace function app_private.enforce_content_access_model()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    workspace_record   public.workspaces%rowtype;
    license_record      public.pro_licenses%rowtype;
    is_platform_owner   boolean;
    prompt_count        integer;
    prompt_limit        integer;
begin
    select * into workspace_record
      from public.workspaces
     where id = new.workspace_id;

    if not found then
        raise exception 'Workspace saknas.';
    end if;

    select app_private.current_user_is_platform_owner()
      into is_platform_owner;

    if new.type <> 'prompt' then
        return new;
    end if;

    if tg_op = 'INSERT' and new.created_by is distinct from auth.uid() then
        raise exception 'Prompts måste skapas av inloggad användare.';
    end if;

    if tg_op = 'INSERT' and new.owner_user_id is null then
        new.owner_user_id := auth.uid();
    end if;

    if new.visibility = 'public' and not is_platform_owner then
        raise exception 'Endast plattformsadmin kan skapa publika prompts.';
    end if;

    if workspace_record.type = 'personal' then
        -- Free: private only. Pro: private eller workspace.
        if workspace_record.plan = 'free' and new.visibility <> 'private' then
            raise exception 'Free-läge tillåter bara privata prompts.';
        end if;

        if workspace_record.plan = 'pro' and new.visibility not in ('private', 'workspace') then
            raise exception 'Pro-läge tillåter privata eller workspace-synliga prompts.';
        end if;

        if tg_op = 'INSERT' and new.owner_user_id is distinct from auth.uid() then
            raise exception 'Privata prompts måste ägas av användaren.';
        end if;

        select count(*)
          into prompt_count
          from public.content_items ci
         where ci.workspace_id = new.workspace_id
           and ci.type = 'prompt'
           and ci.owner_user_id = auth.uid()
           and ci.status <> 'archived'
           and (tg_op = 'INSERT' or ci.id <> new.id);

        if prompt_count >= workspace_record.max_prompts then
            raise exception 'Du har nått gränsen på % prompts för %-planen.', workspace_record.max_prompts, workspace_record.plan;
        end if;

    elsif workspace_record.type = 'organization' and not is_platform_owner then
        -- Team/Förvaltning/Kommun: medlemmar kan spara privata prompts
        -- (bara de själva ser dem) eller dela dem med hela teamet.
        if new.visibility not in ('private', 'workspace') then
            raise exception 'Organisationsmedlemmar kan skapa privata eller team-synliga prompts.';
        end if;

        if new.visibility = 'private' and tg_op = 'INSERT' and new.owner_user_id is distinct from auth.uid() then
            raise exception 'Privata prompts måste ägas av användaren.';
        end if;

        -- Mallgräns summerad över alla arbetsytor under samma licens
        -- (gäller alla mallar i licensen oavsett synlighet).
        if workspace_record.license_id is not null then
            select * into license_record
              from public.pro_licenses
             where id = workspace_record.license_id;

            select count(*)
              into prompt_count
              from public.content_items ci
             where ci.workspace_id in (select app_private.license_group_workspace_ids(new.workspace_id))
               and ci.type = 'prompt'
               and ci.status <> 'archived'
               and (tg_op = 'INSERT' or ci.id <> new.id);

            prompt_limit := coalesce(license_record.max_prompts_total, workspace_record.max_prompts);

            if prompt_count >= prompt_limit then
                raise exception 'Licensen har nått gränsen på % mallar totalt.', prompt_limit;
            end if;
        end if;
    end if;

    return new;
end;
$$;

revoke all on function app_private.enforce_content_access_model() from public;
