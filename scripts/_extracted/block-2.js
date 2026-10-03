
'use strict';

// ======================================
// APP STATE
// ======================================

const App = {
  page: 'dashboard',
  church: null,
  currentTemplate: null,     // template being edited (with isNew flag)
  currentService: null,      // service being edited
  editingItemId: null,       // service-item modal target
  themeEditorId: null,       // theme modal target id (null = new)
  pdfPreviewId: null,        // history record in preview modal
  flatpickrs: [],            // live flatpickr instances
};

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',          icon: 'home' },
  { id: 'templates',   label: 'Templates',          icon: 'layout-template' },
  { id: 'newService',  label: 'New Sunday Service', icon: 'calendar-plus' },
  { id: 'sundays',     label: 'Saved Sundays',      icon: 'calendar-days' },
  { id: 'history',     label: 'PDF History',        icon: 'history' },
  { id: 'themes',      label: 'Themes',             icon: 'palette' },
  { id: 'settings',    label: 'Church Settings',    icon: 'settings' },
  { id: 'account',     label: 'Account',            icon: 'user' },
];
const BOTTOM_NAV = ['dashboard', 'templates', 'newService', 'history', 'settings'];
const NAV_PARENT = { templateEditor: 'templates', serviceEditor: 'sundays' };

const THEME_PRESETS = [
  { id: 'theme-classic', name: 'Classic', builtIn: true, primary: '#1F3A5F', secondary: '#5C6670',
    headingFont: 'serif', bodyFont: 'serif', logoPosition: 'center', borderStyle: 'double', footerStyle: 'classic' },
  { id: 'theme-modern', name: 'Modern', builtIn: true, useBrandColor: true, primary: '#1E40AF', secondary: '#525252',
    headingFont: 'sans', bodyFont: 'sans', logoPosition: 'center', borderStyle: 'line', footerStyle: 'line' },
  { id: 'theme-minimal', name: 'Minimal', builtIn: true, primary: '#262626', secondary: '#8A8A8A',
    headingFont: 'sans', bodyFont: 'sans', logoPosition: 'center', borderStyle: 'none', footerStyle: 'minimal' },
];

const DEFAULT_TEMPLATES = [
  { name: 'Sunday Worship Service', description: 'Regular Sunday worship service', items: [
    ['Opening Prayer', '', true],
    ['Praise & Worship', '', true],
    ['Scripture Reading', '', true],
    ['Choir Ministration', 'Ministration by the choir', true],
    ['Congregational Prayer', '', true],
    ['Sermon', '', true],
    ['Offering', '', true],
    ['Announcements', 'Church notices and upcoming events', false],
    ['Benediction', '', true],
  ]},
  { name: 'Thanksgiving Service', description: 'Service of thanksgiving and testimony', items: [
    ['Opening Prayer', '', true],
    ['Praise & Worship', '', true],
    ['Thanksgiving Testimonies', 'Members share testimonies of God\'s faithfulness', true],
    ['Scripture Reading', '', true],
    ['Special Ministration', '', true],
    ['Sermon', '', true],
    ['Thanksgiving Offering', '', true],
    ['Announcements', 'Church notices and upcoming events', false],
    ['Benediction', '', true],
  ]},
  { name: 'Youth Service', description: 'Energetic service led by the youth fellowship', items: [
    ['Opening Prayer', '', true],
    ['Praise & Worship', '', true],
    ['Scripture Reading', '', true],
    ['Youth Presentation', 'Drama, spoken word or creative ministration', true],
    ['Choir Ministration', '', true],
    ['Sermon', '', true],
    ['Offering', '', true],
    ['Announcements', '', false],
    ['Benediction', '', true],
  ]},
  { name: 'Children Service', description: 'Sunday program for the children\'s church', items: [
    ['Welcome & Opening Prayer', '', true],
    ['Songs & Praise', '', true],
    ['Memory Verse', '', true],
    ['Bible Story', 'Storytelling with lessons', true],
    ['Bible Quiz & Games', '', true],
    ['Crafts & Activities', '', true],
    ['Closing Prayer', '', true],
  ]},
];

// ======================================
// UTILITIES
// ======================================

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function uid() {
  return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function isoOf(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}

function dateOf(iso) { return new Date((iso || '') + 'T12:00:00'); }

function fmtLongDate(iso) {
  if (!iso) return '';
  try { return dateOf(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  catch (e) { return iso; }
}

function fmtShortDate(iso) {
  if (!iso) return '';
  try { return dateOf(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch (e) { return iso; }
}

function fmtMonthDay(iso) {
  if (!iso) return { month: '', day: '' };
  const d = dateOf(iso);
  return { month: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(), day: String(d.getDate()).padStart(2, '0') };
}

function fmtMonthYear(iso) {
  if (!iso) return '';
  try { return dateOf(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
  catch (e) { return ''; }
}

function timeAgo(iso) {
  if (!iso) return '';
  const now = new Date(); const then = new Date(iso);
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
                           new Date(then.getFullYear(), then.getMonth(), then.getDate())) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return days + ' days ago';
  if (days < 30) return Math.floor(days / 7) + (days < 14 ? ' week ago' : ' weeks ago');
  return fmtShortDate(isoOf(then));
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function hexToRgb(hex) {
  let m = String(hex || '').replace('#', '').trim();
  if (m.length === 3) m = m.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return [30, 64, 175];
  const n = parseInt(m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function isValidHex(hex) {
  const m = String(hex || '').replace('#', '').trim();
  return /^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/.test(m);
}

function mixHex(hex, white, ratio) { // ratio = amount of white (0..1)
  const a = hexToRgb(hex), b = hexToRgb(white);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * ratio));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

function initialsOf(name) {
  const words = String(name || 'R').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'R';
}

function sanitizeFile(s) {
  return String(s || '').trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'document';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
  });
}

function nextSunday() {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  const add = ((7 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + add);
  return d;
}

function refreshIcons() {
  if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) { /* non-fatal */ } }
}

// Effective theme used by preview + PDF (resolves brand-color themes)
function getActiveTheme() {
  const id = App.church && App.church.activeThemeId;
  const list = App.themeCache || [];
  return list.find(t => t.id === id) || list[0] || deepClone(THEME_PRESETS[0]);
}

function themePrimary(theme, church) {
  return theme.useBrandColor ? (church.brandColor || '#1E40AF') : (theme.primary || '#1F3A5F');
}

// Shared layout parameters for the on-screen document preview
function docParams(theme, church) {
  const primary = themePrimary(theme, church);
  const hf = theme.headingFont === 'serif' ? "'Playfair Display', Georgia, serif" : "'Inter', sans-serif";
  const bf = theme.bodyFont === 'serif' ? "'Lora', Georgia, serif" : "'Inter', sans-serif";
  const border = theme.borderStyle || 'none';
  return {
    primary,
    secondary: theme.secondary || '#737373',
    hf, bf,
    frameColor: mixHex(primary, '#FFFFFF', 0.55),
    gap: border === 'none' ? 26 : 20,
    dividers: border === 'line',
    borderStyle: border,
    footerStyle: theme.footerStyle || 'classic',
    align: theme.logoPosition === 'left' ? 'left' : 'center',
  };
}
// ======================================
// DATABASE
// ======================================

const db = new Dexie('RedeemServiceDB');
db.version(1).stores({
  church:      'id',
  templates:   'id, name, createdAt',
  services:    'id, date, templateId, updatedAt',
  serviceItems:'id, templateId',
  themes:      'id, name, createdAt',
  pdfHistory:  'id, serviceId, createdAt',
});

async function seedIfEmpty() {
  if (await db.church.count() === 0) {
    await db.church.add({
      id: 'main',
      name: 'Redeem Church',
      tagline: '',
      address: '', phone: '', email: '', website: '',
      brandColor: '#1E40AF',
      logo: null,
      activeThemeId: 'theme-classic',
      createdAt: new Date().toISOString(),
    });
  }
  if (await db.templates.count() === 0) {
    const now = new Date().toISOString();
    await db.templates.bulkAdd(DEFAULT_TEMPLATES.map(t => ({
      id: uid(),
      name: t.name,
      description: t.description,
      items: t.items.map(([title, description, requiresPerson]) => ({ id: uid(), title, description, requiresPerson })),
      createdAt: now,
      updatedAt: now,
    })));
  }
  if (await db.themes.count() === 0) {
    const now = new Date().toISOString();
    await db.themes.bulkAdd(THEME_PRESETS.map(t => Object.assign(deepClone(t), { createdAt: now })));
  }
}

async function loadThemes() {
  App.themeCache = await db.themes.toArray();
}

// ======================================
// CHURCH SETTINGS
// ======================================

function applyAccent() {
  const hex = (App.church && App.church.brandColor) || '#1E40AF';
  const rgb = hexToRgb(hex);
  document.documentElement.style.setProperty('--accent-rgb', rgb.join(' '));
}

function updateBranding() {
  const c = App.church || {};
  const name = c.name || 'Redeem Church';
  const initials = initialsOf(name);
  ['brand-badge', 'brand-badge-m', 'brand-badge-h'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = initials;
  });
  ['brand-name', 'brand-name-m', 'brand-name-h', 'brand-profile-name'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = name;
  });
  const avatar = document.getElementById('brand-avatar');
  if (avatar) {
    avatar.innerHTML = c.logo
      ? '<img src="' + c.logo + '" alt="' + esc(name) + ' logo" class="w-full h-full object-cover">'
      : esc(initials);
  }
}

function renderSettings() {
  const c = App.church || {};
  const color = c.brandColor || '#1E40AF';
  return `
  <div class="mb-6">
    <h1 class="text-2xl font-semibold">Church Settings</h1>
    <p class="text-sm text-muted mt-1">Branding, contact information and appearance.</p>
  </div>

  <div class="space-y-6 max-w-3xl">
    <section class="card p-5 sm:p-6">
      <h2 class="text-base font-semibold">Church branding</h2>
      <p class="text-sm text-muted mt-1">Appears across the app and at the top of every PDF.</p>

      <div class="mt-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div id="logo-preview" class="w-20 h-20 rounded-2xl border border-line bg-paper flex items-center justify-center overflow-hidden shrink-0">
          ${c.logo
            ? '<img src="' + c.logo + '" alt="Church logo preview" class="w-full h-full object-contain p-1.5">'
            : '<i data-lucide="image" class="w-6 h-6 text-muted"></i>'}
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap gap-2">
            <button class="btn btn-ghost" data-action="logo-upload"><i data-lucide="upload" class="w-4 h-4"></i>Upload Logo</button>
            ${c.logo ? '<button class="btn btn-danger" data-action="logo-remove"><i data-lucide="trash-2" class="w-4 h-4"></i>Remove</button>' : ''}
          </div>
          <p class="text-xs text-muted mt-2">PNG or JPG. Stored locally in your browser (IndexedDB) and placed prominently on the PDF.</p>
        </div>
        <input type="file" id="logo-file" accept="image/*" class="hidden">
      </div>

      <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="form-label" for="set-name">Church Name</label>
          <input id="set-name" class="input" data-setting="name" value="${esc(c.name || '')}" maxlength="60" placeholder="Redeem Church">
        </div>
        <div>
          <label class="form-label" for="set-tagline">Tagline <span class="text-muted font-normal">(optional)</span></label>
          <input id="set-tagline" class="input" data-setting="tagline" value="${esc(c.tagline || '')}" maxlength="80" placeholder="e.g. A people of purpose">
        </div>
      </div>
    </section>

    <section class="card p-5 sm:p-6">
      <h2 class="text-base font-semibold">Contact information</h2>
      <p class="text-sm text-muted mt-1">Shown in the PDF footer and available for printed programs.</p>
      <div class="mt-6 space-y-4">
        <div>
          <label class="form-label" for="set-address">Address</label>
          <textarea id="set-address" rows="2" class="input" data-setting="address" maxlength="140" placeholder="12 Grace Avenue, Lagos">${esc(c.address || '')}</textarea>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="form-label" for="set-phone">Phone</label>
            <input id="set-phone" class="input" data-setting="phone" value="${esc(c.phone || '')}" maxlength="30" placeholder="+234 800 000 0000">
          </div>
          <div>
            <label class="form-label" for="set-email">Email</label>
            <input id="set-email" class="input" data-setting="email" value="${esc(c.email || '')}" maxlength="80" placeholder="hello@redeemchurch.org">
          </div>
          <div>
            <label class="form-label" for="set-website">Website</label>
            <input id="set-website" class="input" data-setting="website" value="${esc(c.website || '')}" maxlength="80" placeholder="www.redeemchurch.org">
          </div>
        </div>
      </div>
    </section>

    <section class="card p-5 sm:p-6">
      <h2 class="text-base font-semibold">Appearance</h2>
      <p class="text-sm text-muted mt-1">The primary brand color styles the app accents, buttons and the Modern PDF theme.</p>
      <div class="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div class="flex gap-2 items-center">
          <input type="color" id="set-color" class="color-input" value="${esc(color)}">
          <input type="text" id="set-color-hex" class="input w-32 font-mono" value="${esc(color)}" maxlength="7" placeholder="#1E40AF">
        </div>
        <div class="flex items-center gap-3 text-sm text-muted">
          <span class="inline-flex items-center gap-2"><span class="w-4 h-4 rounded-md" style="background: rgb(var(--accent-rgb))"></span>Current accent</span>
        </div>
      </div>
    </section>

    <div class="flex justify-end">
      <button class="btn btn-primary" data-action="save-settings"><i data-lucide="check" class="w-4 h-4"></i>Save Changes</button>
    </div>
  </div>`;
}

async function saveChurchSettings() {
  const c = App.church;
  if (!c.name || !c.name.trim()) { toast('Please enter the church name', 'info'); return; }
  c.name = c.name.trim();
  await db.church.put(c);
  applyAccent();
  updateBranding();
  toast('Church settings saved');
  showPage('settings');
}

function handleLogoFile(file) {
  if (!file || !/^image\//.test(file.type)) { toast('Please choose an image file', 'info'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 512;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      App.church.logo = canvas.toDataURL('image/png');
      const preview = document.getElementById('logo-preview');
      if (preview) {
        preview.innerHTML = '<img src="' + App.church.logo + '" alt="Church logo preview" class="w-full h-full object-contain p-1.5">';
      }
      toast('Logo added. Remember to save.');
    };
    img.onerror = () => toast('That image could not be read', 'error');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
// ======================================
// TEMPLATES
// ======================================

function templateCardHtml(t) {
  const count = (t.items || []).length;
  return `
  <div class="card p-5 flex flex-col">
    <div class="flex items-start justify-between gap-2">
      <div class="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><i data-lucide="layout-template" class="w-5 h-5"></i></div>
      <div class="flex gap-1">
        <button class="icon-btn" data-action="open-template-editor" data-id="${t.id}" aria-label="Edit ${esc(t.name)}"><i data-lucide="pencil" class="w-4 h-4"></i></button>
        <button class="icon-btn" data-action="duplicate-template" data-id="${t.id}" aria-label="Duplicate ${esc(t.name)}"><i data-lucide="copy" class="w-4 h-4"></i></button>
        <button class="icon-btn danger" data-action="delete-template" data-id="${t.id}" aria-label="Delete ${esc(t.name)}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    </div>
    <div class="mt-4 min-w-0 flex-1">
      <h3 class="font-semibold truncate" title="${esc(t.name)}">${esc(t.name)}</h3>
      <p class="text-sm text-muted mt-1 line-clamp-2 min-h-[2.5rem]">${esc(t.description || 'No description')}</p>
    </div>
    <div class="mt-4 pt-4 border-t border-line flex items-center justify-between">
      <span class="text-xs text-muted">${count} item${count === 1 ? '' : 's'}</span>
      <button class="btn btn-soft" data-action="use-template" data-id="${t.id}">Use<i data-lucide="arrow-right" class="w-4 h-4"></i></button>
    </div>
  </div>`;
}

async function renderTemplates() {
  const templates = (await db.templates.toArray()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return `
  <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-semibold">Templates</h1>
      <p class="text-sm text-muted mt-1">Reusable outlines for your orders of service.</p>
    </div>
    <button class="btn btn-primary" data-action="open-template-editor"><i data-lucide="plus" class="w-4 h-4"></i>New Template</button>
  </div>
  ${templates.length
    ? '<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">' + templates.map(templateCardHtml).join('') + '</div>'
    : `
    <div class="card p-10 sm:p-16 text-center">
      <div class="w-14 h-14 rounded-2xl bg-paper mx-auto flex items-center justify-center"><i data-lucide="layout-template" class="w-7 h-7 text-muted"></i></div>
      <h3 class="mt-4 font-semibold text-lg">No templates yet</h3>
      <p class="text-sm text-muted mt-1 max-w-sm mx-auto">Create your first template to start planning orders of service for Sundays and special programs.</p>
      <button class="btn btn-primary mt-6" data-action="open-template-editor"><i data-lucide="plus" class="w-4 h-4"></i>Create Template</button>
    </div>`}`;
}

function templateItemsHtml(items) {
  if (!items.length) {
    return '<p class="py-10 text-center text-sm text-muted">No items yet. Add the first service item below.</p>';
  }
  return items.map(item => `
    <div class="tpl-item flex items-center gap-3 py-3" data-id="${item.id}">
      <span class="drag-handle icon-btn" title="Drag to reorder"><i data-lucide="grip-vertical" class="w-4 h-4"></i></span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="text-sm font-medium truncate">${esc(item.title)}</p>
          ${item.requiresPerson ? '<span class="chip">Person required</span>' : '<span class="chip">No person</span>'}
        </div>
        ${item.description ? '<p class="text-xs text-muted mt-0.5 line-clamp-2">' + esc(item.description) + '</p>' : ''}
      </div>
      <button class="icon-btn" data-action="edit-item" data-id="${item.id}" aria-label="Edit item"><i data-lucide="pencil" class="w-4 h-4"></i></button>
      <button class="icon-btn danger" data-action="remove-item" data-id="${item.id}" aria-label="Remove item"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </div>`).join('');
}

function renderTemplateEditor() {
  const t = App.currentTemplate || { name: '', description: '', items: [] };
  return `
  <div class="mb-6 flex items-center gap-3">
    <button class="icon-btn" data-action="back-templates" aria-label="Back to templates"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
    <div>
      <h1 class="text-2xl font-semibold">${t.isNew ? 'Create Template' : 'Edit Template'}</h1>
      <p class="text-sm text-muted mt-1">Drag items to reorder the flow of service.</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
    <section class="card p-5 sm:p-6">
      <h2 class="text-base font-semibold">Template details</h2>
      <div class="mt-5 space-y-4">
        <div>
          <label class="form-label" for="tpl-name">Template Name</label>
          <input id="tpl-name" class="input" value="${esc(t.name || '')}" maxlength="60" placeholder="Sunday Worship Service">
        </div>
        <div>
          <label class="form-label" for="tpl-desc">Description</label>
          <textarea id="tpl-desc" rows="3" class="input" maxlength="160" placeholder="Regular Sunday worship service">${esc(t.description || '')}</textarea>
        </div>
      </div>
      <button class="btn btn-primary w-full mt-6" data-action="save-template"><i data-lucide="check" class="w-4 h-4"></i>Save Template</button>
    </section>

    <section class="card p-5 sm:p-6 lg:col-span-2">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-semibold">Service items</h2>
        <span id="tpl-item-count" class="chip">${(t.items || []).length} items</span>
      </div>
      <div id="tpl-items-list" class="mt-4 divide-y divide-line border-t border-b border-line rounded-xl">
        ${templateItemsHtml(t.items || [])}
      </div>
      <button class="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm font-medium text-muted hover:border-accent hover:text-accent transition-colors" data-action="add-item">
        <i data-lucide="plus" class="w-4 h-4"></i>Add Service Item
      </button>
    </section>
  </div>`;
}

function refreshTemplateItemsList() {
  const list = document.getElementById('tpl-items-list');
  const count = document.getElementById('tpl-item-count');
  if (!list || !App.currentTemplate) return;
  list.innerHTML = templateItemsHtml(App.currentTemplate.items);
  if (count) count.textContent = App.currentTemplate.items.length + ' items';
  refreshIcons();
}

async function openTemplateEditor(id) {
  if (id) {
    const t = await db.templates.get(id);
    if (!t) { toast('Template not found', 'error'); return; }
    App.currentTemplate = Object.assign(deepClone(t), { isNew: false });
  } else {
    App.currentTemplate = { id: uid(), name: '', description: '', items: [], isNew: true };
  }
  showPage('templateEditor');
}

async function saveTemplate() {
  const t = App.currentTemplate;
  if (!t) return;
  const name = String($('#tpl-name').value || '').trim();
  const description = String($('#tpl-desc').value || '').trim();
  if (!name) { toast('Please give the template a name', 'info'); return; }
  if (!t.items.length) { toast('Add at least one service item', 'info'); return; }
  const now = new Date().toISOString();
  const record = { id: t.id, name, description, items: t.items, createdAt: t.createdAt || now, updatedAt: now };
  if (t.isNew) await db.templates.add(record); else await db.templates.put(record);
  App.currentTemplate = null;
  toast('Template saved');
  showPage('templates');
}

async function duplicateTemplate(id) {
  const t = await db.templates.get(id);
  if (!t) return;
  const now = new Date().toISOString();
  const copy = deepClone(t);
  copy.id = uid();
  copy.name = t.name + ' (Copy)';
  copy.createdAt = now; copy.updatedAt = now;
  copy.items = copy.items.map(it => Object.assign({}, it, { id: uid() }));
  await db.templates.add(copy);
  toast('Template duplicated');
  showPage('templates');
}

async function deleteTemplate(id) {
  const t = await db.templates.get(id);
  if (!t) return;
  const ok = await confirmDialog({
    title: 'Delete template?',
    text: '"' + t.name + '" and its ' + t.items.length + ' items will be removed. Services already created from it are not affected.',
    confirmText: 'Delete',
  });
  if (!ok) return;
  await db.templates.delete(id);
  toast('Template deleted');
  showPage('templates');
}

// Service item modal

function openItemModal(item) {
  App.editingItemId = item ? item.id : null;
  $('#item-modal-title').textContent = item ? 'Edit Service Item' : 'Add Service Item';
  $('#item-save-label').textContent = item ? 'Save Changes' : 'Add Item';
  $('#item-title').value = item ? item.title : '';
  $('#item-desc').value = item ? (item.description || '') : '';
  $('#item-person').checked = item ? !!item.requiresPerson : true;
  openModal('modal-item');
  setTimeout(() => { try { $('#item-title').focus(); } catch (e) {} }, 120);
}

function saveItemFromModal() {
  const t = App.currentTemplate;
  if (!t) return;
  const title = String($('#item-title').value || '').trim();
  const description = String($('#item-desc').value || '').trim();
  const requiresPerson = $('#item-person').checked;
  if (!title) { toast('Please give the item a title', 'info'); return; }
  if (App.editingItemId) {
    const it = t.items.find(i => i.id === App.editingItemId);
    if (it) { it.title = title; it.description = description; it.requiresPerson = requiresPerson; }
  } else {
    t.items.push({ id: uid(), title, description, requiresPerson });
  }
  closeModal('modal-item');
  refreshTemplateItemsList();
}

async function removeTemplateItem(id) {
  const t = App.currentTemplate;
  if (!t) return;
  const it = t.items.find(i => i.id === id);
  if (!it) return;
  const ok = await confirmDialog({
    title: 'Remove item?',
    text: '"' + it.title + '" will be removed from this template.',
    confirmText: 'Remove',
  });
  if (!ok) return;
  t.items = t.items.filter(i => i.id !== id);
  refreshTemplateItemsList();
}

// ======================================
// DRAG & DROP
// ======================================

function initTemplateSortable() {
  const list = document.getElementById('tpl-items-list');
  if (!list || !window.Sortable) return;
  new Sortable(list, {
    handle: '.drag-handle',
    animation: 180,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: () => {
      const t = App.currentTemplate;
      if (!t) return;
      const order = $$('.tpl-item', list).map(el => el.dataset.id);
      t.items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    },
  });
}
// ======================================
// SERVICE BUILDER
// ======================================

async function renderNewService() {
  const templates = (await db.templates.toArray()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (!templates.length) {
    return `
    <div class="card p-10 sm:p-16 text-center">
      <div class="w-14 h-14 rounded-2xl bg-paper mx-auto flex items-center justify-center"><i data-lucide="layout-template" class="w-7 h-7 text-muted"></i></div>
      <h3 class="mt-4 font-semibold text-lg">No templates yet</h3>
      <p class="text-sm text-muted mt-1 max-w-sm mx-auto">You need at least one service template before creating a Sunday service.</p>
      <button class="btn btn-primary mt-6" data-action="open-template-editor"><i data-lucide="plus" class="w-4 h-4"></i>Create Template</button>
    </div>`;
  }
  const pre = (App.preselectTemplateId && templates.some(t => t.id === App.preselectTemplateId))
    ? App.preselectTemplateId : templates[0].id;
  App.preselectTemplateId = null;
  App.newServiceDate = null;
  return `
  <div class="mb-6 flex items-center gap-3">
    <button class="icon-btn" data-action="nav" data-page="sundays" aria-label="Back to saved Sundays"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
    <div>
      <h1 class="text-2xl font-semibold">Create Sunday Service</h1>
      <p class="text-sm text-muted mt-1">Pick a template, set the date and theme. You will assign people next.</p>
    </div>
  </div>

  <section class="card p-6 sm:p-8 max-w-2xl">
    <div class="space-y-5">
      <div>
        <label class="form-label" for="ns-template">Service Template</label>
        <select id="ns-template" class="input">
          ${templates.map(t => '<option value="' + t.id + '"' + (t.id === pre ? ' selected' : '') + '>' + esc(t.name) + ' (' + t.items.length + ' items)</option>').join('')}
        </select>
        <p class="text-xs text-muted mt-1.5">The order of service will be built from this template.</p>
      </div>
      <div>
        <label class="form-label" for="ns-date">Date</label>
        <input id="ns-date" class="input" placeholder="Select a date" readonly>
        <p class="text-xs text-muted mt-1.5">Defaults to the coming Sunday.</p>
      </div>
      <div>
        <label class="form-label" for="ns-theme">Service Theme <span class="text-muted font-normal">(optional)</span></label>
        <input id="ns-theme" class="input" maxlength="80" placeholder="Walking in God's Purpose">
      </div>
      <div>
        <label class="form-label" for="ns-desc">Service Description <span class="text-muted font-normal">(optional)</span></label>
        <textarea id="ns-desc" rows="3" class="input" maxlength="200" placeholder="Special notes for this service"></textarea>
      </div>
      <div class="flex justify-end pt-2">
        <button class="btn btn-primary" data-action="continue-new-service">Continue<i data-lucide="arrow-right" class="w-4 h-4"></i></button>
      </div>
    </div>
  </section>`;
}

function afterNewService() {
  if (!window.flatpickr) return;
  const def = App.newServiceDate ? dateOf(App.newServiceDate) : nextSunday();
  const fp = flatpickr('#ns-date', {
    dateFormat: 'l, j F Y',
    defaultDate: def,
    onChange: (dates) => { App.newServiceDate = dates[0] ? isoOf(dates[0]) : null; },
  });
  App.flatpickrs.push(fp);
  App.newServiceDate = isoOf(def);
}

async function continueNewService() {
  const templateId = String($('#ns-template').value || '');
  const tpl = await db.templates.get(templateId);
  if (!tpl) { toast('Please choose a template', 'info'); return; }
  const date = App.newServiceDate || isoOf(nextSunday());
  App.currentService = {
    id: uid(),
    templateId: tpl.id,
    templateName: tpl.name,
    date,
    theme: String($('#ns-theme').value || '').trim(),
    description: String($('#ns-desc').value || '').trim(),
    items: (tpl.items || []).map(it => ({
      id: uid(), title: it.title, description: it.description || '',
      requiresPerson: !!it.requiresPerson, person: '',
    })),
    createdAt: new Date().toISOString(),
    isNew: true,
  };
  showPage('serviceEditor');
}

function serviceItemBlockHtml(it) {
  return `
  <div class="pt-5 border-t border-line first:pt-0 first:border-t-0">
    <div class="flex items-center justify-between gap-2 mb-2">
      <label class="text-sm font-medium" for="person-${it.id}">${esc(it.title)}</label>
      ${it.requiresPerson ? '' : '<span class="chip">No person required</span>'}
    </div>
    ${it.requiresPerson
      ? '<input id="person-' + it.id + '" class="input" data-person="' + it.id + '" value="' + esc(it.person || '') + '" maxlength="60" placeholder="Assigned to (e.g. Brother Daniel)">'
      : ''}
    ${it.description
      ? '<textarea class="input mt-2" rows="2" data-item-desc="' + it.id + '" maxlength="160" placeholder="Description">' + esc(it.description) + '</textarea>'
      : ''}
  </div>`;
}

function renderServiceEditor() {
  const s = App.currentService;
  if (!s) {
    return `
    <div class="card p-10 sm:p-16 text-center">
      <div class="w-14 h-14 rounded-2xl bg-paper mx-auto flex items-center justify-center"><i data-lucide="calendar-days" class="w-7 h-7 text-muted"></i></div>
      <h3 class="mt-4 font-semibold text-lg">No service in progress</h3>
      <p class="text-sm text-muted mt-1 max-w-sm mx-auto">Start a new Sunday service or open one from Saved Sundays.</p>
      <div class="flex justify-center gap-2 mt-6 flex-wrap">
        <button class="btn btn-primary" data-action="nav" data-page="newService"><i data-lucide="plus" class="w-4 h-4"></i>Create Sunday Service</button>
        <button class="btn btn-ghost" data-action="nav" data-page="sundays">Saved Sundays</button>
      </div>
    </div>`;
  }
  const themes = App.themeCache || [];
  const activeId = (App.church && App.church.activeThemeId) || '';
  return `
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-3 min-w-0">
      <button class="icon-btn" data-action="nav" data-page="sundays" aria-label="Back to saved Sundays"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
      <div class="min-w-0">
        <h1 class="text-2xl font-semibold truncate">${s.isNew ? 'New Sunday Service' : 'Edit Service'}</h1>
        <p class="text-sm text-muted mt-0.5 truncate">${esc(s.templateName || '')}${s.date ? ' • ' + esc(fmtLongDate(s.date)) : ''}</p>
      </div>
    </div>
    <div class="flex gap-2">
      <button class="btn btn-ghost" data-action="save-service"><i data-lucide="check" class="w-4 h-4"></i>Save</button>
      <button class="btn btn-primary btn-generate" data-action="generate-pdf"><i data-lucide="file-down" class="w-4 h-4"></i><span class="hidden sm:inline">Generate PDF</span></button>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
    <div class="space-y-6">
      <section class="card p-5 sm:p-6">
        <h2 class="text-base font-semibold">Service details</h2>
        <div class="mt-5 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="form-label" for="se-date">Date</label>
              <input id="se-date" class="input" readonly>
            </div>
            <div>
              <label class="form-label" for="se-theme">Service Theme</label>
              <input id="se-theme" class="input" data-live="theme" value="${esc(s.theme || '')}" maxlength="80" placeholder="Walking in God's Purpose">
            </div>
          </div>
          <div>
            <label class="form-label" for="se-desc">Service Description <span class="text-muted font-normal">(optional)</span></label>
            <textarea id="se-desc" rows="2" class="input" data-live="description" maxlength="200" placeholder="Special notes for this service">${esc(s.description || '')}</textarea>
          </div>
        </div>
      </section>

      <section class="card p-5 sm:p-6">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold">Order of service</h2>
          <span class="chip">${s.items.length} items</span>
        </div>
        <div class="mt-5 space-y-0">
          ${s.items.map(serviceItemBlockHtml).join('')}
        </div>
      </section>
    </div>

    <section class="card lg:sticky lg:top-6">
      <div class="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-line flex-wrap">
        <div>
          <h2 class="text-base font-semibold">Live preview</h2>
          <p class="text-xs text-muted mt-0.5">Exactly how the PDF will look.</p>
        </div>
        <label class="text-xs text-muted flex items-center gap-2">Theme
          <select id="se-theme-select" class="input se-theme-select">
            ${themes.map(t => '<option value="' + t.id + '"' + (t.id === activeId ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('')}
          </select>
        </label>
      </div>
      <div class="p-4 sm:p-6 bg-paper/70 overflow-x-auto">
        <div id="live-paper">${renderDocHtml(s, App.church, getActiveTheme())}</div>
      </div>
      <div class="px-5 sm:px-6 py-4 border-t border-line">
        <button class="btn btn-primary btn-generate w-full" id="btn-generate-pdf" data-action="generate-pdf">
          <i data-lucide="file-down" class="w-4 h-4"></i>Generate PDF
        </button>
        <p class="text-[11px] text-muted text-center mt-2">A4 portrait • multi-page • saved to PDF history</p>
      </div>
    </section>
  </div>`;
}

function afterServiceEditor() {
  if (!App.currentService || !window.flatpickr) return;
  const fp = flatpickr('#se-date', {
    dateFormat: 'l, j F Y',
    defaultDate: App.currentService.date ? dateOf(App.currentService.date) : nextSunday(),
    onChange: (dates) => {
      if (App.currentService && dates[0]) { App.currentService.date = isoOf(dates[0]); refreshLivePreview(); }
    },
  });
  App.flatpickrs.push(fp);
}

function refreshLivePreview() {
  const holder = document.getElementById('live-paper');
  if (!holder || !App.currentService) return;
  holder.innerHTML = renderDocHtml(App.currentService, App.church, getActiveTheme());
}

async function persistService(s) {
  const now = new Date().toISOString();
  s.updatedAt = now;
  const existing = await db.services.get(s.id);
  if (existing) await db.services.put(s); else await db.services.add(s);
  s.isNew = false;
}

async function saveService() {
  const s = App.currentService;
  if (!s) return;
  if (!s.items.length) { toast('This service has no items', 'info'); return; }
  await persistService(s);
  toast('Sunday service saved');
  showPage('serviceEditor');
}

async function openSavedService(id) {
  const s = await db.services.get(id);
  if (!s) { toast('Service not found', 'error'); return; }
  App.currentService = deepClone(s);
  App.currentService.isNew = false;
  showPage('serviceEditor');
}

// ======================================
// LIVE PREVIEW
// ======================================

function renderDocHtml(service, church, theme) {
  church = church || {};
  const P = docParams(theme, church);
  const name = church.name || 'Redeem Church';
  const initials = initialsOf(name);
  const dateTxt = service.date ? fmtLongDate(service.date) : '';
  const themeTxt = String(service.theme || '').trim();
  const website = String(church.website || '').trim();
  const left = P.align === 'left';

  const chrome = P.borderStyle === 'double'
    ? '<div class="doc-frame-outer" style="border-color:' + P.frameColor + '"></div><div class="doc-frame-inner" style="border-color:' + P.frameColor + '"></div>'
    : P.borderStyle === 'line'
      ? '<div class="doc-topbar"></div><div class="doc-bottombar"></div>'
      : '';

  const itemsHtml = (service.items || []).map(it => `
      <div class="doc-item">
        <div class="doc-item-title">${esc(it.title)}</div>
        ${it.requiresPerson && it.person ? '<div class="doc-item-person">' + esc(it.person) + '</div>' : ''}
        ${it.description ? '<div class="doc-item-desc">' + esc(it.description) + '</div>' : ''}
      </div>`).join('');

  let footerHtml = '';
  if (P.footerStyle === 'classic') {
    const txt = [name, website].filter(Boolean).join('  •  ');
    footerHtml = '<div class="doc-footer classic">— ' + esc(txt) + ' —</div>';
  } else if (P.footerStyle === 'line') {
    footerHtml = '<div class="doc-footer line"><span>' + esc(name) + '</span><span>' + esc(website || 'Order of Service') + '</span></div>';
  } else {
    footerHtml = '<div class="doc-footer minimal">' + esc(website || 'Order of Service') + '</div>';
  }

  return `
  <div class="paper" style="--primary:${P.primary};--secondary:${P.secondary};--hf:${P.hf};--bf:${P.bf};--item-gap:${P.gap}px;--frame-color:${P.frameColor}">
    ${chrome}
    <div class="doc-head${left ? ' left' : ''}">
      <div class="doc-logo">
        ${church.logo ? '<img src="' + church.logo + '" alt="' + esc(name) + ' logo">' : '<div class="doc-logo-ph">' + esc(initials) + '</div>'}
      </div>
      <div class="doc-name">${esc(name)}</div>
      ${church.tagline ? '<div class="doc-tagline">' + esc(church.tagline) + '</div>' : ''}
      <div class="doc-sub">ORDER OF SERVICE</div>
      ${dateTxt ? '<div class="doc-date">' + esc(dateTxt) + '</div>' : ''}
      ${themeTxt ? '<div class="doc-theme">“' + esc(themeTxt) + '”</div>' : ''}
      <div class="doc-headrule${P.borderStyle === 'none' ? ' short' : ''}"></div>
    </div>
    <div class="doc-items${P.dividers ? ' has-dividers' : ''}">
      ${itemsHtml || '<p style="color:#A3A3A3;font-size:12px;font-style:italic;margin-top:24px;text-align:center">Service items will appear here.</p>'}
    </div>
    ${footerHtml}
  </div>`;
}
// ======================================
// PDF GENERATION
// ======================================

function pdfParams(theme, church) {
  const primary = themePrimary(theme, church);
  return {
    primary,
    primaryRgb: hexToRgb(primary),
    secondaryRgb: hexToRgb(theme.secondary || '#737373'),
    frameColor: mixHex(primary, '#FFFFFF', 0.55),
    hf: theme.headingFont === 'serif' ? 'times' : 'helvetica',
    bf: theme.bodyFont === 'serif' ? 'times' : 'helvetica',
    borderStyle: theme.borderStyle || 'none',
    footerStyle: theme.footerStyle || 'classic',
    align: theme.logoPosition === 'left' ? 'left' : 'center',
    nameSize: theme.headingFont === 'serif' ? 23 : 21,
    dividers: theme.borderStyle === 'line',
    gap: theme.borderStyle === 'none' ? 9.5 : 7,
  };
}

// Letter-spaced text drawn character by character (precise, unit-safe)
function spacedText(doc, txt, x, y, gapMm) {
  let cx = x;
  for (const ch of txt) {
    doc.text(ch, cx, y);
    cx += doc.getTextWidth(ch) + gapMm;
  }
}
function spacedWidth(doc, txt, gapMm) {
  let w = 0;
  for (const ch of txt) w += doc.getTextWidth(ch) + gapMm;
  return txt.length ? w - gapMm : 0;
}
function textLines(doc, txt, maxWidth) {
  return Math.max(1, Math.ceil(doc.getTextWidth(String(txt)) / maxWidth));
}

function drawPdfChrome(doc, P) {
  if (P.borderStyle === 'double') {
    const fc = hexToRgb(P.frameColor);
    doc.setDrawColor(fc[0], fc[1], fc[2]);
    doc.setLineWidth(0.25);
    doc.rect(8, 8, 194, 281);
    doc.rect(11, 11, 188, 275);
  } else if (P.borderStyle === 'line') {
    doc.setFillColor(P.primaryRgb[0], P.primaryRgb[1], P.primaryRgb[2]);
    doc.rect(0, 0, 210, 5, 'F');
    doc.rect(0, 293.5, 210, 3.5, 'F');
  }
}

function drawPdfHeader(doc, P, church, service, logo) {
  const W = 210, MX = 24, centerX = W / 2;
  const isCenter = P.align === 'center';
  let y = 30;

  if (logo) {
    let h = 22, w = (logo.width / logo.height) * h;
    if (w > 60) { w = 60; h = (logo.height / logo.width) * w; }
    const x = isCenter ? (W - w) / 2 : MX;
    try { doc.addImage(logo.dataUrl, logo.format, x, y, w, h); } catch (e) { /* skip bad logo */ }
    y += h + 7;
  } else {
    const size = 17;
    const x = isCenter ? (W - size) / 2 : MX;
    doc.setFillColor(P.primaryRgb[0], P.primaryRgb[1], P.primaryRgb[2]);
    doc.roundedRect(x, y, size, size, 3, 3, 'F');
    doc.setFont(P.hf, 'bold'); doc.setFontSize(11.5);
    doc.setTextColor(255, 255, 255);
    doc.text(initialsOf(church.name), x + size / 2, y + size / 2 + 1.6, { align: 'center' });
    y += size + 8;
  }

  doc.setFont(P.hf, 'bold');
  doc.setFontSize(P.nameSize);
  doc.setTextColor(23, 23, 23);
  const name = church.name || 'Redeem Church';
  const nameGap = 0.9;
  if (isCenter) { const w = spacedWidth(doc, name, nameGap); spacedText(doc, name, centerX - w / 2, y, nameGap); }
  else spacedText(doc, name, MX, y, nameGap);
  y += 9.5;

  if (church.tagline) {
    doc.setFont(P.bf, 'italic'); doc.setFontSize(9.5);
    doc.setTextColor(P.secondaryRgb[0], P.secondaryRgb[1], P.secondaryRgb[2]);
    if (isCenter) doc.text(church.tagline, centerX, y, { align: 'center' }); else doc.text(church.tagline, MX, y);
    y += 6;
  }

  doc.setFont(P.hf, 'bold'); doc.setFontSize(12.5);
  doc.setTextColor(P.primaryRgb[0], P.primaryRgb[1], P.primaryRgb[2]);
  const sub = 'ORDER OF SERVICE';
  const subGap = 3.1;
  if (isCenter) { const w = spacedWidth(doc, sub, subGap); spacedText(doc, sub, centerX - w / 2, y, subGap); }
  else spacedText(doc, sub, MX, y, subGap);
  y += 7.5;

  if (service.date) {
    doc.setFont(P.bf, 'normal'); doc.setFontSize(11); doc.setTextColor(64, 64, 64);
    const d = fmtLongDate(service.date);
    if (isCenter) doc.text(d, centerX, y, { align: 'center' }); else doc.text(d, MX, y);
    y += 6.5;
  }

  if (service.theme) {
    doc.setFont(P.bf, 'italic'); doc.setFontSize(12.5);
    doc.setTextColor(P.primaryRgb[0], P.primaryRgb[1], P.primaryRgb[2]);
    const th = '"' + service.theme + '"';
    if (isCenter) doc.text(th, centerX, y, { align: 'center' }); else doc.text(th, MX, y);
    y += 7;
  }

  doc.setDrawColor(224, 224, 220);
  doc.setLineWidth(0.3);
  if (P.borderStyle === 'none') doc.line(centerX - 32, y, centerX + 32, y);
  else doc.line(MX, y, W - MX, y);
  y += 9;
  return y;
}

function drawPdfContinuation(doc, P) {
  let y = 20;
  doc.setFont(P.hf, 'bold'); doc.setFontSize(8.5);
  doc.setTextColor(P.secondaryRgb[0], P.secondaryRgb[1], P.secondaryRgb[2]);
  const sub = 'ORDER OF SERVICE (CONTINUED)';
  const gap = 1.6;
  const w = spacedWidth(doc, sub, gap);
  spacedText(doc, sub, 105 - w / 2, y, gap);
  doc.setDrawColor(232, 232, 228); doc.setLineWidth(0.3);
  doc.line(24, y + 4, 186, y + 4);
  return y + 15;
}

function pdfItemHeight(doc, it, P) {
  let h = 5.6;
  if (it.requiresPerson && it.person) {
    doc.setFont(P.bf, 'normal'); doc.setFontSize(11);
    h += 4.9 * textLines(doc, it.person, 150);
  }
  if (it.description) {
    doc.setFont(P.bf, 'italic'); doc.setFontSize(9);
    h += 4.0 * textLines(doc, it.description, 140);
  }
  return h + P.gap;
}

function drawPdfItem(doc, it, y, P) {
  const W = 210, MX = 24, centerX = W / 2;
  const isCenter = P.align === 'center';

  doc.setFont(P.hf, 'bold'); doc.setFontSize(9.5);
  doc.setTextColor(P.primaryRgb[0], P.primaryRgb[1], P.primaryRgb[2]);
  const title = String(it.title || '').toUpperCase();
  const tGap = 1.15;
  if (isCenter) { const w = spacedWidth(doc, title, tGap); spacedText(doc, title, centerX - w / 2, y, tGap); }
  else spacedText(doc, title, MX, y, tGap);
  y += 5.6;

  if (it.requiresPerson && it.person) {
    doc.setFont(P.bf, 'normal'); doc.setFontSize(11); doc.setTextColor(38, 38, 38);
    if (isCenter) doc.text(String(it.person), centerX, y, { align: 'center', maxWidth: 162 });
    else doc.text(String(it.person), MX, y, { maxWidth: 162 });
    doc.setFont(P.bf, 'normal'); doc.setFontSize(11);
    y += 4.9 * textLines(doc, it.person, 150);
  }

  if (it.description) {
    doc.setFont(P.bf, 'italic'); doc.setFontSize(9);
    doc.setTextColor(P.secondaryRgb[0], P.secondaryRgb[1], P.secondaryRgb[2]);
    if (isCenter) doc.text(String(it.description), centerX, y, { align: 'center', maxWidth: 150 });
    else doc.text(String(it.description), MX, y, { maxWidth: 150 });
    doc.setFont(P.bf, 'italic'); doc.setFontSize(9);
    y += 4.0 * textLines(doc, it.description, 140);
  }
  return y;
}

function drawPdfFooter(doc, P, church, pageNo, total) {
  const W = 210, MX = 24;
  const name = church.name || 'Redeem Church';
  const website = String(church.website || '').trim();
  if (P.footerStyle === 'classic') {
    doc.setFont(P.bf, 'normal'); doc.setFontSize(8.5);
    doc.setTextColor(P.secondaryRgb[0], P.secondaryRgb[1], P.secondaryRgb[2]);
    const txt = [name, website].filter(Boolean).join('  •  ');
    doc.text('—  ' + txt + '  —', W / 2, 282, { align: 'center' });
    doc.setFontSize(8);
    doc.text('Page ' + pageNo + ' of ' + total, W / 2, 287, { align: 'center' });
  } else if (P.footerStyle === 'line') {
    doc.setDrawColor(229, 229, 225); doc.setLineWidth(0.3);
    doc.line(MX, 278, W - MX, 278);
    doc.setFont(P.bf, 'normal'); doc.setFontSize(8.5);
    doc.setTextColor(P.secondaryRgb[0], P.secondaryRgb[1], P.secondaryRgb[2]);
    doc.text(name, MX, 283);
    doc.text('Page ' + pageNo + ' of ' + total, W - MX, 283, { align: 'right' });
  } else {
    doc.setFont(P.bf, 'normal'); doc.setFontSize(8); doc.setTextColor(163, 163, 163);
    doc.text(pageNo + ' of ' + total, W / 2, 283, { align: 'center' });
  }
}

async function generateServicePdf(service, church, theme) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const P = pdfParams(theme, church);

  let logo = null;
  if (church.logo) {
    try {
      const img = await loadImage(church.logo);
      logo = {
        dataUrl: church.logo,
        width: img.width, height: img.height,
        format: String(church.logo).indexOf('image/png') === 5 || String(church.logo).indexOf('image/png') > -1 ? 'PNG' : 'JPEG',
      };
    } catch (e) { logo = null; }
  }

  drawPdfChrome(doc, P);
  let y = drawPdfHeader(doc, P, church, service, logo);

  const items = service.items || [];
  const bottomLimit = 270;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const need = pdfItemHeight(doc, it, P);
    if (y + need > bottomLimit) {
      doc.addPage();
      drawPdfChrome(doc, P);
      y = drawPdfContinuation(doc, P);
    }
    y = drawPdfItem(doc, it, y, P);
    if (P.dividers && i < items.length - 1) {
      doc.setDrawColor(239, 239, 236); doc.setLineWidth(0.25);
      doc.line(24, y - P.gap / 2, 186, y - P.gap / 2);
    }
    y += P.gap;
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawPdfFooter(doc, P, church, p, total);
  }
  return doc;
}

function pdfFileName(service, church) {
  const name = sanitizeFile(church.name || 'Redeem Church');
  const date = service.date || isoOf(new Date());
  return name + '-Order-of-Service-' + date + '.pdf';
}

function brandingSnapshot(church) {
  return {
    name: church.name, tagline: church.tagline || '', address: church.address || '',
    phone: church.phone || '', email: church.email || '', website: church.website || '',
    brandColor: church.brandColor || '#1E40AF', logo: church.logo || null,
    activeThemeId: church.activeThemeId || null,
  };
}

async function producePdf(service) {
  const church = App.church;
  const theme = getActiveTheme();
  const doc = await generateServicePdf(service, church, theme);
  const fileName = pdfFileName(service, church);
  doc.save(fileName);
  let thumbnail = null;
  try { thumbnail = await captureThumbnail(service, church, theme); } catch (e) { thumbnail = null; }
  await db.pdfHistory.add({
    id: uid(),
    serviceId: service.id,
    title: 'Order of Service',
    date: service.date,
    createdAt: new Date().toISOString(),
    service: deepClone(service),
    church: brandingSnapshot(church),
    theme: deepClone(theme),
    fileName,
    thumbnail,
  });
  toast('PDF generated and saved to history');
}

async function generateAndLogPdf() {
  const s = App.currentService;
  if (!s) return;
  if (!s.items.length) { toast('This service has no items', 'info'); return; }
  setPdfBusy(true);
  try {
    await persistService(s);
    await producePdf(s);
  } catch (err) {
    console.error(err);
    toast('Could not generate the PDF', 'error');
  } finally {
    setPdfBusy(false);
  }
}

async function downloadServicePdf(id) {
  const s = await db.services.get(id);
  if (!s) { toast('Service not found', 'error'); return; }
  try {
    await producePdf(s);
  } catch (err) {
    console.error(err);
    toast('Could not generate the PDF', 'error');
  }
}

function setPdfBusy(busy) {
  $$('.btn-generate').forEach(b => { b.disabled = busy; });
  const main = document.getElementById('btn-generate-pdf');
  if (main) {
    main.innerHTML = busy
      ? '<span class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white spin"></span>Preparing PDF'
      : '<i data-lucide="file-down" class="w-4 h-4"></i>Generate PDF';
  }
  refreshIcons();
}

async function captureThumbnail(service, church, theme) {
  if (!window.html2canvas) return null;
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:620px;pointer-events:none;';
  holder.innerHTML = renderDocHtml(service, church, theme);
  document.body.appendChild(holder);
  try {
    const paper = holder.firstElementChild;
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
    const logoImg = paper.querySelector('img');
    if (logoImg && !logoImg.complete) await new Promise(r => { logoImg.onload = logoImg.onerror = r; });
    const canvas = await html2canvas(paper, {
      scale: 240 / 620,
      backgroundColor: '#FFFFFF',
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL('image/jpeg', 0.72);
  } finally {
    document.body.removeChild(holder);
  }
}
// ======================================
// PDF HISTORY
// ======================================

async function renderHistory() {
  const records = (await db.pdfHistory.toArray())
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return `
  <div class="mb-6">
    <h1 class="text-2xl font-semibold">PDF History</h1>
    <p class="text-sm text-muted mt-1">Every generated document, ready to preview or download again.</p>
  </div>
  ${records.length
    ? '<div class="space-y-4 max-w-4xl">' + records.map(historyCardHtml).join('') + '</div>'
    : `
    <div class="card p-10 sm:p-16 text-center max-w-2xl">
      <div class="w-14 h-14 rounded-2xl bg-paper mx-auto flex items-center justify-center"><i data-lucide="history" class="w-7 h-7 text-muted"></i></div>
      <h3 class="mt-4 font-semibold text-lg">No PDFs yet</h3>
      <p class="text-sm text-muted mt-1 max-w-sm mx-auto">Generate your first order of service PDF and it will be saved here automatically.</p>
      <button class="btn btn-primary mt-6" data-action="nav" data-page="newService"><i data-lucide="plus" class="w-4 h-4"></i>Create Sunday Service</button>
    </div>`}`;
}

function historyCardHtml(rec) {
  const itemCount = (rec.service && rec.service.items || []).length;
  const themeTxt = rec.service && rec.service.theme ? ' — "' + esc(rec.service.theme) + '"' : '';
  return `
  <div class="card p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5">
    <div class="w-full sm:w-28 shrink-0">
      <div class="thumb-box">
        ${rec.thumbnail
          ? '<img src="' + rec.thumbnail + '" alt="PDF thumbnail">'
          : '<div class="w-full h-full flex items-center justify-center"><i data-lucide="file-text" class="w-6 h-6 text-muted"></i></div>'}
      </div>
    </div>
    <div class="flex-1 min-w-0 self-center">
      <p class="font-medium">Order of Service</p>
      <p class="text-sm text-muted mt-0.5 truncate">${esc(fmtLongDate(rec.date))}${themeTxt}</p>
      <p class="text-xs text-muted mt-1">Created ${timeAgo(rec.createdAt)} • ${itemCount} items</p>
    </div>
    <div class="flex items-center gap-2 flex-wrap shrink-0">
      <button class="btn btn-soft" data-action="preview-history" data-id="${rec.id}"><i data-lucide="eye" class="w-4 h-4"></i>Preview</button>
      <button class="btn btn-ghost" data-action="download-history" data-id="${rec.id}"><i data-lucide="download" class="w-4 h-4"></i>Download</button>
      <button class="icon-btn danger" data-action="delete-history" data-id="${rec.id}" aria-label="Delete record"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </div>
  </div>`;
}

async function previewHistoryRecord(id) {
  const rec = await db.pdfHistory.get(id);
  if (!rec) { toast('Record not found', 'error'); return; }
  App.pdfPreviewId = id;
  $('#pdf-modal-title').textContent = 'Order of Service';
  $('#pdf-modal-subtitle').textContent = fmtLongDate(rec.date) + ' • Created ' + timeAgo(rec.createdAt);
  $('#pdf-modal-body').innerHTML = renderDocHtml(rec.service || {}, rec.church || {}, rec.theme || THEME_PRESETS[0]);
  openModal('modal-pdf');
}

async function downloadHistoryPdf(id) {
  const rec = await db.pdfHistory.get(id);
  if (!rec) { toast('Record not found', 'error'); return; }
  try {
    const doc = await generateServicePdf(rec.service, rec.church, rec.theme);
    doc.save(rec.fileName || pdfFileName(rec.service, rec.church));
    toast('PDF downloaded');
  } catch (err) {
    console.error(err);
    toast('Could not regenerate this PDF', 'error');
  }
}

async function deleteHistoryRecord(id) {
  const rec = await db.pdfHistory.get(id);
  if (!rec) return;
  const ok = await confirmDialog({
    title: 'Delete this record?',
    text: 'The history entry will be removed. The saved Sunday service itself is not affected.',
    confirmText: 'Delete',
  });
  if (!ok) return;
  await db.pdfHistory.delete(id);
  if (App.pdfPreviewId === id) closeModal('modal-pdf');
  toast('History record deleted');
  showPage('history');
}

// ======================================
// SAVED SUNDAYS
// ======================================

async function renderSundays() {
  const services = (await db.services.toArray())
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return `
  <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-semibold">Saved Sundays</h1>
      <p class="text-sm text-muted mt-1">Open a service to keep editing or regenerate its PDF.</p>
    </div>
    <button class="btn btn-primary" data-action="nav" data-page="newService"><i data-lucide="plus" class="w-4 h-4"></i>New Sunday Service</button>
  </div>
  ${services.length
    ? '<div class="card max-w-4xl">' + services.map(sundayRowHtml).join('') + '</div>'
    : `
    <div class="card p-10 sm:p-16 text-center max-w-2xl">
      <div class="w-14 h-14 rounded-2xl bg-paper mx-auto flex items-center justify-center"><i data-lucide="calendar-days" class="w-7 h-7 text-muted"></i></div>
      <h3 class="mt-4 font-semibold text-lg">No saved Sundays yet</h3>
      <p class="text-sm text-muted mt-1 max-w-sm mx-auto">Create a Sunday service, assign people to items and save it here for future editing.</p>
      <button class="btn btn-primary mt-6" data-action="nav" data-page="newService"><i data-lucide="plus" class="w-4 h-4"></i>Create Sunday Service</button>
    </div>`}`;
}

function sundayRowHtml(s) {
  const md = fmtMonthDay(s.date);
  const title = s.theme || s.templateName || 'Untitled service';
  return `
  <div class="flex flex-col sm:flex-row sm:items-center gap-4 px-5 sm:px-6 py-4 border-b border-line last:border-b-0">
    <div class="w-11 h-11 rounded-xl bg-accent/10 text-accent flex flex-col items-center justify-center shrink-0 leading-none">
      <span class="text-[10px] font-semibold">${esc(md.month)}</span>
      <span class="text-base font-semibold mt-0.5">${esc(md.day)}</span>
    </div>
    <div class="flex-1 min-w-0">
      <p class="font-medium truncate">${esc(title)}</p>
      <p class="text-sm text-muted mt-0.5 truncate">${esc(fmtLongDate(s.date))}${s.templateName ? ' • ' + esc(s.templateName) : ''}</p>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <button class="btn btn-soft" data-action="open-service" data-id="${s.id}">Open</button>
      <button class="icon-btn" data-action="download-service-pdf" data-id="${s.id}" aria-label="Download PDF" title="Download PDF"><i data-lucide="file-down" class="w-4 h-4"></i></button>
      <button class="icon-btn danger" data-action="delete-service" data-id="${s.id}" aria-label="Delete service"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </div>
  </div>`;
}

async function deleteSavedService(id) {
  const s = await db.services.get(id);
  if (!s) return;
  const ok = await confirmDialog({
    title: 'Delete this Sunday?',
    text: '"' + (s.theme || s.templateName || 'This service') + '" (' + fmtLongDate(s.date) + ') will be removed. PDF history is kept.',
    confirmText: 'Delete',
  });
  if (!ok) return;
  await db.services.delete(id);
  if (App.currentService && App.currentService.id === id) App.currentService = null;
  toast('Sunday service deleted');
  showPage('sundays');
}

// ======================================
// DASHBOARD
// ======================================

async function renderDashboard() {
  const [templates, services, historyCount, themesCount] = await Promise.all([
    db.templates.count(), db.services.count(), db.pdfHistory.count(), db.themes.count(),
  ]);
  const recent = (await db.services.toArray())
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 5);

  const stats = [
    { label: 'Templates', value: templates, icon: 'layout-template', page: 'templates' },
    { label: 'Saved Sundays', value: services, icon: 'calendar-days', page: 'sundays' },
    { label: 'PDF Documents', value: historyCount, icon: 'file-text', page: 'history' },
    { label: 'Themes', value: themesCount, icon: 'palette', page: 'themes' },
  ];

  return `
  <div class="mb-6">
    <p class="text-sm text-muted">${greeting()},</p>
    <h1 class="text-2xl font-semibold mt-1">${esc((App.church && App.church.name) || 'Redeem Church')}</h1>
    <p class="text-sm text-muted mt-1">Create and manage your order of service.</p>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
    <button class="card p-5 text-left hover:border-accent transition-colors group" data-action="nav" data-page="newService">
      <div class="flex items-center gap-4">
        <div class="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><i data-lucide="calendar-plus" class="w-5 h-5"></i></div>
        <div class="min-w-0">
          <p class="font-semibold">Create Sunday Service</p>
          <p class="text-sm text-muted mt-0.5">Start from a template and assign people.</p>
        </div>
        <i data-lucide="arrow-right" class="w-4 h-4 text-muted ml-auto shrink-0 group-hover:text-accent"></i>
      </div>
    </button>
    <button class="card p-5 text-left hover:border-accent transition-colors group" data-action="open-template-editor">
      <div class="flex items-center gap-4">
        <div class="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><i data-lucide="layout-template" class="w-5 h-5"></i></div>
        <div class="min-w-0">
          <p class="font-semibold">Create Template</p>
          <p class="text-sm text-muted mt-0.5">Design a reusable order of service.</p>
        </div>
        <i data-lucide="arrow-right" class="w-4 h-4 text-muted ml-auto shrink-0 group-hover:text-accent"></i>
      </div>
    </button>
  </div>

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
    ${stats.map(st => `
    <button class="card p-5 text-left hover:border-accent transition-colors" data-action="nav" data-page="${st.page}">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-muted uppercase tracking-wide">${st.label}</span>
        <i data-lucide="${st.icon}" class="w-4 h-4 text-muted"></i>
      </div>
      <p class="text-3xl font-semibold mt-2">${st.value}</p>
    </button>`).join('')}
  </div>

  <section class="card mt-6">
    <div class="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-line">
      <h2 class="text-base font-semibold">Recent services</h2>
      <button class="btn btn-ghost py-2 px-3 text-xs" data-action="nav" data-page="sundays">View all</button>
    </div>
    ${recent.length ? recent.map(s => {
      const md = fmtMonthDay(s.date);
      return `
      <div class="flex flex-col sm:flex-row sm:items-center gap-4 px-5 sm:px-6 py-4 border-b border-line last:border-b-0">
        <div class="w-11 h-11 rounded-xl bg-accent/10 text-accent flex flex-col items-center justify-center shrink-0 leading-none">
          <span class="text-[10px] font-semibold">${esc(md.month)}</span>
          <span class="text-base font-semibold mt-0.5">${esc(md.day)}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium truncate">${esc(s.theme || s.templateName || 'Untitled service')}</p>
          <p class="text-sm text-muted mt-0.5 truncate">${esc(fmtLongDate(s.date))}${s.templateName ? ' • ' + esc(s.templateName) : ''}</p>
        </div>
        <div class="flex gap-2 shrink-0">
          <button class="btn btn-soft py-2 px-3 text-xs" data-action="open-service" data-id="${s.id}">View</button>
          <button class="btn btn-ghost py-2 px-3 text-xs" data-action="download-service-pdf" data-id="${s.id}">Download</button>
        </div>
      </div>`;
    }).join('') : `
      <div class="px-5 sm:px-6 py-10 text-center">
        <div class="w-12 h-12 rounded-2xl bg-paper mx-auto flex items-center justify-center"><i data-lucide="church" class="w-6 h-6 text-muted"></i></div>
        <p class="font-medium mt-3">No services yet</p>
        <p class="text-sm text-muted mt-1">Create your first Sunday service to see it here.</p>
        <button class="btn btn-primary mt-5" data-action="nav" data-page="newService"><i data-lucide="plus" class="w-4 h-4"></i>Create Sunday Service</button>
      </div>`}
  </section>`;
}
// ======================================
// THEMES
// ======================================

function miniPaperHtml(theme, church) {
  const primary = themePrimary(theme, church);
  const hf = theme.headingFont === 'serif' ? "'Playfair Display', Georgia, serif" : "'Inter', sans-serif";
  const bf = theme.bodyFont === 'serif' ? "'Lora', Georgia, serif" : "'Inter', sans-serif";
  const chrome = theme.borderStyle === 'double'
    ? '<div class="pm-frame"></div>'
    : theme.borderStyle === 'line' ? '<div class="pm-topbar"></div>' : '';
  const footerTxt = theme.footerStyle === 'minimal'
    ? 'ORDER OF SERVICE'
    : esc(String((church && church.website) || (church && church.name) || 'Redeem Church').slice(0, 24));
  return `
  <div class="paper-mini" style="--primary:${primary};--hf:${hf};--bf:${bf}">
    ${chrome}
    <div class="pm-logo">${esc(initialsOf((church && church.name) || 'R'))}</div>
    <div class="pm-name">${esc(String((church && church.name) || 'Redeem Church').slice(0, 22))}</div>
    <div class="pm-sub">ORDER OF SERVICE</div>
    <div class="pm-rule"></div>
    <div class="pm-item"><div class="pm-item-title">Opening Prayer</div><div class="pm-item-person"></div></div>
    <div class="pm-item"><div class="pm-item-title">Praise &amp; Worship</div><div class="pm-item-person w2"></div></div>
    <div class="pm-item"><div class="pm-item-title">Sermon</div><div class="pm-item-person w3"></div></div>
    <div class="pm-footer">${footerTxt}</div>
  </div>`;
}

function themeCardHtml(theme, church, activeId) {
  const active = theme.id === activeId;
  return `
  <div class="card p-4 sm:p-5 relative cursor-pointer transition-colors ${active ? 'border-accent' : 'hover:border-accent/60'}" data-action="set-theme" data-id="${theme.id}" title="Set as active theme">
    <div class="pt-1">${miniPaperHtml(theme, church)}</div>
    <div class="mt-4 flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="font-semibold truncate">${esc(theme.name)}</p>
        <p class="text-xs text-muted mt-0.5">${theme.builtIn ? 'Built-in' : 'Custom'} • ${theme.headingFont === 'serif' ? 'Serif' : 'Sans'} headings</p>
      </div>
      ${active ? '<span class="chip chip-accent shrink-0">Active</span>' : ''}
    </div>
    ${!theme.builtIn ? `
    <div class="absolute top-2.5 right-2.5 flex gap-1">
      <button class="icon-btn bg-white border border-line" data-action="edit-theme" data-id="${theme.id}" aria-label="Edit ${esc(theme.name)}"><i data-lucide="pencil" class="w-4 h-4"></i></button>
      <button class="icon-btn danger bg-white border border-line" data-action="delete-theme" data-id="${theme.id}" aria-label="Delete ${esc(theme.name)}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </div>` : ''}
  </div>`;
}

async function renderThemes() {
  App.themeCache = await db.themes.toArray();
  const activeId = (App.church && App.church.activeThemeId) || '';
  return `
  <div class="mb-6">
    <h1 class="text-2xl font-semibold">Themes</h1>
    <p class="text-sm text-muted mt-1">Choose how the live preview and every PDF looks. Click a theme to activate it.</p>
  </div>
  <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
    ${App.themeCache.map(t => themeCardHtml(t, App.church, activeId)).join('')}
    <button class="card p-4 sm:p-5 border-dashed hover:border-accent transition-colors flex flex-col items-center justify-center text-center min-h-[280px]" data-action="new-theme">
      <div class="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center"><i data-lucide="plus" class="w-5 h-5"></i></div>
      <p class="font-semibold mt-3">Create Theme</p>
      <p class="text-xs text-muted mt-1 px-2">Custom colors, fonts and layout</p>
    </button>
  </div>`;
}

async function setActiveTheme(id) {
  const theme = (App.themeCache || []).find(t => t.id === id);
  if (!theme) return;
  if (App.church.activeThemeId === id) { toast(theme.name + ' is already active', 'info'); return; }
  App.church.activeThemeId = id;
  await db.church.put(App.church);
  toast(theme.name + ' theme applied');
  showPage('themes');
}

function setSeg(groupId, value) {
  const seg = document.getElementById(groupId);
  if (!seg) return;
  $$('.seg-btn', seg).forEach(b => b.classList.toggle('active', b.dataset.value === value));
}
function getSeg(groupId) {
  const seg = document.getElementById(groupId);
  if (!seg) return null;
  const active = $('.seg-btn.active', seg);
  return active ? active.dataset.value : null;
}

async function openThemeEditor(id) {
  const theme = id ? await db.themes.get(id) : null;
  App.themeEditorId = theme ? theme.id : null;
  $('#theme-modal-title').textContent = theme ? 'Edit Theme' : 'Create Theme';
  $('#th-name').value = theme ? theme.name : '';
  const primary = theme ? theme.primary : '#1F3A5F';
  const secondary = theme ? (theme.secondary || '#5C6670') : '#5C6670';
  $('#th-primary').value = primary;
  $('#th-secondary').value = secondary;
  const pHex = document.querySelector('[data-color-for="th-primary"]');
  const sHex = document.querySelector('[data-color-for="th-secondary"]');
  if (pHex) pHex.value = primary;
  if (sHex) sHex.value = secondary;
  $('#th-heading').value = theme ? theme.headingFont : 'serif';
  $('#th-body').value = theme ? theme.bodyFont : 'serif';
  setSeg('th-logo-position', theme ? theme.logoPosition || 'center' : 'center');
  setSeg('th-border', theme ? theme.borderStyle || 'double' : 'double');
  setSeg('th-footer', theme ? theme.footerStyle || 'classic' : 'classic');
  openModal('modal-theme');
  setTimeout(() => { try { $('#th-name').focus(); } catch (e) {} }, 120);
}

async function saveThemeFromModal() {
  const name = String($('#th-name').value || '').trim();
  if (!name) { toast('Please give the theme a name', 'info'); return; }
  const existing = App.themeEditorId ? await db.themes.get(App.themeEditorId) : null;
  const theme = {
    id: App.themeEditorId || uid(),
    name,
    builtIn: false,
    primary: $('#th-primary').value,
    secondary: $('#th-secondary').value,
    headingFont: $('#th-heading').value,
    bodyFont: $('#th-body').value,
    logoPosition: getSeg('th-logo-position') || 'center',
    borderStyle: getSeg('th-border') || 'double',
    footerStyle: getSeg('th-footer') || 'classic',
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
  };
  if (existing) await db.themes.put(theme); else await db.themes.add(theme);
  await loadThemes();
  closeModal('modal-theme');
  toast('Theme saved');
  showPage('themes');
}

async function deleteTheme(id) {
  const theme = await db.themes.get(id);
  if (!theme) return;
  const ok = await confirmDialog({
    title: 'Delete theme?',
    text: '"' + theme.name + '" will be removed.',
    confirmText: 'Delete',
  });
  if (!ok) return;
  await db.themes.delete(id);
  if (App.church.activeThemeId === id) {
    App.church.activeThemeId = 'theme-classic';
    await db.church.put(App.church);
  }
  await loadThemes();
  toast('Theme deleted');
  showPage('themes');
}

// ======================================
// ACCOUNT
// ======================================

async function renderAccount() {
  const c = App.church || {};
  return `
  <div class="mb-6">
    <h1 class="text-2xl font-semibold">Account</h1>
    <p class="text-sm text-muted mt-1">This device's local workspace.</p>
  </div>

  <div class="card p-6 sm:p-8 max-w-md">
    <div class="flex flex-col items-center text-center">
      <div class="w-16 h-16 rounded-2xl overflow-hidden bg-accent/10 text-accent flex items-center justify-center font-serif text-2xl font-semibold shrink-0">
        ${c.logo ? '<img src="' + c.logo + '" alt="' + esc(c.name) + ' logo" class="w-full h-full object-cover">' : esc(initialsOf(c.name))}
      </div>
      <h2 class="text-lg font-semibold mt-4">${esc(c.name || 'Redeem Church')}</h2>
      <p class="text-sm text-muted mt-0.5 break-all">${esc(c.email || 'No email set — add one in Church Settings')}</p>
      <span class="chip mt-3">Local workspace</span>
    </div>

    <div class="mt-6 divide-y divide-line border-y border-line text-sm">
      <div class="flex items-center justify-between py-3">
        <span class="text-muted flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4"></i>Account created</span>
        <span class="font-medium">${esc(fmtMonthYear(c.createdAt))}</span>
      </div>
      <div class="flex items-center justify-between py-3">
        <span class="text-muted flex items-center gap-2"><i data-lucide="database" class="w-4 h-4"></i>Storage used</span>
        <span class="font-medium" id="acc-storage">—</span>
      </div>
      <div class="flex items-center justify-between py-3">
        <span class="text-muted flex items-center gap-2"><i data-lucide="shield-check" class="w-4 h-4"></i>Data location</span>
        <span class="font-medium">This browser</span>
      </div>
    </div>

    <div class="mt-6 flex flex-col sm:flex-row gap-3">
      <button class="btn btn-ghost flex-1" data-action="nav" data-page="settings"><i data-lucide="settings" class="w-4 h-4"></i>Account Settings</button>
      <button class="btn btn-danger flex-1" data-action="sign-out"><i data-lucide="log-out" class="w-4 h-4"></i>Sign Out</button>
    </div>
  </div>

  <div class="mt-4 max-w-md">
    <div class="flex gap-3 p-4 rounded-xl bg-paper border border-line text-sm text-muted">
      <i data-lucide="info" class="w-4 h-4 shrink-0 mt-0.5"></i>
      <p>Cloud accounts with sign-in across phone, laptop and tablet are on the roadmap (Supabase). Today, everything is stored safely on this device and works offline.</p>
    </div>
  </div>`;
}

function afterAccount() {
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(est => {
      const el = document.getElementById('acc-storage');
      if (el && est && est.usage != null) el.textContent = (est.usage / 1048576).toFixed(1) + ' MB';
    }).catch(() => {});
  }
}

async function signOut() {
  const ok = await confirmDialog({
    title: 'Sign out and clear this workspace?',
    text: 'This removes all templates, services, themes, PDF history and branding stored in this browser. This cannot be undone.',
    confirmText: 'Clear and sign out',
  });
  if (!ok) return;
  try { await db.delete(); } catch (e) { /* ignore */ }
  window.location.reload();
}

// ======================================
// MODALS
// ======================================

function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('show')));
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('show');
  m.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    if (m.classList.contains('show')) return; // re-opened meanwhile
    m.classList.add('hidden');
    if (!$('.modal.show')) document.body.style.overflow = '';
  }, 210);
}

function closeAllModals() {
  ['modal-item', 'modal-theme', 'modal-pdf'].forEach(closeModal);
}

// ======================================
// NOTIFICATIONS
// ======================================

const Toast = (window.Swal && Swal.mixin) ? Swal.mixin({
  toast: true,
  showConfirmButton: false,
  timer: 2600,
  timerProgressBar: true,
  didOpen: (t) => {
    t.addEventListener('mouseenter', Swal.stopTimer);
    t.addEventListener('mouseleave', Swal.resumeTimer);
  },
}) : null;

function toast(title, icon = 'success') {
  if (!Toast) return;
  Toast.fire({ icon, title, position: window.innerWidth < 640 ? 'bottom' : 'top-end' });
}

async function confirmDialog(opts) {
  const { title, text, confirmText = 'Confirm' } = opts || {};
  if (!window.Swal) return window.confirm(title + '\n' + text);
  const res = await Swal.fire({
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel',
    confirmButtonColor: (App.church && App.church.brandColor) || '#1E40AF',
    cancelButtonColor: '#737373',
    focusCancel: true,
  });
  return res.isConfirmed;
}

// ======================================
// NAVIGATION
// ======================================

const VIEWS = {
  dashboard:      { render: renderDashboard },
  templates:      { render: renderTemplates },
  templateEditor: { render: renderTemplateEditor, after: initTemplateSortable },
  newService:     { render: renderNewService, after: afterNewService },
  serviceEditor:  { render: renderServiceEditor, after: afterServiceEditor },
  sundays:        { render: renderSundays },
  history:        { render: renderHistory },
  themes:         { render: renderThemes },
  settings:       { render: renderSettings },
  account:        { render: renderAccount, after: afterAccount },
};

const BOTTOM_SHORT = { dashboard: 'Home', templates: 'Templates', newService: 'New', history: 'History', settings: 'Settings' };

async function showPage(page) {
  App.page = page;
  closeDrawer();
  destroyFlatpickrs();
  await renderView();
  updateNavActive();
  window.scrollTo(0, 0);
}

async function renderView() {
  const view = VIEWS[App.page] || VIEWS.dashboard;
  const html = await view.render();
  const el = document.getElementById('view');
  el.innerHTML = '<div class="view-enter">' + html + '</div>';
  if (view.after) { try { view.after(); } catch (e) { console.error(e); } }
  refreshIcons();
}

function destroyFlatpickrs() {
  App.flatpickrs.forEach(fp => { try { fp.destroy(); } catch (e) {} });
  App.flatpickrs = [];
}

function buildNav() {
  const items = NAV_ITEMS.map(n =>
    '<button class="nav-item" data-action="nav" data-page="' + n.id + '"><i data-lucide="' + n.icon + '"></i><span>' + esc(n.label) + '</span></button>').join('');
  $('#side-nav').innerHTML = items;
  $('#drawer-nav').innerHTML = items;
  $('#bottom-nav-inner').innerHTML = BOTTOM_NAV.map(id => {
    const n = NAV_ITEMS.find(x => x.id === id) || {};
    return `
    <button class="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-muted transition-colors" data-action="nav" data-page="${id}" data-bottom="${id}" aria-label="${esc(n.label || id)}">
      <i data-lucide="${n.icon}" class="w-5 h-5"></i><span>${esc(BOTTOM_SHORT[id] || n.label || id)}</span>
    </button>`;
  }).join('');
}

function updateNavActive() {
  const target = NAV_PARENT[App.page] || App.page;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === target));
  $$('[data-bottom]').forEach(b => {
    const active = b.dataset.bottom === target;
    b.classList.toggle('text-accent', active);
    b.classList.toggle('text-muted', !active);
  });
}

function openDrawer() {
  $('#drawer-backdrop').classList.remove('hidden');
  $('#drawer').classList.remove('-translate-x-full');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  const bd = $('#drawer-backdrop'), dr = $('#drawer');
  if (bd) bd.classList.add('hidden');
  if (dr) dr.classList.add('-translate-x-full');
  if (!$('.modal.show')) document.body.style.overflow = '';
}

// ======================================
// GLOBAL EVENTS
// ======================================

function bindGlobalEvents() {
  document.addEventListener('click', (e) => {
    // Close modal via backdrop / close buttons
    const closer = e.target.closest('[data-close-modal]');
    if (closer) {
      const m = closer.closest('.modal');
      if (m) closeModal(m.id);
      return;
    }
    // Segmented controls
    const segBtn = e.target.closest('.seg-btn');
    if (segBtn) {
      const seg = segBtn.closest('.seg');
      $$('.seg-btn', seg).forEach(b => b.classList.remove('active'));
      segBtn.classList.add('active');
      return;
    }
    // Drawer backdrop
    if (e.target.id === 'drawer-backdrop') { closeDrawer(); return; }

    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;
    const id = t.dataset.id;
    const ACTIONS = {
      'nav':                      () => showPage(t.dataset.page),
      'open-menu':                () => openDrawer(),
      'close-menu':               () => closeDrawer(),
      'open-template-editor':     () => openTemplateEditor(id || null),
      'use-template':             () => { App.preselectTemplateId = id; showPage('newService'); },
      'duplicate-template':       () => duplicateTemplate(id),
      'delete-template':          () => deleteTemplate(id),
      'save-template':            () => saveTemplate(),
      'back-templates':           () => showPage('templates'),
      'add-item':                 () => openItemModal(null),
      'edit-item':                () => openItemModal((App.currentTemplate && App.currentTemplate.items.find(i => i.id === id)) || null),
      'remove-item':              () => removeTemplateItem(id),
      'save-item':                () => saveItemFromModal(),
      'continue-new-service':     () => continueNewService(),
      'save-service':             () => saveService(),
      'generate-pdf':             () => generateAndLogPdf(),
      'open-service':             () => openSavedService(id),
      'download-service-pdf':     () => downloadServicePdf(id),
      'delete-service':           () => deleteSavedService(id),
      'preview-history':          () => previewHistoryRecord(id),
      'download-history':         () => downloadHistoryPdf(id),
      'download-history-current': () => { if (App.pdfPreviewId) downloadHistoryPdf(App.pdfPreviewId); },
      'delete-history':           () => deleteHistoryRecord(id),
      'set-theme':                () => setActiveTheme(id),
      'new-theme':                () => openThemeEditor(null),
      'edit-theme':               () => openThemeEditor(id),
      'delete-theme':             () => deleteTheme(id),
      'save-theme':               () => saveThemeFromModal(),
      'logo-upload':              () => { const f = document.getElementById('logo-file'); if (f) f.click(); },
      'logo-remove':              () => { App.church.logo = null; showPage('settings'); },
      'save-settings':            () => saveChurchSettings(),
      'sign-out':                 () => signOut(),
    };
    const fn = ACTIONS[action];
    if (fn) fn();
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el || !el.id && !el.dataset) return;

    // Service editor live fields
    if (el.dataset.person !== undefined && el.dataset.person && App.currentService) {
      const it = App.currentService.items.find(i => i.id === el.dataset.person);
      if (it) { it.person = el.value; refreshLivePreview(); }
      return;
    }
    if (el.dataset.itemDesc !== undefined && el.dataset.itemDesc && App.currentService) {
      const it = App.currentService.items.find(i => i.id === el.dataset.itemDesc);
      if (it) { it.description = el.value; refreshLivePreview(); }
      return;
    }
    if (el.dataset.live && App.currentService) {
      App.currentService[el.dataset.live] = el.value;
      refreshLivePreview();
      return;
    }

    // Church settings live fields
    if (el.dataset.setting && App.church) {
      App.church[el.dataset.setting] = el.value;
      if (el.dataset.setting === 'name') updateBranding();
      return;
    }
    if (el.id === 'set-color') {
      App.church.brandColor = el.value;
      const hex = document.getElementById('set-color-hex');
      if (hex) hex.value = el.value;
      applyAccent();
      return;
    }
    if (el.id === 'set-color-hex') {
      const v = String(el.value || '').trim();
      if (isValidHex(v)) {
        const hex = v.startsWith('#') ? v : '#' + v;
        App.church.brandColor = hex;
        const picker = document.getElementById('set-color');
        if (picker) picker.value = hex;
        applyAccent();
      }
      return;
    }

    // Theme modal color pairs
    if (el.classList && el.classList.contains('color-hex')) {
      const forId = el.dataset.colorFor;
      const v = String(el.value || '').trim();
      if (isValidHex(v)) {
        const hex = v.startsWith('#') ? v : '#' + v;
        const picker = document.getElementById(forId);
        if (picker) picker.value = hex;
      }
      return;
    }
    if (el.id === 'th-primary' || el.id === 'th-secondary') {
      const hexInput = document.querySelector('[data-color-for="' + el.id + '"]');
      if (hexInput) hexInput.value = el.value;
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'logo-file') {
      handleLogoFile(el.files && el.files[0]);
      el.value = '';
      return;
    }
    if (el.id === 'se-theme-select' && App.church) {
      App.church.activeThemeId = el.value;
      db.church.put(App.church)
        .then(() => loadThemes())
        .then(() => refreshLivePreview())
        .catch(() => {});
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeAllModals(); closeDrawer(); }
  });
}

// ======================================
// INITIALIZATION
// ======================================

async function boot() {
  try {
    await db.open();
    await seedIfEmpty();
    App.church = await db.church.get('main');
    await loadThemes();
    applyAccent();
    updateBranding();
    buildNav();
    bindGlobalEvents();
    await showPage('dashboard');
    document.getElementById('app').classList.remove('hidden');
    await new Promise(r => setTimeout(r, 550));
    const ls = document.getElementById('loading-screen');
    if (ls) {
      ls.style.opacity = '0';
      setTimeout(() => { ls.remove(); }, 520);
    }
  } catch (err) {
    console.error(err);
    fatalScreen(err);
  }
}

function fatalScreen(err) {
  const ls = document.getElementById('loading-screen');
  if (!ls) return;
  ls.innerHTML = `
    <div class="text-center max-w-sm px-6">
      <div class="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto"><i data-lucide="alert-circle" class="w-7 h-7"></i></div>
      <h2 class="text-lg font-semibold mt-4">Could not start the app</h2>
      <p class="text-sm text-muted mt-2">Your browser may be blocking local storage (try a normal window instead of private mode), or a required library failed to load.</p>
      <p class="text-xs text-muted mt-3 break-all">${esc(String((err && err.message) || err))}</p>
      <button class="btn btn-primary mt-6" onclick="window.location.reload()">Try Again</button>
    </div>`;
  refreshIcons();
}

window.addEventListener('DOMContentLoaded', () => { boot(); });

