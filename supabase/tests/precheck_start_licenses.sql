-- Säker förkontroll före addon-migrationen (Task 0).
-- Kör mot staging OCH prod innan någon addon-migration appliceras.
-- Förväntat resultat: 0 rader från båda queries. Rader = oväntad
-- start-org-licensdata som måste hanteras medvetet först -> STOPP.

-- 1. Org-licenser på den gamla start-nivån.
select 'pro_licenses.start' as source, id, owner_user_id, created_at
  from public.pro_licenses
 where plan = 'start';

-- 2. Workspaces som är start OCH kopplade till en licens (gammal org-modell).
select 'workspace.start+license' as source, id, name, owner_user_id, license_id
  from public.workspaces
 where plan = 'start'
   and license_id is not null;
