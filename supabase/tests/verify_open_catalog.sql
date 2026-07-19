-- verify_open_catalog.sql -- manuell checklista mot live (ingen staging finns).
-- Delprojekt 6: öppen katalog. Spec:
-- docs/superpowers/specs/2026-07-19-oppen-katalog-design.md
--
-- FÖRE migrationen (läge 2026-07-19): 3 rader visibility='workspace' i
-- katalogen, published_public_content = 0 rader, list_pro_templates() som
-- anon ger is_unlocked=false och prompt_text=null.

-- 1. Räkning före/efter:
select visibility, count(*) from public.content_items
 where module='kommun' group by visibility;
-- Efter: inga 'workspace'-rader; 'private'-antalet OFÖRÄNDRAT (12).

select count(*) from public.published_public_content;    -- Efter: 2
select count(*) from public.published_workspace_content; -- Efter: 2 (alias, samma mängd)

-- 2. Premiummallar öppna för alla (kör som anon/utloggad):
select count(*) filter (where is_unlocked) as unlocked,
       count(*) filter (where prompt_text is not null) as with_text,
       count(*) as total
  from public.list_pro_templates();
-- Förväntat efter: 42 / 42 / 42.

-- 3. Nyckel-RPC:n öppen även för ogiltig nyckel:
select count(*) filter (where is_unlocked) as unlocked, count(*) as total
  from public.get_pro_templates_for_mcp_key('finns-inte');
-- Förväntat efter: 42 / 42.

-- 4. Som Free-inloggad användare (REST/SQL-editor-impersonation, samma
--    metod som rls_test_plan.sql): kopiera en f.d. workspace-post -- ska
--    LYCKAS (gav tidigare 'Den här posten finns inte eller kräver Pro.'):
-- select * from public.copy_catalog_item_to_valvet('<fd-workspace-item-id>');
--    Kvoten ska fortfarande gälla: efter 5 kopior samma kalendermånad ska
--    Free få 'Månadskvoten på 5 kopior är förbrukad...'.
