-- Verifiering A — Hårda MCP-gränsen (körbar mot staging efter seed).
-- Förutsätter seed-testanvändare: test-owner-personal (Pro), test-kommun-platform
-- (enterprise), test-delad-savsjo (delad addon-yta).
-- Förväntat: A2 = 0, A4 = fel om egna nycklar.

-- A1 — skapa en test-nyckel på org.owner:s personliga Pro-yta
--      (verifierar samtidigt att nyckelskapande fungerar på personlig Pro).
insert into public.api_keys (workspace_id, created_by, name, key_prefix, key_hash, scopes)
select w.id, w.owner_user_id, 'boundary-test', 'pb_bnd', 'boundary-test-hash', array['mcp']::text[]
from public.workspaces w
where w.slug = 'test-owner-personal';
-- Förväntat: INSERT 0 1

-- A2 — huvudtestet: personlig Pro-nyckel + enterprise-ytans id MÅSTE ge 0.
select count(*) as should_be_zero
from public.get_workspace_prompts_for_key(
  'boundary-test-hash',
  null,
  (select id from public.workspaces where slug = 'test-kommun-platform')
);
-- Förväntat: 0

-- A3 — kontroll att nyckeln fungerar i sin egen värld (default = privat yta).
select count(*) as private_scope
from public.get_workspace_prompts_for_key('boundary-test-hash');
-- Förväntat: 0 eller fler (ska INTE ge fel)

-- A4 — bonus: addon-ytor får inga egna MCP-nycklar (Task 6).
insert into public.api_keys (workspace_id, created_by, name, key_prefix, key_hash, scopes)
select w.id, w.owner_user_id, 'addon-key-test', 'pb_ad', 'addon-key-test-hash', array['mcp']::text[]
from public.workspaces w where w.slug = 'test-delad-savsjo';
-- Förväntat: ERROR 'Delade arbetsytor har inga egna MCP-nycklar...'

-- A5 — städa.
delete from public.api_keys where key_hash = 'boundary-test-hash';
