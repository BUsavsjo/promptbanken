import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadLocalEnvFile() {
  const envPath = resolve(process.cwd(), '.env.seed.local');
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const defaultPassword = process.env.TEST_USER_PASSWORD || 'Promptbanken-Test-2026!';

function describeKey(value) {
  if (!value) {
    return 'saknas';
  }

  if (value.includes('din-service-role-key') || value.includes('KListra-in')) {
    return 'placeholder';
  }

  if (value.startsWith('sb_publishable_')) {
    return 'publishable key';
  }

  if (value.startsWith('sb_secret_')) {
    return `secret key (${value.slice(0, 12)}...)`;
  }

  const jwtParts = value.split('.');
  if (jwtParts.length === 3) {
    return `JWT/service_role-liknande (${value.slice(0, 8)}...)`;
  }

  return `okänd typ (${value.slice(0, 8)}...)`;
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Saknar SUPABASE_URL/VITE_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Skapa gärna .env.seed.local med SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Exempel: $env:SUPABASE_SERVICE_ROLE_KEY="..."; npm run seed:test-users');
  process.exit(1);
}

if (serviceRoleKey.includes('din-service-role-key') || serviceRoleKey.includes('KListra-in')) {
  console.error('SUPABASE_SERVICE_ROLE_KEY är fortfarande en platshållare.');
  process.exit(1);
}

if (serviceRoleKey.startsWith('sb_publishable_')) {
  console.error('SUPABASE_SERVICE_ROLE_KEY är en publishable key. Auth-admin kräver service role/secret key.');
  process.exit(1);
}

console.log(`Supabase URL: ${supabaseUrl}`);
console.log(`Nyckeltyp: ${describeKey(serviceRoleKey)}`);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ---------------------------------------------------------------------------
// Testdata enligt addon-modellen (2026-07-06):
//   Personlig värld: Free / Pro / Pro + Delad arbetsyta.
//   Organisationsvärld: Förvaltning (plus) / Kommun (enterprise).
// En Delad arbetsyta (plan='start', license_id=null) kräver att ALLA medlemmar
// har en aktiv personlig Pro-yta (join-triggern enforce_org_member_limit).
// Därför får varje medlem i en delad yta en egen personlig Pro-yta först.
// ---------------------------------------------------------------------------

// Personliga ytor. plan='pro' ger Pro-rättighet (krävs för delad-yta-medlemskap).
const personalUsers = [
  { email: 'free.user@test.se', slug: 'test-free-personal', name: 'Test Free (privat)', plan: 'free' },
  { email: 'org.owner@test.se', slug: 'test-owner-personal', name: 'Test Owner (privat Pro)', plan: 'pro' },
  { email: 'org.admin@test.se', slug: 'test-admin-personal', name: 'Test Admin (privat Pro)', plan: 'pro' },
  { email: 'org.editor@test.se', slug: 'test-editor-personal', name: 'Test Editor (privat Pro)', plan: 'pro' },
  { email: 'org.viewer@test.se', slug: 'test-viewer-personal', name: 'Test Viewer (privat Pro)', plan: 'pro' },
  { email: 'org-b.admin@test.se', slug: 'test-orgb-personal', name: 'Test Org B (privat Pro)', plan: 'pro' },
  { email: 'platform.admin@test.se', slug: 'test-platform-personal', name: 'Test Platform Admin', plan: 'free' }
];

// Delade addon-ytor (Pro + Delad arbetsyta). Alla medlemmar måste ha Pro.
const sharedWorkspaces = [
  {
    slug: 'test-delad-savsjo',
    name: 'Test Delad arbetsyta (Sävsjö)',
    ownerEmail: 'org.owner@test.se',
    members: [
      { email: 'org.owner@test.se', role: 'workspace_owner' },
      { email: 'org.admin@test.se', role: 'workspace_admin' },
      { email: 'org.editor@test.se', role: 'editor' },
      { email: 'org.viewer@test.se', role: 'viewer' }
    ]
  },
  {
    slug: 'test-delad-b',
    name: 'Test Delad arbetsyta B',
    ownerEmail: 'org-b.admin@test.se',
    members: [
      { email: 'org-b.admin@test.se', role: 'workspace_owner' }
    ]
  }
];

// Licensierade org-ytor (Förvaltning/Kommun). Medlemmar behöver INTE Pro.
const planLicenseLimits = {
  plus: { max_workspaces: 5, max_members_total: 50, max_prompts_total: 500, max_mcp_keys_total: 5 },
  enterprise: { max_workspaces: 999999, max_members_total: 250, max_prompts_total: 1000, max_mcp_keys_total: 10 }
};

const licensedWorkspaces = [
  {
    slug: 'test-kommun-platform',
    name: 'Test Kommun (plattform)',
    plan: 'enterprise',
    ownerEmail: 'platform.admin@test.se',
    members: [
      { email: 'platform.admin@test.se', role: 'platform_owner' }
    ]
  }
];

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) {
      return user;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function upsertAuthUser(email) {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: defaultPassword,
      email_confirm: true
    });
    if (error) {
      throw error;
    }
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: defaultPassword,
    email_confirm: true
  });
  if (error) {
    throw error;
  }
  return data.user;
}

async function upsertProfile(userId, workspaceId, role) {
  const { data: existing, error: findError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', existing.id);
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .insert({ user_id: userId, workspace_id: workspaceId, role });

  if (error) {
    throw error;
  }
}

async function ensurePersonalWorkspace(user, cfg) {
  const { data: existing, error: findError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_user_id', user.id)
    .eq('type', 'personal')
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  let workspaceId;
  if (existing) {
    const { error } = await supabase
      .from('workspaces')
      .update({ name: cfg.name, plan: cfg.plan, status: 'active', mcp_enabled: true })
      .eq('id', existing.id);
    if (error) {
      throw error;
    }
    workspaceId = existing.id;
  } else {
    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        name: cfg.name,
        slug: cfg.slug,
        type: 'personal',
        plan: cfg.plan,
        owner_user_id: user.id,
        mcp_enabled: true
      })
      .select('id')
      .single();
    if (error) {
      throw error;
    }
    workspaceId = data.id;
  }

  await upsertProfile(user.id, workspaceId, 'workspace_owner');
  return workspaceId;
}

async function ensureSharedAddonWorkspace(cfg, ownerUser) {
  const { data: existing, error: findError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', cfg.slug)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  let workspaceId;
  if (existing) {
    const { error } = await supabase
      .from('workspaces')
      .update({
        name: cfg.name,
        type: 'organization',
        plan: 'start',
        license_id: null,
        owner_user_id: ownerUser.id,
        mcp_enabled: true
      })
      .eq('id', existing.id);
    if (error) {
      throw error;
    }
    workspaceId = existing.id;
  } else {
    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        name: cfg.name,
        slug: cfg.slug,
        type: 'organization',
        plan: 'start',
        license_id: null,
        owner_user_id: ownerUser.id,
        mcp_enabled: true
      })
      .select('id')
      .single();
    if (error) {
      throw error;
    }
    workspaceId = data.id;
  }

  const { data: addon, error: addonFindError } = await supabase
    .from('shared_workspace_addons')
    .select('id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (addonFindError) {
    throw addonFindError;
  }

  if (!addon) {
    const { error } = await supabase
      .from('shared_workspace_addons')
      .insert({
        workspace_id: workspaceId,
        owner_user_id: ownerUser.id,
        billing_owner_user_id: ownerUser.id,
        max_members: 5,
        max_prompts: 200,
        price_per_month: 199,
        plan_source: 'invoice'
      });
    if (error) {
      throw error;
    }
  }

  return workspaceId;
}

async function ensureLicensedWorkspace(cfg, ownerUser) {
  const limits = planLicenseLimits[cfg.plan];
  if (!limits) {
    throw new Error(`Okänd licensplan: ${cfg.plan}`);
  }

  const { data: existing, error: findError } = await supabase
    .from('workspaces')
    .select('id, license_id')
    .eq('slug', cfg.slug)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  async function createLicense() {
    const { data, error } = await supabase
      .from('pro_licenses')
      .insert({
        plan: cfg.plan,
        owner_user_id: ownerUser.id,
        max_workspaces: limits.max_workspaces,
        max_members_total: limits.max_members_total,
        max_prompts_total: limits.max_prompts_total,
        max_mcp_keys_total: limits.max_mcp_keys_total,
        plan_source: 'invoice'
      })
      .select('id')
      .single();
    if (error) {
      throw error;
    }
    return data.id;
  }

  if (existing) {
    const licenseId = existing.license_id || (await createLicense());
    const { error } = await supabase
      .from('workspaces')
      .update({
        name: cfg.name,
        type: 'organization',
        plan: cfg.plan,
        license_id: licenseId,
        owner_user_id: ownerUser.id,
        mcp_enabled: true
      })
      .eq('id', existing.id);
    if (error) {
      throw error;
    }
    return existing.id;
  }

  const licenseId = await createLicense();
  const { data, error } = await supabase
    .from('workspaces')
    .insert({
      name: cfg.name,
      slug: cfg.slug,
      type: 'organization',
      plan: cfg.plan,
      license_id: licenseId,
      owner_user_id: ownerUser.id,
      mcp_enabled: true
    })
    .select('id')
    .single();
  if (error) {
    throw error;
  }
  return data.id;
}

const authUsers = new Map();

for (const cfg of personalUsers) {
  try {
    const user = await upsertAuthUser(cfg.email);
    authUsers.set(cfg.email, user);
  } catch (error) {
    if (error?.status === 401) {
      console.error('');
      console.error('Supabase nekade nyckeln med 401 Invalid API key.');
      console.error('Kontrollera att .env.seed.local innehåller en giltig, inte roterad, service role/secret key för exakt projektet ovan.');
      console.error('Kopiera inte VITE_SUPABASE_PUBLISHABLE_KEY hit.');
    }
    throw error;
  }
}

// 1. Personliga ytor (ger Pro-rättighet där plan='pro').
for (const cfg of personalUsers) {
  const user = authUsers.get(cfg.email);
  await ensurePersonalWorkspace(user, cfg);
  console.log(`${cfg.email} -> personlig ${cfg.plan}`);
}

// 2. Delade addon-ytor (alla medlemmar har nu Pro).
for (const cfg of sharedWorkspaces) {
  const owner = authUsers.get(cfg.ownerEmail);
  const workspaceId = await ensureSharedAddonWorkspace(cfg, owner);
  for (const member of cfg.members) {
    const user = authUsers.get(member.email);
    await upsertProfile(user.id, workspaceId, member.role);
  }
  console.log(`Delad arbetsyta ${cfg.slug} -> ${cfg.members.length} medlem(mar)`);
}

// 3. Licensierade org-ytor (Förvaltning/Kommun).
for (const cfg of licensedWorkspaces) {
  const owner = authUsers.get(cfg.ownerEmail);
  const workspaceId = await ensureLicensedWorkspace(cfg, owner);
  for (const member of cfg.members) {
    const user = authUsers.get(member.email);
    await upsertProfile(user.id, workspaceId, member.role);
  }
  console.log(`Licensyta ${cfg.slug} (${cfg.plan}) -> ${cfg.members.length} medlem(mar)`);
}

console.log('');
console.log(`Klart. Lösenord för alla testanvändare: ${defaultPassword}`);
