-- Verifiering B — Negativa join-fallen (körbar mot staging efter seed).
-- Testar join-triggern direkt via profil-inserts (de ska faila, inget rensande behövs).
-- Förutsätter: test-delad-savsjo (delad addon-yta, 4 medlemmar), test-free-personal
-- (Free), test-orgb-personal (Pro).

-- B1 — Free-användare nekas (saknar aktiv Pro-rättighet).
insert into public.profiles (user_id, workspace_id, role)
select u.owner_user_id, sw.id, 'editor'
from public.workspaces sw, public.workspaces u
where sw.slug = 'test-delad-savsjo' and u.slug = 'test-free-personal';
-- Förväntat: ERROR 'Alla medlemmar i en delad arbetsyta måste ha en aktiv Pro-plan.'

-- B2 — medlemsgränsen nekas. Savsjö har 4 medlemmar; sänk taket till 4,
--      försök lägga en 5:e Pro-användare (org-b.admin), återställ sedan.
update public.shared_workspace_addons set max_members = 4
where workspace_id = (select id from public.workspaces where slug = 'test-delad-savsjo');

insert into public.profiles (user_id, workspace_id, role)
select u.owner_user_id, sw.id, 'editor'
from public.workspaces sw, public.workspaces u
where sw.slug = 'test-delad-savsjo' and u.slug = 'test-orgb-personal';
-- Förväntat: ERROR 'Den delade arbetsytan har nått gränsen på 4 medlemmar.'

update public.shared_workspace_addons set max_members = 5
where workspace_id = (select id from public.workspaces where slug = 'test-delad-savsjo');
