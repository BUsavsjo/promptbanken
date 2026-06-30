-- Admins (workspace_owner/workspace_admin) and platform_owner can also
-- delete published prompts, not just draft/review ones. Owners still can't
-- delete published prompts directly -- they must be unpublished first via
-- the existing content_items_admins_update_published policy.

drop policy if exists "content_items_admins_delete_published" on public.content_items;
create policy "content_items_admins_delete_published"
on public.content_items
for delete
to authenticated
using (
    status = 'published'
    and (
        (select app_private.current_user_is_platform_owner())
        or (select app_private.current_user_has_workspace_role(
            workspace_id,
            array['workspace_owner', 'workspace_admin']::public.profile_role[]
        ))
    )
);
