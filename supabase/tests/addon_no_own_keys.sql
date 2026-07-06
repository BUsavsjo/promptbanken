-- 1. Försök skapa en mcp-scopad nyckel på en addon-yta -> ska faila:
--    'Delade arbetsytor har inga egna MCP-nycklar...'
--    (test: insert into public.api_keys(workspace_id, created_by, name, key_prefix,
--     key_hash, scopes) values ('<addon-yta>', auth.uid(), 't', 'pb_x', 'h', array['mcp']);)
-- 2. Pro-personlig yta: 3 mcp-nycklar OK, den 4:e ska faila.
select max_mcp_keys from app_private.plan_limits('pro');  -- Expected: 3
