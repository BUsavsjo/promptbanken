-- Sätt <PRO_KEY_HASH> = sha256 av en Pro-användares mcp-nyckel,
-- <ADDON_WS> = en addon-yta där användaren är medlem,
-- <ORG_WS> = en plus/enterprise-yta.
-- 1. Default: bara privata mallar.
select count(*) from public.get_workspace_prompts_for_key('<PRO_KEY_HASH>');
-- 2. scope=private: samma som default.
select count(*) from public.get_workspace_prompts_for_key('<PRO_KEY_HASH>', 'private', null);
-- 3. workspace_id = addon-yta där medlem: delade mallar därifrån.
select count(*) from public.get_workspace_prompts_for_key('<PRO_KEY_HASH>', null, '<ADDON_WS>');
-- 4. HÅRD GRÄNS: workspace_id = plus/enterprise-yta -> 0 rader.
select count(*) from public.get_workspace_prompts_for_key('<PRO_KEY_HASH>', null, '<ORG_WS>');  -- Expected: 0
-- 5. Discovery listar addon-ytan.
select * from public.list_shared_workspaces_for_key('<PRO_KEY_HASH>');
