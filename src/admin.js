import { requireSession, requireSupabaseConfig } from './auth.js';
import { supabase } from './supabaseClient.js';

const roleLabels = {
  viewer: 'Läsa organisationens publicerade bibliotek.',
  editor: 'Skapa och redigera utkast i den egna workspacen.',
  workspace_admin: 'Publicera innehåll och administrera workspace-funktioner.',
  workspace_owner: 'Äga workspace-inställningar och publiceringsflöden.',
  platform_owner: 'Plattformsägare med full överblick.'
};

const state = {
  user: null,
  profile: null,
  workspace: null,
  prompts: [],
  members: [],
  apiKeys: []
};

const statusElement = document.querySelector('[data-admin-status]');
const dashboardElement = document.querySelector('[data-admin-dashboard]');
const noProfileElement = document.querySelector('[data-no-profile]');
const logoutButton = document.querySelector('[data-logout]');
const promptForm = document.querySelector('[data-prompt-form]');
const apiKeyForm = document.querySelector('[data-api-key-form]');
const refreshButtons = document.querySelectorAll('[data-refresh]');

function isAdminRole(role) {
  return ['workspace_admin', 'workspace_owner', 'platform_owner'].includes(role);
}

function canEdit(role) {
  return ['editor', 'workspace_admin', 'workspace_owner', 'platform_owner'].includes(role);
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle('is-error', isError);
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value || '-';
  }
}

function emptyRow(colspan, text) {
  return `<tr><td colspan="${colspan}">${text}</td></tr>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function renderRoleMode(role) {
  const modeElements = document.querySelectorAll('[data-role-mode]');
  modeElements.forEach((element) => {
    element.hidden = element.dataset.roleMode !== role;
  });

  setText('[data-role-summary]', roleLabels[role] || 'Roll utan särskilt dashboardläge.');
}

function renderCapabilityState() {
  document.querySelectorAll('[data-can-edit]').forEach((element) => {
    element.hidden = !canEdit(state.profile.role);
  });
  document.querySelectorAll('[data-admin-only]').forEach((element) => {
    element.hidden = !isAdminRole(state.profile.role);
  });
}

function renderPrompts() {
  const mineBody = document.querySelector('[data-my-prompts]');
  const libraryBody = document.querySelector('[data-library-prompts]');
  const ownPrompts = state.prompts.filter((item) => item.owner_user_id === state.user.id || item.created_by === state.user.id);
  const publishedPrompts = state.prompts.filter((item) => item.status === 'published');

  mineBody.innerHTML = ownPrompts.length
    ? ownPrompts.map((item) => `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(item.visibility)}</td>
          <td>${escapeHtml(item.updated_at ? new Date(item.updated_at).toLocaleDateString('sv-SE') : '')}</td>
          <td>
            ${isAdminRole(state.profile.role) && item.status !== 'published'
              ? `<button type="button" data-publish-prompt="${item.id}">Publicera</button>`
              : ''}
          </td>
        </tr>
      `).join('')
    : emptyRow(5, 'Inga egna prompts ännu.');

  libraryBody.innerHTML = publishedPrompts.length
    ? publishedPrompts.map((item) => `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(item.visibility)}</td>
          <td>${escapeHtml(item.category || '-')}</td>
          <td>${escapeHtml(item.audience || '-')}</td>
          <td>${escapeHtml(item.published_at ? new Date(item.published_at).toLocaleDateString('sv-SE') : '')}</td>
        </tr>
      `).join('')
    : emptyRow(5, 'Inga publicerade prompts i biblioteket ännu.');
}

function renderMembers() {
  const body = document.querySelector('[data-members]');
  body.innerHTML = state.members.length
    ? state.members.map((member) => `
        <tr>
          <td>${escapeHtml(member.user_id)}</td>
          <td>${escapeHtml(member.role)}</td>
          <td>${escapeHtml(member.created_at ? new Date(member.created_at).toLocaleDateString('sv-SE') : '')}</td>
        </tr>
      `).join('')
    : emptyRow(3, 'Inga medlemmar synliga med din roll.');
}

function renderApiKeys() {
  const body = document.querySelector('[data-api-keys]');
  body.innerHTML = state.apiKeys.length
    ? state.apiKeys.map((key) => `
        <tr>
          <td>${escapeHtml(key.name)}</td>
          <td><code>${escapeHtml(key.key_prefix)}</code></td>
          <td>${escapeHtml((key.scopes || []).join(', ') || '-')}</td>
          <td>${escapeHtml(key.revoked_at ? 'Återkallad' : 'Aktiv')}</td>
          <td>${escapeHtml(key.created_at ? new Date(key.created_at).toLocaleDateString('sv-SE') : '')}</td>
          <td>
            ${!key.revoked_at ? `<button type="button" data-revoke-api-key="${key.id}">Återkalla</button>` : ''}
          </td>
        </tr>
      `).join('')
    : emptyRow(6, 'Inga API-nycklar ännu.');
}

async function loadProfile(user) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, workspace_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    noProfileElement.hidden = false;
    dashboardElement.hidden = true;
    setStatus('');
    return false;
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, type, plan')
    .eq('id', profile.workspace_id)
    .single();

  if (workspaceError) {
    throw workspaceError;
  }

  state.user = user;
  state.profile = profile;
  state.workspace = workspace;

  setText('[data-user-email]', user.email);
  setText('[data-workspace-name]', workspace.name);
  setText('[data-workspace-type]', workspace.type);
  setText('[data-workspace-plan]', workspace.plan);
  setText('[data-profile-role]', profile.role);
  renderRoleMode(profile.role);
  renderCapabilityState();

  dashboardElement.hidden = false;
  noProfileElement.hidden = true;
  setStatus('');
  return true;
}

async function loadPrompts() {
  const { data, error } = await supabase
    .from('content_items')
    .select('id, title, slug, summary, status, visibility, category, audience, owner_user_id, created_by, published_at, updated_at')
    .eq('workspace_id', state.workspace.id)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  state.prompts = data || [];
  renderPrompts();
}

async function loadMembers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, role, created_at')
    .eq('workspace_id', state.workspace.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  state.members = data || [];
  renderMembers();
}

async function loadApiKeys() {
  if (!isAdminRole(state.profile.role)) {
    state.apiKeys = [];
    renderApiKeys();
    return;
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, last_used_at, revoked_at, created_at')
    .eq('workspace_id', state.workspace.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  state.apiKeys = data || [];
  renderApiKeys();
}

async function refreshWorkspaceData() {
  setStatus('Uppdaterar...');
  await Promise.all([loadPrompts(), loadMembers(), loadApiKeys()]);
  setStatus('');
}

async function createPrompt(event) {
  event.preventDefault();
  if (!canEdit(state.profile.role)) {
    setStatus('Din roll får inte skapa prompts.', true);
    return;
  }

  const formData = new FormData(promptForm);
  const title = formData.get('title')?.toString().trim();
  const content = formData.get('content')?.toString().trim();
  const slug = slugify(formData.get('slug')?.toString().trim() || title);

  if (!title || !content || !slug) {
    setStatus('Titel, slug och prompttext krävs.', true);
    return;
  }

  const { error } = await supabase.from('content_items').insert({
    workspace_id: state.workspace.id,
    owner_user_id: state.user.id,
    type: 'prompt',
    title,
    slug,
    summary: formData.get('summary')?.toString().trim() || null,
    content,
    status: 'draft',
    visibility: formData.get('visibility')?.toString() || 'workspace',
    category: formData.get('category')?.toString().trim() || null,
    audience: formData.get('audience')?.toString().trim() || null,
    created_by: state.user.id
  });

  if (error) {
    setStatus(error.message || 'Kunde inte skapa prompt.', true);
    return;
  }

  promptForm.reset();
  setStatus('Prompten sparades som utkast.');
  await loadPrompts();
}

async function publishPrompt(promptId) {
  if (!isAdminRole(state.profile.role)) {
    setStatus('Din roll får inte publicera.', true);
    return;
  }

  const { error } = await supabase
    .from('content_items')
    .update({ status: 'published' })
    .eq('id', promptId)
    .eq('workspace_id', state.workspace.id);

  if (error) {
    setStatus(error.message || 'Kunde inte publicera prompt.', true);
    return;
  }

  setStatus('Prompten publicerades.');
  await loadPrompts();
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createApiKey(event) {
  event.preventDefault();
  if (!isAdminRole(state.profile.role)) {
    setStatus('Din roll får inte skapa API-nycklar.', true);
    return;
  }

  const formData = new FormData(apiKeyForm);
  const name = formData.get('name')?.toString().trim();
  if (!name) {
    setStatus('Namn krävs för API-nyckeln.', true);
    return;
  }

  const rawKey = `pb_${randomToken()}`;
  const keyPrefix = rawKey.slice(0, 12);
  const keyHash = await sha256Hex(rawKey);
  const scopes = formData.get('scopes')?.toString().split(',').map((scope) => scope.trim()).filter(Boolean) || ['read'];

  const { error } = await supabase.from('api_keys').insert({
    workspace_id: state.workspace.id,
    created_by: state.user.id,
    name,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    scopes
  });

  if (error) {
    setStatus(error.message || 'Kunde inte skapa API-nyckel.', true);
    return;
  }

  apiKeyForm.reset();
  setText('[data-new-api-key]', rawKey);
  setStatus('API-nyckeln skapades. Kopiera den nu, den visas bara här.');
  await loadApiKeys();
}

async function revokeApiKey(keyId) {
  if (!isAdminRole(state.profile.role)) {
    setStatus('Din roll får inte återkalla API-nycklar.', true);
    return;
  }

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('workspace_id', state.workspace.id);

  if (error) {
    setStatus(error.message || 'Kunde inte återkalla API-nyckel.', true);
    return;
  }

  setStatus('API-nyckeln återkallades.');
  await loadApiKeys();
}

async function logout() {
  setStatus('Loggar ut...');
  const { error } = await supabase.auth.signOut();
  if (error) {
    setStatus(error.message || 'Kunde inte logga ut.', true);
    return;
  }

  window.location.replace('login.html');
}

async function init() {
  if (!requireSupabaseConfig(statusElement)) {
    return;
  }

  const session = await requireSession();
  if (!session) {
    return;
  }

  setStatus('Laddar workspace...');
  const hasProfile = await loadProfile(session.user);
  if (hasProfile) {
    await refreshWorkspaceData();
  }
}

if (logoutButton) {
  logoutButton.addEventListener('click', logout);
}

if (promptForm) {
  promptForm.addEventListener('submit', createPrompt);
}

if (apiKeyForm) {
  apiKeyForm.addEventListener('submit', createApiKey);
}

refreshButtons.forEach((button) => {
  button.addEventListener('click', () => {
    refreshWorkspaceData().catch((error) => setStatus(error.message || 'Kunde inte uppdatera.', true));
  });
});

document.addEventListener('click', (event) => {
  const publishButton = event.target.closest('[data-publish-prompt]');
  const revokeButton = event.target.closest('[data-revoke-api-key]');

  if (publishButton) {
    publishPrompt(publishButton.dataset.publishPrompt);
  }

  if (revokeButton) {
    revokeApiKey(revokeButton.dataset.revokeApiKey);
  }
});

init().catch((error) => {
  setStatus(error.message || 'Kunde inte ladda adminytan.', true);
});
