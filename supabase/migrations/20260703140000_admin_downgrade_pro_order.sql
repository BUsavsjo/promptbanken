-- Adminfaktura-granskning, steg 7: manuell nedgradering av en obetald
-- beställning. Måste vara en atomär RPC eftersom en org-beställning kan
-- ha flera arbetsytor under samma licens som alla behöver nedgraderas
-- tillsammans (annars kan pro_orders.workspace_id bara peka på den
-- första arbetsytan, medan resten av licensen förblir Pro).

create or replace function public.admin_downgrade_pro_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    order_record public.pro_orders%rowtype;
begin
    if not app_private.current_user_is_platform_owner() then
        raise exception 'Endast plattformsadmin kan nedgradera beställningar.';
    end if;

    select * into order_record from public.pro_orders where id = p_order_id;
    if not found then
        raise exception 'Beställningen hittades inte.';
    end if;

    if order_record.license_id is not null then
        update public.workspaces
           set plan        = 'free',
               plan_source  = 'downgraded',
               max_prompts  = 3,
               api_enabled  = false
         where license_id = order_record.license_id;

        update public.pro_licenses
           set status = 'cancelled'
         where id = order_record.license_id;
    elsif order_record.workspace_id is not null then
        update public.workspaces
           set plan        = 'free',
               plan_source  = 'downgraded',
               max_prompts  = 3,
               api_enabled  = false
         where id = order_record.workspace_id;
    end if;

    update public.pro_orders
       set status = 'cancelled'
     where id = p_order_id;
end;
$$;

revoke all on function public.admin_downgrade_pro_order(uuid) from public;
grant execute on function public.admin_downgrade_pro_order(uuid) to authenticated;
