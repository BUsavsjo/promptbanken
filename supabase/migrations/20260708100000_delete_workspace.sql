-- Låter en arbetsytas ägare radera den permanent (t.ex. att lägga ner en
-- Delad arbetsyta som inte längre används). Personliga arbetsytor kan inte
-- raderas via den här vägen -- de hör ihop med kontot och tas bort via
-- delete-account-flödet istället (annars blir profilen/kontot trasigt).
--
-- Allt under arbetsytan (content_items, profiles, api_keys, org_join_codes,
-- shared_workspace_addons) har redan "on delete cascade" mot
-- workspaces.id i schemat, så en enkel delete här räcker för att städa
-- upp allt -- ingen risk för kvarglömda rader.

create or replace function public.delete_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id  uuid := auth.uid();
    workspace_record public.workspaces%rowtype;
    is_owner         boolean;
begin
    if current_user_id is null then
        raise exception 'Inloggning krävs.';
    end if;

    select * into workspace_record from public.workspaces where id = p_workspace_id;
    if not found then
        raise exception 'Workspace hittades inte.';
    end if;

    if workspace_record.type = 'personal' then
        raise exception 'Personliga arbetsytor kan inte raderas separat. Radera hela kontot under Inställningar om du vill bli av med din personliga yta.';
    end if;

    select app_private.current_user_has_workspace_role(
        p_workspace_id,
        array['workspace_owner']::public.profile_role[]
    ) or app_private.current_user_is_platform_owner()
      into is_owner;

    if not is_owner then
        raise exception 'Bara arbetsytans ägare kan radera den.';
    end if;

    delete from public.workspaces where id = p_workspace_id;
end;
$$;

revoke all on function public.delete_workspace(uuid) from public;
grant execute on function public.delete_workspace(uuid) to authenticated;
