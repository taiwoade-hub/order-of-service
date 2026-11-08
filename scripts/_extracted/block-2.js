
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
  itemModalMode: 'template', // 'template' or 'service'
  themeEditorId: null,       // theme modal target id (null = new)
  pdfPreviewId: null,        // history record in preview modal
  flatpickrs: [],            // live flatpickr instances
  sortableInstance: null,    // Template Sortable instance
  serviceSortableInstance: null, // Service Sortable instance
  searchQuery: '',           // search filter
  previewScale: 1.0,         // live preview scale
};

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',          icon: 'home' },
  { id: 'templates',   label: 'Templates',          icon: 'layout-template' },
  { id: 'newService',  label: 'New Sunday Service', icon: 'calendar-plus' },
  { id: 'sundays',     label: 'Saved Sundays',      icon: 'calendar-days' },
  { id: 'history',     label: 'PDF History',        icon: 'history' },
  { id: 'themes',      label: 'Themes',             icon: 'palette' },
  { id: 'settings',    label: 'Church Settings',    icon: 'settings' },
  { id: 'account',     label: 'Account & Backup',   icon: 'user' },
];
const BOTTOM_NAV = ['dashboard', 'templates', 'newService', 'history', 'settings'];
const NAV_PARENT = { templateEditor: 'templates', serviceEditor: 'sundays' };

const THEME_PRESETS = [
  { id: 'theme-classic', name: 'Classic Liturgy', builtIn: true, primary: '#1F3A5F', secondary: '#5C6670',
    headingFont: 'serif', bodyFont: 'serif', logoPosition: 'center', borderStyle: 'double', footerStyle: 'classic' },
  { id: 'theme-modern', name: 'Modern Clean', builtIn: true, useBrandColor: true, primary: '#1E3A8A', secondary: '#525252',
    headingFont: 'sans', bodyFont: 'sans', logoPosition: 'center', borderStyle: 'line', footerStyle: 'line' },
  { id: 'theme-minimal', name: 'Minimalist', builtIn: true, primary: '#171717', secondary: '#737373',
    headingFont: 'sans', bodyFont: 'sans', logoPosition: 'center', borderStyle: 'none', footerStyle: 'minimal' },
];

const DEFAULT_TEMPLATES = [
  { name: 'Sunday Worship Service', description: 'Standard Sunday celebration with praise, sermon and ministration', items: [
    ['Opening Prayer', '', true],
    ['Praise & Worship', 'Congregational worship session', true],
    ['Scripture Reading', 'Selected chapter of the day', true],
    ['Choir Ministration', 'Special anthem by the choir', true],
    ['Congregational Prayer', '', true],
    ['Sermon', 'Word ministration and message', true],
    ['Offering & Tithes', '', true],
    ['Announcements', 'Weekly bulletins, events and welcome to first-timers', false],
    ['Benediction', 'Closing blessing', true],
  ]},
  { name: 'Thanksgiving Celebration', description: 'Service of praise, testimonies and celebration of blessings', items: [
    ['Opening Prayer', '', true],
    ['Praise & Worship', 'Joyful thanksgiving praise', true],
    ['Thanksgiving Testimonies', 'Members share testimonies of God\'s goodness', true],
    ['Scripture Reading', '', true],
    ['Special Ministration', '', true],
    ['Sermon', 'Message of gratitude and faith', true],
    ['Thanksgiving Offering', 'Harvest offering and seed', true],
    ['Announcements', 'Upcoming programs and notifications', false],
    ['Benediction', '', true],
  ]},
  { name: 'Youth Ignite Service', description: 'Dynamic, creative service led by the youth ministry', items: [
    ['Opening Prayer', '', true],
    ['Praise & Worship', 'Energetic youth band ministration', true],
    ['Scripture Reading', '', true],
    ['Youth Creative Presentation', 'Drama, spoken word or choreography', true],
    ['Choir Ministration', '', true],
    ['Sermon', 'Youth-focused teaching and discussion', true],
    ['Offering', '', true],
    ['Announcements', '', false],
    ['Benediction', '', true],
  ]},
  { name: 'Children & Family Service', description: 'Interactive service structured for young worshippers', items: [
    ['Welcome & Opening Prayer', '', true],
    ['Kids Praise & Worship', 'Action songs and praise', true],
    ['Memory Verse Recitation', '', true],
    ['Illustrated Bible Story', 'Engaging audiovisual lesson', true],
    ['Bible Quiz & Games', '', true],
    ['Offering & Dedication', '', true],
    ['Closing Prayer & Blessing', '', true],
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

function safeImgSrc(src) {
  if (!src || typeof src !== 'string') return '';
  src = src.trim();
  // Safe data URIs for images
  if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(src)) {
    return src;
  }
  // Safe relative paths starting with /
  if (/^\/[a-zA-Z0-9_\-\.\/]+$/.test(src)) {
    return src;
  }
  // Safe https URLs
  if (/^https:\/\/[a-zA-Z0-9_\-\.:@]+(\S*)?$/i.test(src)) {
    return src;
  }
  return '';
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function isoOf(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return new Date().toISOString().split('T')[0];
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}

function dateOf(iso) {
  if (!iso) return new Date();
  const cleanIso = String(iso).split('T')[0];
  const d = new Date(cleanIso + 'T12:00:00');
  return isNaN(d.getTime()) ? new Date() : d;
}

function fmtLongDate(iso) {
  if (!iso) return '';
  try {
    const d = dateOf(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return String(iso); }
}

function fmtShortDate(iso) {
  if (!iso) return '';
  try {
    const d = dateOf(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) { return String(iso); }
}

function fmtMonthDay(iso) {
  if (!iso) return { month: '', day: '' };
  try {
    const d = dateOf(iso);
    if (isNaN(d.getTime())) return { month: '', day: '' };
    return { month: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(), day: String(d.getDate()).padStart(2, '0') };
  } catch (e) {
    return { month: '', day: '' };
  }
}

function fmtMonthYear(iso) {
  if (!iso) return '';
  try {
    const d = dateOf(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  } catch (e) { return ''; }
}

function timeAgo(iso) {
  if (!iso) return '';
  try {
    const now = new Date(); const then = new Date(iso);
    if (isNaN(then.getTime())) return '';
    const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
                             new Date(then.getFullYear(), then.getMonth(), then.getDate())) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return days + ' days ago';
    if (days < 30) return Math.floor(days / 7) + (days < 14 ? ' wk ago' : ' wks ago');
    return fmtShortDate(isoOf(then));
  } catch (e) { return ''; }
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
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return [30, 58, 138];
  const n = parseInt(m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function isValidHex(hex) {
  const m = String(hex || '').replace('#', '').trim();
  return /^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/.test(m);
}

function mixHex(hex, white, ratio) {
  const a = hexToRgb(hex), b = hexToRgb(white);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * ratio));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

function initialsOf(name) {
  const words = String(name || 'O').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'O';
}

function sanitizeFile(s) {
  return String(s || '').trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'document';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('No image src'));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      img.src = '';
      reject(new Error('Image load timeout'));
    }, 4000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('Image failed to load')); };
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
  if (window.lucide && lucide.createIcons) {
    try { lucide.createIcons(); } catch (e) { /* non-fatal */ }
  }
}

// Effective theme used by preview + PDF
function getActiveTheme() {
  const id = App.church && App.church.activeThemeId;
  const list = App.themeCache || [];
  return list.find(t => t.id === id) || list[0] || deepClone(THEME_PRESETS[0]);
}

function themePrimary(theme, church) {
  theme = theme || {};
  church = church || {};
  return theme.useBrandColor ? (church.brandColor || '#1E3A8A') : (theme.primary || '#1F3A5F');
}

// Shared layout parameters for the on-screen document preview
function docParams(theme, church) {
  theme = theme || getActiveTheme();
  church = church || App.church || {};
  const primaryRaw = themePrimary(theme, church);
  const primary = isValidHex(primaryRaw) ? (primaryRaw.startsWith('#') ? primaryRaw : '#' + primaryRaw) : '#1F3A5F';
  const secondaryRaw = theme.secondary || '#5C6670';
  const secondary = isValidHex(secondaryRaw) ? (secondaryRaw.startsWith('#') ? secondaryRaw : '#' + secondaryRaw) : '#5C6670';
  const hf = theme.headingFont === 'serif' ? "'Playfair Display', Georgia, serif" : "'Plus Jakarta Sans', sans-serif";
  const bf = theme.bodyFont === 'serif' ? "'Lora', Georgia, serif" : "'Inter', sans-serif";
  const border = ['double', 'line', 'none'].includes(theme.borderStyle) ? theme.borderStyle : 'none';
  return {
    primary,
    secondary,
    hf, bf,
    frameColor: mixHex(primary, '#FFFFFF', 0.55),
    gap: border === 'none' ? 24 : 18,
    dividers: border === 'line',
    borderStyle: border,
    footerStyle: ['classic', 'line', 'minimal'].includes(theme.footerStyle) ? theme.footerStyle : 'classic',
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
      name: 'Order of Service',
      tagline: 'Plan • Create • Worship',
      address: '12 Grace Avenue, Lagos', phone: '+234 800 000 0000', 
      email: 'hello@orderofservice.app', website: 'orderofservice.app',
      brandColor: '#1E3A8A',
      logo: '/logo.png',
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
// CHURCH SETTINGS & BRANDING
// ======================================

function applyAccent() {
  const hex = (App.church && App.church.brandColor) || '#1E3A8A';
  const rgb = hexToRgb(hex);
  document.documentElement.style.setProperty('--accent-rgb', rgb.join(' '));
}

function updateBranding() {
  const c = App.church || {};
  const name = c.name || 'Order of Service';
  const logo = c.logo || '/logo.png';
  const logoIcon = '/logo-icon.png';
  ['brand-badge', 'brand-badge-m', 'brand-badge-h'].forEach(id => {
    const el = document.getElementById(id); 
    if (el) {
      el.innerHTML = '<img src="' + logoIcon + '" alt="Order of Service" class="w-full h-full object-contain">';
    }
  });
  ['brand-name', 'brand-name-m', 'brand-name-h', 'brand-profile-name'].forEach(id => {
    const el = document.getElementById(id); 
    if (el) el.textContent = name;
  });
  const avatar = document.getElementById('brand-avatar');
  if (avatar) {
    avatar.innerHTML = '<img src="' + logoIcon + '" alt="' + esc(name) + ' logo" class="w-full h-full object-contain">';
  }
}

function renderSettings() {
  const c = App.church || {};
  const color = c.brandColor || '#1E3A8A';
  const presets = ['#1E3A8A', '#0F172A', '#1E40AF', '#047857', '#9333EA', '#B45309', '#BE123C'];
  return `
  <div class="mb-6">
    <h1 class="text-2xl font-bold tracking-tight text-slate-900">Church Settings</h1>
    <p class="text-sm text-slate-500 mt-0.5">Customize your church identity, logo and contact details.</p>
  </div>

  <div class="space-y-6 max-w-3xl">
    <section class="card p-6">
      <h2 class="text-base font-bold text-slate-900">Church Identity &amp; Branding</h2>
      <p class="text-xs text-slate-500 mt-0.5">Appears on every generated PDF document and throughout the app.</p>

      <div class="mt-5 flex flex-col sm:flex-row sm:items-center gap-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div id="logo-preview" class="w-20 h-20 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm" style="width: 80px; height: 80px; min-width: 80px; min-height: 80px;">
          ${c.logo
            ? '<img src="' + esc(safeImgSrc(c.logo)) + '" alt="Church logo" class="w-full h-full max-w-full max-h-full object-contain p-1.5" style="max-width: 100%; max-height: 100%;">'
            : '<div class="text-center text-slate-400"><i data-lucide="image" class="w-7 h-7 mx-auto"></i><span class="text-[10px] block mt-0.5">No Logo</span></div>'}
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap gap-2">
            <button class="btn btn-ghost text-xs" data-action="logo-upload"><i data-lucide="upload" class="w-4 h-4"></i>Upload Church Logo</button>
            ${c.logo ? '<button class="btn btn-danger text-xs" data-action="logo-remove"><i data-lucide="trash-2" class="w-4 h-4"></i>Remove</button>' : ''}
          </div>
          <p class="text-xs text-slate-500 mt-2">Recommended format: PNG or JPG. Stored locally in your browser and embedded directly in the PDF header.</p>
        </div>
        <input type="file" id="logo-file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden">
      </div>

      <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="form-label" for="set-name">Church Name</label>
          <input id="set-name" class="input font-semibold" data-setting="name" value="${esc(c.name || '')}" maxlength="60" placeholder="Redeem Church">
        </div>
        <div>
          <label class="form-label" for="set-tagline">Motto / Tagline <span class="text-slate-400 font-normal">(optional)</span></label>
          <input id="set-tagline" class="input" data-setting="tagline" value="${esc(c.tagline || '')}" maxlength="80" placeholder="A community anchored in grace and truth">
        </div>
      </div>
    </section>

    <section class="card p-6">
      <h2 class="text-base font-bold text-slate-900">Contact &amp; Location Details</h2>
      <p class="text-xs text-slate-500 mt-0.5">Shown in the PDF bulletin footer.</p>

      <div class="mt-5 space-y-4">
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

    <section class="card p-6">
      <h2 class="text-base font-bold text-slate-900">Accent Color</h2>
      <p class="text-xs text-slate-500 mt-0.5">Styles primary buttons, accents and the modern PDF theme.</p>
      <div class="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div class="flex gap-2.5 items-center">
          <input type="color" id="set-color" class="color-input" value="${esc(color)}">
          <input type="text" id="set-color-hex" class="input w-32 font-mono text-xs uppercase" value="${esc(color)}" maxlength="7" placeholder="#1E3A8A">
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${presets.map(hex => `
            <button type="button" class="w-6 h-6 rounded-md border border-slate-300 transition-transform hover:scale-110 shadow-sm" style="background-color: ${hex}" data-action="quick-accent" data-hex="${hex}" title="${hex}"></button>
          `).join('')}
        </div>
      </div>
    </section>

    <div class="flex justify-end gap-3 pt-2">
      <button class="btn btn-primary" data-action="save-settings"><i data-lucide="check" class="w-4 h-4"></i>Save Church Settings</button>
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
  if (!file) return;
  const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    toast('Please choose a valid PNG, JPG, WEBP, or GIF image', 'info');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast('Logo file must be smaller than 5MB', 'error');
    return;
  }
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
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      App.church.logo = canvas.toDataURL('image/png');
      App.church.logoRemoved = false;
      const preview = document.getElementById('logo-preview');
      if (preview) {
        preview.innerHTML = '<img src="' + esc(safeImgSrc(App.church.logo)) + '" alt="Church logo" class="w-full h-full object-contain p-1.5">';
      }
      toast('Logo updated! Click Save Church Settings.');
    };
    img.onerror = () => toast('That image could not be loaded', 'error');
    img.src = reader.result;
  };
  reader.onerror = () => toast('Failed to read image file', 'error');
  reader.readAsDataURL(file);
}

// ======================================
// TEMPLATES
// ======================================

function templateCardHtml(t) {
  const count = (t.items || []).length;
  return `
  <div class="card card-hover p-5 flex flex-col">
    <div class="flex items-start justify-between gap-2">
      <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 border border-blue-100 flex items-center justify-center shrink-0">
        <i data-lucide="layout-template" class="w-5 h-5"></i>
      </div>
      <div class="flex gap-1">
        <button class="icon-btn" data-action="open-template-editor" data-id="${t.id}" aria-label="Edit ${esc(t.name)}" title="Edit"><i data-lucide="pencil" class="w-4 h-4"></i></button>
        <button class="icon-btn" data-action="duplicate-template" data-id="${t.id}" aria-label="Duplicate ${esc(t.name)}" title="Duplicate"><i data-lucide="copy" class="w-4 h-4"></i></button>
        <button class="icon-btn danger" data-action="delete-template" data-id="${t.id}" aria-label="Delete ${esc(t.name)}" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    </div>
    <div class="mt-4 min-w-0 flex-1">
      <h3 class="font-bold text-slate-900 truncate" title="${esc(t.name)}">${esc(t.name)}</h3>
      <p class="text-sm text-slate-500 mt-1 line-clamp-2 min-h-[2.5rem]">${esc(t.description || 'No description')}</p>
    </div>
    <div class="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
      <span class="text-xs text-slate-500 font-medium">${count} item${count === 1 ? '' : 's'}</span>
      <button class="btn btn-soft text-xs py-1.5 px-3" data-action="use-template" data-id="${t.id}">
        Plan Service <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  </div>`;
}

async function renderTemplates() {
  let templates = (await db.templates.toArray()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (App.searchQuery) {
    const q = App.searchQuery.toLowerCase();
    templates = templates.filter(t => t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
  }

  return `
  <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900">Templates</h1>
      <p class="text-sm text-slate-500 mt-0.5">Reusable liturgies and service outlines.</p>
    </div>
    <button class="btn btn-primary" data-action="open-template-editor"><i data-lucide="plus" class="w-4 h-4"></i>New Template</button>
  </div>

  <div class="mb-5 flex gap-3">
    <div class="relative flex-1 max-w-sm">
      <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
      <input id="tpl-search-input" class="input pl-9 text-xs" placeholder="Search templates..." value="${esc(App.searchQuery || '')}">
    </div>
  </div>

  <div id="tpl-list-container">
  ${templates.length
    ? '<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">' + templates.map(templateCardHtml).join('') + '</div>'
    : `
    <div class="card p-12 text-center max-w-xl mx-auto">
      <div class="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center"><i data-lucide="layout-template" class="w-6 h-6"></i></div>
      <h3 class="mt-4 font-bold text-slate-800">${App.searchQuery ? 'No templates matching "' + esc(App.searchQuery) + '"' : 'No templates created yet'}</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Create your first template to quickly prepare Sunday services.</p>
      <button class="btn btn-primary mt-5 text-xs" data-action="open-template-editor"><i data-lucide="plus" class="w-4 h-4"></i>Create Template</button>
    </div>`}
  </div>`;
}

function templateItemsHtml(items) {
  if (!items.length) {
    return '<p class="py-10 text-center text-sm text-slate-400">No items yet. Click "Add Service Item" below.</p>';
  }
  return items.map((item, idx) => `
    <div class="tpl-item flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-slate-50 transition-colors" data-id="${item.id}">
      <span class="drag-handle icon-btn text-slate-400 hover:text-slate-700" title="Drag to reorder"><i data-lucide="grip-vertical" class="w-4 h-4"></i></span>
      <span class="text-xs font-mono font-bold text-slate-400 w-5">${idx + 1}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="text-sm font-semibold text-slate-900 truncate">${esc(item.title)}</p>
          ${item.requiresPerson ? '<span class="chip chip-navy text-[10px]">Person required</span>' : '<span class="chip text-[10px]">No person</span>'}
        </div>
        ${item.description ? '<p class="text-xs text-slate-500 mt-0.5 line-clamp-1">' + esc(item.description) + '</p>' : ''}
      </div>
      <div class="flex items-center gap-1">
        <button class="icon-btn" data-action="edit-item" data-id="${item.id}" aria-label="Edit item"><i data-lucide="pencil" class="w-4 h-4"></i></button>
        <button class="icon-btn danger" data-action="remove-item" data-id="${item.id}" aria-label="Remove item"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    </div>`).join('');
}

function renderTemplateEditor() {
  const t = App.currentTemplate || { name: '', description: '', items: [] };
  return `
  <div class="mb-6 flex items-center gap-3">
    <button class="icon-btn bg-white border border-slate-200" data-action="back-templates" aria-label="Back"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900">${t.isNew ? 'Create Template' : 'Edit Template'}</h1>
      <p class="text-xs text-slate-500 mt-0.5">Organize items in order of execution.</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
    <section class="card p-6">
      <h2 class="text-base font-bold text-slate-900">Template Details</h2>
      <div class="mt-4 space-y-4">
        <div>
          <label class="form-label" for="tpl-name">Template Name</label>
          <input id="tpl-name" class="input font-medium" value="${esc(t.name || '')}" maxlength="60" placeholder="Sunday Worship Service">
        </div>
        <div>
          <label class="form-label" for="tpl-desc">Description</label>
          <textarea id="tpl-desc" rows="3" class="input text-xs" maxlength="160" placeholder="Regular Sunday worship service">${esc(t.description || '')}</textarea>
        </div>
      </div>
      <button class="btn btn-primary w-full mt-6" data-action="save-template"><i data-lucide="check" class="w-4 h-4"></i>Save Template</button>
    </section>

    <section class="card p-6 lg:col-span-2">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 class="text-base font-bold text-slate-900">Service Items</h2>
          <p class="text-xs text-slate-500">Drag items to rearrange the flow.</p>
        </div>
        <span id="tpl-item-count" class="chip chip-navy">${(t.items || []).length} items</span>
      </div>
      <div id="tpl-items-list" class="mt-3 divide-y divide-slate-100">
        ${templateItemsHtml(t.items || [])}
      </div>
      <button class="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-700 hover:border-blue-900 hover:text-blue-900 transition-colors" data-action="add-item">
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
  initTemplateSortable();
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
    text: '"' + t.name + '" and its ' + t.items.length + ' items will be removed.',
    confirmText: 'Delete',
  });
  if (!ok) return;
  await db.templates.delete(id);
  toast('Template deleted');
  showPage('templates');
}

// Service item modal
function openItemModal(item, mode = 'template') {
  App.editingItemId = item ? item.id : null;
  App.itemModalMode = mode;
  $('#item-modal-title').textContent = item ? 'Edit Service Item' : (mode === 'service' ? 'Add Item to this Sunday' : 'Add Service Item');
  $('#item-save-label').textContent = item ? 'Save Changes' : 'Add Item';
  $('#item-title').value = item ? item.title : '';
  $('#item-desc').value = item ? (item.description || '') : '';
  $('#item-person').checked = item ? !!item.requiresPerson : true;
  openModal('modal-item');
  setTimeout(() => { try { $('#item-title').focus(); } catch (e) {} }, 120);
}

function saveItemFromModal() {
  const title = String($('#item-title').value || '').trim();
  const description = String($('#item-desc').value || '').trim();
  const requiresPerson = $('#item-person').checked;
  if (!title) { toast('Please give the item a title', 'info'); return; }

  if (App.itemModalMode === 'service') {
    const s = App.currentService;
    if (!s) return;
    if (App.editingItemId) {
      const it = s.items.find(i => i.id === App.editingItemId);
      if (it) { it.title = title; it.description = description; it.requiresPerson = requiresPerson; }
    } else {
      s.items.push({ id: uid(), title, description, requiresPerson, person: '' });
    }
    closeModal('modal-item');
    refreshServiceEditorItems();
    refreshLivePreview();
    toast('Sunday service updated');
    return;
  }

  const t = App.currentTemplate;
  if (!t) return;
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
    text: '"' + it.title + '" will be removed.',
    confirmText: 'Remove',
  });
  if (!ok) return;
  t.items = t.items.filter(i => i.id !== id);
  refreshTemplateItemsList();
}

function initTemplateSortable() {
  const list = document.getElementById('tpl-items-list');
  if (!list || !window.Sortable) return;
  if (App.sortableInstance) {
    try { App.sortableInstance.destroy(); } catch (e) {}
  }
  App.sortableInstance = new Sortable(list, {
    handle: '.drag-handle',
    animation: 160,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: () => {
      const t = App.currentTemplate;
      if (!t) return;
      const order = $$('.tpl-item', list).map(el => el.dataset.id);
      t.items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      refreshTemplateItemsList();
    },
  });
}

// ======================================
// SUNDAY SERVICE BUILDER & EDITOR
// ======================================

async function renderNewService() {
  const templates = (await db.templates.toArray()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (!templates.length) {
    return `
    <div class="card p-12 text-center max-w-xl mx-auto">
      <div class="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center"><i data-lucide="layout-template" class="w-6 h-6"></i></div>
      <h3 class="mt-4 font-bold text-slate-800">No templates found</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Create a template first to start planning Sunday services.</p>
      <button class="btn btn-primary mt-5 text-xs" data-action="open-template-editor"><i data-lucide="plus" class="w-4 h-4"></i>Create Template</button>
    </div>`;
  }
  const pre = (App.preselectTemplateId && templates.some(t => t.id === App.preselectTemplateId))
    ? App.preselectTemplateId : templates[0].id;
  App.preselectTemplateId = null;
  App.newServiceDate = null;
  return `
  <div class="mb-6 flex items-center gap-3">
    <button class="icon-btn bg-white border border-slate-200" data-action="nav" data-page="sundays" aria-label="Back"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900">Create Sunday Service</h1>
      <p class="text-xs text-slate-500 mt-0.5">Select a template, date and theme.</p>
    </div>
  </div>

  <section class="card p-6 sm:p-7 max-w-2xl">
    <div class="space-y-4">
      <div>
        <label class="form-label" for="ns-template">Service Template</label>
        <select id="ns-template" class="input font-medium">
          ${templates.map(t => '<option value="' + t.id + '"' + (t.id === pre ? ' selected' : '') + '>' + esc(t.name) + ' (' + t.items.length + ' items)</option>').join('')}
        </select>
        <p class="text-xs text-slate-500 mt-1">The flow of service will be initialized from this template.</p>
      </div>
      <div>
        <label class="form-label" for="ns-date">Service Date</label>
        <input id="ns-date" class="input font-medium cursor-pointer" placeholder="Select date" readonly>
        <p class="text-xs text-slate-500 mt-1">Defaults to the coming Sunday.</p>
      </div>
      <div>
        <label class="form-label" for="ns-theme">Service Theme / Sermon Title <span class="text-slate-400 font-normal">(optional)</span></label>
        <input id="ns-theme" class="input" maxlength="80" placeholder="e.g. Walking in Divine Favor">
      </div>
      <div>
        <label class="form-label" for="ns-desc">Service Description <span class="text-slate-400 font-normal">(optional)</span></label>
        <textarea id="ns-desc" rows="2" class="input text-xs" maxlength="200" placeholder="Special notes, scripture passages or order notes"></textarea>
      </div>
      <div class="flex justify-end pt-3">
        <button class="btn btn-primary" data-action="continue-new-service">Continue to Service Editor <i data-lucide="arrow-right" class="w-4 h-4"></i></button>
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
    onChange: (dates) => { 
      App.newServiceDate = dates[0] ? isoOf(dates[0]) : null; 
    },
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

function serviceItemBlockHtml(it, idx) {
  const safeId = esc(it.id);
  return `
  <div class="service-item-row p-3.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors" data-id="${safeId}">
    <div class="flex items-center justify-between gap-2 mb-1.5">
      <div class="flex items-center gap-2 min-w-0">
        <span class="service-drag-handle cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 p-0.5" title="Drag to reorder"><i data-lucide="grip-vertical" class="w-4 h-4"></i></span>
        <span class="w-4 h-4 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">${idx + 1}</span>
        <label id="label-item-${safeId}" class="text-sm font-bold text-slate-800 truncate" for="person-${safeId}">${esc(it.title)}</label>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        ${it.requiresPerson ? '<span class="chip chip-navy text-[10px]">Assigned</span>' : '<span class="chip text-[10px]">No person</span>'}
        <button class="icon-btn text-xs text-slate-400 hover:text-blue-900" data-action="edit-service-item" data-id="${safeId}" title="Edit item details" aria-label="Edit ${esc(it.title)}"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
        <button class="icon-btn text-xs text-slate-400 hover:text-red-600" data-action="remove-service-item" data-id="${safeId}" title="Remove item" aria-label="Remove ${esc(it.title)}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
      </div>
    </div>
    ${it.requiresPerson
      ? `<input id="person-${safeId}" class="input text-xs py-1.5 font-medium" data-person="${safeId}" value="${esc(it.person || '')}" maxlength="60" placeholder="Assigned to (e.g. Pastor Paul, Sister Sarah)">`
      : ''}
    <input class="input text-[11px] py-1 mt-1.5 text-slate-600 placeholder:text-slate-400" data-item-desc="${safeId}" maxlength="160" placeholder="Optional sub-note or description" value="${esc(it.description || '')}">
  </div>`;
}

function initServiceSortable() {
  const container = document.getElementById('se-items-container');
  if (!container || !window.Sortable) return;
  if (App.serviceSortableInstance) {
    try { App.serviceSortableInstance.destroy(); } catch (e) {}
    App.serviceSortableInstance = null;
  }
  App.serviceSortableInstance = new Sortable(container, {
    handle: '.service-drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: (evt) => {
      if (!App.currentService || !Array.isArray(App.currentService.items)) return;
      const item = App.currentService.items.splice(evt.oldIndex, 1)[0];
      App.currentService.items.splice(evt.newIndex, 0, item);
      refreshServiceEditorItems();
      refreshLivePreview();
    }
  });
}

function refreshServiceEditorItems() {
  const container = document.getElementById('se-items-container');
  const countEl = document.getElementById('se-items-count');
  if (!container || !App.currentService) return;
  container.innerHTML = App.currentService.items.map(serviceItemBlockHtml).join('');
  if (countEl) countEl.textContent = App.currentService.items.length + ' items';
  refreshIcons();
  initServiceSortable();
}

function renderServiceEditor() {
  const s = App.currentService;
  if (!s) {
    return `
    <div class="card p-12 text-center max-w-lg mx-auto">
      <div class="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center"><i data-lucide="calendar-days" class="w-6 h-6"></i></div>
      <h3 class="mt-4 font-bold text-slate-800">No service loaded</h3>
      <p class="text-xs text-slate-500 mt-1">Start a new service or open one from Saved Sundays.</p>
      <div class="flex justify-center gap-2.5 mt-5">
        <button class="btn btn-primary text-xs" data-action="nav" data-page="newService"><i data-lucide="plus" class="w-4 h-4"></i>New Service</button>
        <button class="btn btn-ghost text-xs" data-action="nav" data-page="sundays">Saved Sundays</button>
      </div>
    </div>`;
  }
  const themes = App.themeCache || [];
  const activeId = (App.church && App.church.activeThemeId) || '';
  return `
  <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3 min-w-0">
      <button class="icon-btn bg-white border border-slate-200" data-action="nav" data-page="sundays" aria-label="Back"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
      <div class="min-w-0">
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate" id="se-header-title">${esc(s.theme || 'Sunday Order of Service')}</h1>
        <p class="text-xs text-slate-500 truncate" id="se-header-subtitle">${esc(fmtLongDate(s.date))}${s.templateName ? ' • ' + esc(s.templateName) : ''}</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button class="btn btn-ghost text-xs" data-action="print-live-preview"><i data-lucide="printer" class="w-4 h-4 text-slate-600"></i>Print</button>
      <button class="btn btn-ghost text-xs" data-action="save-service"><i data-lucide="check" class="w-4 h-4 text-emerald-600"></i>Save</button>
      <button class="btn btn-primary btn-generate text-xs" data-action="generate-pdf"><i data-lucide="file-down" class="w-4 h-4"></i>Generate PDF</button>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
    <!-- Left form controls (5 cols) -->
    <div class="lg:col-span-5 space-y-4">
      <section class="card p-5">
        <h2 class="text-sm font-bold text-slate-900">Service Details</h2>
        <div class="mt-3.5 space-y-3">
          <div>
            <label class="form-label" for="se-date">Date</label>
            <input id="se-date" class="input text-xs font-medium cursor-pointer" readonly>
          </div>
          <div>
            <label class="form-label" for="se-theme">Service Theme / Title</label>
            <input id="se-theme" class="input text-xs font-semibold" data-live="theme" value="${esc(s.theme || '')}" maxlength="80" placeholder="Walking in God's Purpose">
          </div>
          <div>
            <label class="form-label" for="se-desc">Description <span class="text-slate-400 font-normal">(optional)</span></label>
            <textarea id="se-desc" rows="2" class="input text-xs" data-live="description" maxlength="200" placeholder="Notes or instructions">${esc(s.description || '')}</textarea>
          </div>
        </div>
      </section>

      <section class="card p-5">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 class="text-sm font-bold text-slate-900">Order of Service</h2>
            <p class="text-[11px] text-slate-500">Assign minister or volunteer to each item.</p>
          </div>
          <span id="se-items-count" class="chip chip-navy">${s.items.length} items</span>
        </div>
        
        <div id="se-items-container" class="mt-3.5 space-y-2 max-h-[500px] overflow-y-auto pr-1">
          ${s.items.map(serviceItemBlockHtml).join('')}
        </div>

        <button class="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:border-blue-900 hover:text-blue-900 transition-colors" data-action="add-service-item">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>Add Item to this Sunday
        </button>
      </section>
    </div>

    <!-- Right Paper Preview (7 cols) -->
    <div class="lg:col-span-7">
      <section class="card">
        <div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 flex-wrap bg-slate-50/70">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span class="text-xs font-bold text-slate-800">Live Paper Preview</span>
            <span class="chip text-[10px]">Click any text on paper to edit!</span>
          </div>

          <div class="flex items-center gap-2.5">
            <div class="flex items-center gap-1 bg-white rounded-md border border-slate-200 px-1 py-0.5 text-xs">
              <button class="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100" data-action="zoom-preview" data-delta="-0.1" title="Zoom out">-</button>
              <span id="zoom-level-text" class="px-1 text-[11px] text-slate-700 font-mono font-medium">${Math.round(App.previewScale * 100)}%</span>
              <button class="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100" data-action="zoom-preview" data-delta="0.1" title="Zoom in">+</button>
            </div>

            <label class="text-xs text-slate-600 flex items-center gap-1.5">
              <span>Theme:</span>
              <select id="se-theme-select" class="input py-1 px-2 text-xs w-36">
                ${themes.map(t => '<option value="' + t.id + '"' + (t.id === activeId ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('')}
              </select>
            </label>
          </div>
        </div>

        <div class="p-5 paper-easel overflow-x-auto flex justify-center">
          <div id="live-paper-scaler" style="transform-origin: top center; transition: transform 0.15s ease; transform: scale(${App.previewScale});">
            <div id="live-paper" class="is-editable">${renderDocHtml(s, App.church, getActiveTheme(), true)}</div>
          </div>
        </div>

        <div class="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
          <p class="text-xs text-slate-500 flex items-center gap-1.5">
            <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600"></i>
            <span>Edits in preview auto-sync to form &amp; PDF</span>
          </p>
          <div class="flex items-center gap-2">
            <button class="btn btn-primary btn-generate text-xs py-1.5 px-3.5" id="btn-generate-pdf" data-action="generate-pdf">
              <i data-lucide="file-down" class="w-4 h-4"></i>Generate PDF
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>`;
}

function afterServiceEditor() {
  if (!App.currentService || !window.flatpickr) return;
  const fp = flatpickr('#se-date', {
    dateFormat: 'l, j F Y',
    defaultDate: App.currentService.date ? dateOf(App.currentService.date) : nextSunday(),
    onChange: (dates) => {
      if (App.currentService && dates[0]) { 
        App.currentService.date = isoOf(dates[0]); 
        const sub = document.getElementById('se-header-subtitle');
        if (sub) sub.textContent = fmtLongDate(App.currentService.date) + (App.currentService.templateName ? ' • ' + App.currentService.templateName : '');
        refreshLivePreview(); 
      }
    },
  });
  App.flatpickrs.push(fp);
  bindPreviewInlineEditing();
  initServiceSortable();
}

function refreshLivePreview() {
  const holder = document.getElementById('live-paper');
  if (!holder || !App.currentService) return;
  holder.innerHTML = renderDocHtml(App.currentService, App.church, getActiveTheme(), true);
  bindPreviewInlineEditing();
}

// Binds contenteditable input events directly from the live preview back into the state!
function bindPreviewInlineEditing() {
  const holder = document.getElementById('live-paper');
  if (!holder || !App.currentService) return;
  if (holder.dataset.inlineBound === 'true') return;
  holder.dataset.inlineBound = 'true';

  // Prevent multiline breaks on single-line paper editable titles & headers
  holder.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target && e.target.getAttribute('contenteditable') === 'true') {
      if (!e.target.dataset.editItemDesc) {
        e.preventDefault();
        e.target.blur();
      }
    }
  });

  // Clicking on service date on paper opens the date picker
  holder.addEventListener('click', (e) => {
    const dateEl = e.target.closest('[data-action="pick-preview-date"]');
    if (dateEl) {
      const seDate = document.getElementById('se-date');
      if (seDate && seDate._flatpickr) seDate._flatpickr.open();
    }
  });

  holder.addEventListener('input', (e) => {
    const el = e.target;
    if (!el || !el.dataset) return;

    // Service theme edited on paper
    if (el.dataset.editTarget === 'service-theme') {
      const text = el.innerText.trim();
      App.currentService.theme = text;
      const input = document.getElementById('se-theme');
      if (input) input.value = text;
      const head = document.getElementById('se-header-title');
      if (head) head.textContent = text || 'Sunday Order of Service';
      clearTimeout(holder._saveServiceTimer);
      holder._saveServiceTimer = setTimeout(() => {
        if (App.currentService) persistService(App.currentService);
      }, 600);
      return;
    }

    // Church name edited on paper
    if (el.dataset.editTarget === 'church-name') {
      const text = el.innerText.trim();
      if (App.church) {
        App.church.name = text;
        updateBranding();
        const inp = document.getElementById('set-name');
        if (inp) inp.value = text;
        clearTimeout(holder._saveChurchTimer);
        holder._saveChurchTimer = setTimeout(() => {
          if (App.church) db.church.put(App.church);
        }, 600);
      }
      return;
    }

    // Item title edited on paper
    if (el.dataset.editItemTitle) {
      const id = el.dataset.editItemTitle;
      const it = App.currentService.items.find(i => i.id === id);
      if (it) {
        it.title = el.innerText.trim();
        const rowLabel = document.getElementById(`label-item-${id}`) || document.querySelector(`label[for="person-${id}"]`);
        if (rowLabel) rowLabel.textContent = it.title;
        clearTimeout(holder._saveServiceTimer);
        holder._saveServiceTimer = setTimeout(() => {
          if (App.currentService) persistService(App.currentService);
        }, 600);
      }
      return;
    }

    // Item person assigned edited on paper
    if (el.dataset.editItemPerson) {
      const id = el.dataset.editItemPerson;
      const it = App.currentService.items.find(i => i.id === id);
      if (it) {
        it.person = el.innerText.trim();
        const input = document.getElementById(`person-${id}`);
        if (input) input.value = it.person;
        clearTimeout(holder._saveServiceTimer);
        holder._saveServiceTimer = setTimeout(() => {
          if (App.currentService) persistService(App.currentService);
        }, 600);
      }
      return;
    }

    // Item description edited on paper
    if (el.dataset.editItemDesc) {
      const id = el.dataset.editItemDesc;
      const it = App.currentService.items.find(i => i.id === id);
      if (it) {
        it.description = el.innerText.trim();
        const input = document.querySelector(`[data-item-desc="${id}"]`);
        if (input) input.value = it.description;
        clearTimeout(holder._saveServiceTimer);
        holder._saveServiceTimer = setTimeout(() => {
          if (App.currentService) persistService(App.currentService);
        }, 600);
      }
      return;
    }
  });

  holder.addEventListener('focusout', () => {
    if (App.currentService) {
      persistService(App.currentService);
    }
  });
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
  const titleEl = document.getElementById('se-header-title');
  if (titleEl) titleEl.textContent = s.theme || 'Sunday Order of Service';
}

async function openSavedService(id) {
  const s = await db.services.get(id);
  if (!s) { toast('Service not found', 'error'); return; }
  App.currentService = deepClone(s);
  App.currentService.isNew = false;
  showPage('serviceEditor');
}

// ======================================
// DOCUMENT ENGINE: ON-SCREEN LIVE PREVIEW
// ======================================

function renderDocHtml(service, church, theme, editable = false) {
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
      <div class="doc-item" data-item-id="${esc(it.id)}">
        <div class="doc-item-title"${editable ? ' contenteditable="true" data-edit-item-title="' + esc(it.id) + '" title="Click to edit title"' : ''}>${esc(it.title)}</div>
        ${it.requiresPerson ? `<div class="doc-item-person"${editable ? ' contenteditable="true" data-edit-item-person="' + esc(it.id) + '" title="Click to assign minister or volunteer"' : ''}>${esc(it.person || '')}</div>` : ''}
        ${(it.description || editable) ? `<div class="doc-item-desc"${editable ? ' contenteditable="true" data-edit-item-desc="' + esc(it.id) + '" title="Click to edit notes / scripture"' : ''}>${esc(it.description || '')}</div>` : ''}
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
        ${church.logo ? '<img src="' + esc(safeImgSrc(church.logo)) + '" alt="' + esc(name) + ' logo">' : '<div class="doc-logo-ph">' + esc(initials) + '</div>'}
      </div>
      <div class="doc-name"${editable ? ' contenteditable="true" data-edit-target="church-name" title="Click to edit church name"' : ''}>${esc(name)}</div>
      ${church.tagline ? '<div class="doc-tagline">' + esc(church.tagline) + '</div>' : ''}
      <div class="doc-sub">ORDER OF SERVICE</div>
      ${dateTxt ? '<div class="doc-date"' + (editable ? ' data-action="pick-preview-date" title="Click to change date"' : '') + '>' + esc(dateTxt) + '</div>' : ''}
      ${(themeTxt || editable) ? `<div class="doc-theme doc-theme-quotes"${editable ? ' contenteditable="true" data-edit-target="service-theme" title="Click to edit theme"' : ''}>${esc(themeTxt)}</div>` : ''}
      <div class="doc-headrule${P.borderStyle === 'none' ? ' short' : ''}"></div>
    </div>
    <div class="doc-items${P.dividers ? ' has-dividers' : ''}">
      ${itemsHtml || '<p style="color:#A3A3A3;font-size:12px;font-style:italic;margin-top:24px;text-align:center">Service items will appear here.</p>'}
    </div>
    ${footerHtml}
  </div>`;
}

// ======================================
// PDF GENERATION ENGINE
// ======================================

function pdfParams(theme, church) {
  const primary = themePrimary(theme, church);
  return {
    primary,
    primaryRgb: hexToRgb(primary),
    secondaryRgb: hexToRgb(theme.secondary || '#5C6670'),
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
  if (!txt) return 1;
  return Math.max(1, doc.splitTextToSize(String(txt), maxWidth).length);
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
  const W = 210, MX = 24, centerX = W / 2, maxW = W - 2 * MX;
  const isCenter = P.align === 'center';
  let y = 30;

  if (logo) {
    let h = 22, w = (logo.width / logo.height) * h;
    if (w > 60) { w = 60; h = (logo.height / logo.width) * w; }
    const x = isCenter ? (W - w) / 2 : MX;
    try { doc.addImage(logo.dataUrl, logo.format, x, y, w, h); } catch (e) { /* skip */ }
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
  const nameW = spacedWidth(doc, name, nameGap);
  if (nameW > maxW) {
    doc.setFontSize(Math.min(P.nameSize, 18));
    if (isCenter) doc.text(name, centerX, y, { align: 'center', maxWidth: maxW });
    else doc.text(name, MX, y, { maxWidth: maxW });
  } else {
    if (isCenter) spacedText(doc, name, centerX - nameW / 2, y, nameGap);
    else spacedText(doc, name, MX, y, nameGap);
  }
  y += 9.5;

  if (church.tagline) {
    doc.setFont(P.bf, 'italic'); doc.setFontSize(9.5);
    doc.setTextColor(P.secondaryRgb[0], P.secondaryRgb[1], P.secondaryRgb[2]);
    if (isCenter) doc.text(church.tagline, centerX, y, { align: 'center', maxWidth: maxW });
    else doc.text(church.tagline, MX, y, { maxWidth: maxW });
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
    const cleanTheme = String(service.theme).replace(/^["“”]|["“”]$/g, '').trim();
    const th = '“' + cleanTheme + '”';
    const thLines = doc.splitTextToSize(th, 160);
    if (isCenter) doc.text(thLines, centerX, y, { align: 'center' }); else doc.text(thLines, MX, y);
    y += 6.5 * thLines.length;
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
    const lines = doc.splitTextToSize(String(it.person), 150);
    h += 4.9 * Math.max(1, lines.length);
  }
  if (it.description) {
    doc.setFont(P.bf, 'italic'); doc.setFontSize(9);
    const lines = doc.splitTextToSize(String(it.description), 140);
    h += 4.0 * Math.max(1, lines.length);
  }
  return h + P.gap;
}

function drawPdfItem(doc, it, y, P) {
  const W = 210, MX = 24, centerX = W / 2, maxW = W - 2 * MX;
  const isCenter = P.align === 'center';

  doc.setFont(P.hf, 'bold'); doc.setFontSize(9.5);
  doc.setTextColor(P.primaryRgb[0], P.primaryRgb[1], P.primaryRgb[2]);
  const title = String(it.title || '').toUpperCase();
  const tGap = 1.15;
  const tWidth = spacedWidth(doc, title, tGap);
  if (tWidth > maxW) {
    if (isCenter) doc.text(title, centerX, y, { align: 'center', maxWidth: maxW });
    else doc.text(title, MX, y, { maxWidth: maxW });
  } else {
    if (isCenter) spacedText(doc, title, centerX - tWidth / 2, y, tGap);
    else spacedText(doc, title, MX, y, tGap);
  }
  y += 5.6;

  if (it.requiresPerson && it.person) {
    doc.setFont(P.bf, 'normal'); doc.setFontSize(11); doc.setTextColor(38, 38, 38);
    const pLines = doc.splitTextToSize(String(it.person), 150);
    if (isCenter) doc.text(pLines, centerX, y, { align: 'center' });
    else doc.text(pLines, MX, y);
    y += 4.9 * pLines.length;
  }

  if (it.description) {
    doc.setFont(P.bf, 'italic'); doc.setFontSize(9);
    doc.setTextColor(P.secondaryRgb[0], P.secondaryRgb[1], P.secondaryRgb[2]);
    const dLines = doc.splitTextToSize(String(it.description), 140);
    if (isCenter) doc.text(dLines, centerX, y, { align: 'center' });
    else doc.text(dLines, MX, y);
    y += 4.0 * dLines.length;
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
      let dataUrl = church.logo;
      if (typeof dataUrl === 'string' && !dataUrl.startsWith('data:')) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        dataUrl = c.toDataURL('image/png');
      }
      logo = {
        dataUrl,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        format: 'PNG',
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
    brandColor: church.brandColor || '#1E3A8A', logo: church.logo || null,
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
  toast('PDF exported and saved to history');
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
      ? '<span class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white spin"></span>Generating PDF...'
      : '<i data-lucide="file-down" class="w-4 h-4"></i>Generate PDF';
  }
  refreshIcons();
}

async function captureThumbnail(service, church, theme) {
  if (!window.html2canvas) return null;
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:620px;pointer-events:none;';
  holder.innerHTML = renderDocHtml(service, church, theme, false);
  document.body.appendChild(holder);
  try {
    const paper = holder.firstElementChild;
    if (document.fonts && document.fonts.ready) {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise(r => setTimeout(r, 1200))
        ]);
      } catch (e) {}
    }
    const logoImg = paper ? paper.querySelector('img') : null;
    if (logoImg && !logoImg.complete) {
      await Promise.race([
        new Promise(r => { logoImg.onload = logoImg.onerror = r; }),
        new Promise(r => setTimeout(r, 1500))
      ]);
    }
    const canvas = await html2canvas(paper, {
      scale: 240 / 620,
      backgroundColor: '#FFFFFF',
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL('image/jpeg', 0.75);
  } finally {
    if (holder.parentNode) holder.parentNode.removeChild(holder);
  }
}

// ======================================
// PDF HISTORY
// ======================================

async function renderHistory() {
  let records = (await db.pdfHistory.toArray())
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (App.searchQuery) {
    const q = App.searchQuery.toLowerCase();
    records = records.filter(r => (r.service && r.service.theme && r.service.theme.toLowerCase().includes(q)) || (r.date && r.date.includes(q)) || (r.fileName && r.fileName.toLowerCase().includes(q)));
  }

  return `
  <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900">PDF History</h1>
      <p class="text-sm text-slate-500 mt-0.5">Archive of all generated orders of service.</p>
    </div>
  </div>

  <div class="mb-5 flex gap-3">
    <div class="relative flex-1 max-w-sm">
      <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
      <input id="history-search-input" class="input pl-9 text-xs" placeholder="Search by date or theme..." value="${esc(App.searchQuery || '')}">
    </div>
  </div>

  <div id="history-list-container">
  ${records.length
    ? '<div class="space-y-3.5 max-w-4xl">' + records.map(historyCardHtml).join('') + '</div>'
    : `
    <div class="card p-12 text-center max-w-2xl mx-auto">
      <div class="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center"><i data-lucide="file-text" class="w-6 h-6"></i></div>
      <h3 class="mt-4 font-bold text-slate-800">${App.searchQuery ? 'No PDFs match search' : 'No PDFs generated yet'}</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Generate your first order of service PDF to automatically save a snapshot here.</p>
      <button class="btn btn-primary mt-5 text-xs" data-action="nav" data-page="newService"><i data-lucide="plus" class="w-4 h-4"></i>Create Sunday Service</button>
    </div>`}
  </div>`;
}

function historyCardHtml(rec) {
  const itemCount = (rec.service && rec.service.items || []).length;
  const themeTxt = rec.service && rec.service.theme ? ' — "' + esc(rec.service.theme) + '"' : '';
  return `
  <div class="card card-hover p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 items-stretch sm:items-center">
    <div class="w-full sm:w-24 shrink-0">
      <div class="thumb-box cursor-pointer" data-action="preview-history" data-id="${rec.id}">
        ${rec.thumbnail
          ? '<img src="' + esc(safeImgSrc(rec.thumbnail)) + '" alt="PDF thumbnail">'
          : '<div class="w-full h-full flex items-center justify-center text-slate-400"><i data-lucide="file-text" class="w-6 h-6"></i></div>'}
      </div>
    </div>
    <div class="flex-1 min-w-0">
      <p class="font-bold text-sm text-slate-900 truncate">${esc(fmtLongDate(rec.date))}${themeTxt}</p>
      <p class="text-xs text-slate-500 mt-0.5">Created ${timeAgo(rec.createdAt)} • ${itemCount} items</p>
      <p class="text-[11px] text-slate-400 font-mono mt-1">${rec.fileName || 'document.pdf'}</p>
    </div>
    <div class="flex items-center gap-2 flex-wrap shrink-0">
      <button class="btn btn-soft text-xs py-1.5 px-3" data-action="preview-history" data-id="${rec.id}"><i data-lucide="eye" class="w-3.5 h-3.5"></i>Preview</button>
      <button class="btn btn-ghost text-xs py-1.5 px-3" data-action="download-history" data-id="${rec.id}"><i data-lucide="download" class="w-3.5 h-3.5"></i>Download</button>
      <button class="icon-btn danger" data-action="delete-history" data-id="${rec.id}" aria-label="Delete record"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </div>
  </div>`;
}

async function previewHistoryRecord(id) {
  const rec = await db.pdfHistory.get(id);
  if (!rec) { toast('Record not found', 'error'); return; }
  App.pdfPreviewId = id;
  $('#pdf-modal-title').textContent = 'Order of Service — ' + fmtLongDate(rec.date);
  $('#pdf-modal-subtitle').textContent = 'Created ' + timeAgo(rec.createdAt) + ' • ' + (rec.fileName || 'document.pdf');
  $('#pdf-modal-body').innerHTML = renderDocHtml(rec.service || {}, rec.church || {}, rec.theme || THEME_PRESETS[0], false);
  openModal('modal-pdf');
  refreshIcons();
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
    text: 'This record will be removed from history.',
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
  let services = (await db.services.toArray())
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  if (App.searchQuery) {
    const q = App.searchQuery.toLowerCase();
    services = services.filter(s => (s.theme && s.theme.toLowerCase().includes(q)) || (s.templateName && s.templateName.toLowerCase().includes(q)) || (s.date && s.date.includes(q)));
  }

  return `
  <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900">Saved Sundays</h1>
      <p class="text-sm text-slate-500 mt-0.5">Edit or export upcoming and past services.</p>
    </div>
    <button class="btn btn-primary" data-action="nav" data-page="newService"><i data-lucide="plus" class="w-4 h-4"></i>New Sunday Service</button>
  </div>

  <div class="mb-5 flex gap-3">
    <div class="relative flex-1 max-w-sm">
      <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
      <input id="sundays-search-input" class="input pl-9 text-xs" placeholder="Search by date, theme or template..." value="${esc(App.searchQuery || '')}">
    </div>
  </div>

  <div id="sundays-list-container">
  ${services.length
    ? '<div class="card max-w-4xl divide-y divide-slate-100">' + services.map(sundayRowHtml).join('') + '</div>'
    : `
    <div class="card p-12 text-center max-w-2xl mx-auto">
      <div class="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center"><i data-lucide="calendar-days" class="w-6 h-6"></i></div>
      <h3 class="mt-4 font-bold text-slate-800">${App.searchQuery ? 'No services found' : 'No saved Sundays yet'}</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Create a Sunday service, assign ministers, and save it here.</p>
      <button class="btn btn-primary mt-5 text-xs" data-action="nav" data-page="newService"><i data-lucide="plus" class="w-4 h-4"></i>Create Sunday Service</button>
    </div>`}
  </div>`;
}

function sundayRowHtml(s) {
  const md = fmtMonthDay(s.date);
  const title = s.theme || s.templateName || 'Sunday Worship Service';
  return `
  <div class="flex flex-col sm:flex-row sm:items-center gap-4 px-5 sm:px-6 py-4 hover:bg-slate-50/70 transition-colors">
    <div class="w-11 h-11 rounded-xl bg-blue-50 text-blue-900 border border-blue-100 flex flex-col items-center justify-center shrink-0 leading-none">
      <span class="text-[10px] font-bold tracking-wider">${esc(md.month)}</span>
      <span class="text-base font-extrabold mt-0.5">${esc(md.day)}</span>
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 flex-wrap">
        <p class="font-bold text-sm text-slate-900 truncate">${esc(title)}</p>
        <span class="chip text-[10px]">${s.items ? s.items.length : 0} items</span>
      </div>
      <p class="text-xs text-slate-500 mt-0.5 truncate">${esc(fmtLongDate(s.date))}${s.templateName ? ' • ' + esc(s.templateName) : ''}</p>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <button class="btn btn-soft text-xs py-1.5 px-3" data-action="open-service" data-id="${s.id}"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Open Editor</button>
      <button class="icon-btn" data-action="download-service-pdf" data-id="${s.id}" aria-label="Download PDF" title="Generate PDF"><i data-lucide="file-down" class="w-4 h-4"></i></button>
      <button class="icon-btn danger" data-action="delete-service" data-id="${s.id}" aria-label="Delete service" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </div>
  </div>`;
}

async function deleteSavedService(id) {
  const s = await db.services.get(id);
  if (!s) return;
  const ok = await confirmDialog({
    title: 'Delete this service?',
    text: '"' + (s.theme || s.templateName || 'This service') + '" will be deleted.',
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
  const [templatesCount, servicesCount, historyCount, themesCount, allServices, allTemplates] = await Promise.all([
    db.templates.count(),
    db.services.count(),
    db.pdfHistory.count(),
    db.themes.count(),
    db.services.toArray(),
    db.templates.toArray(),
  ]);

  const sortedServices = allServices.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const recent = sortedServices.slice(0, 5);
  const todayIso = isoOf(new Date());
  
  // Find upcoming service (nearest service on or after today, or latest planned)
  const upcomingServices = sortedServices.filter(s => s.date && s.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date));
  const nextService = upcomingServices[0] || sortedServices[0] || null;

  const churchName = (App.church && App.church.name) || 'Redeem Church';
  const churchInitials = initialsOf(churchName);
  const activeTheme = getActiveTheme();
  const nextSun = fmtLongDate(isoOf(nextSunday()));

  const stats = [
    { label: 'Saved Sundays', value: servicesCount, icon: 'calendar-days', page: 'sundays', note: 'Planned liturgies' },
    { label: 'Templates', value: templatesCount, icon: 'layout-template', page: 'templates', note: 'Service blueprints' },
    { label: 'PDF Documents', value: historyCount, icon: 'file-text', page: 'history', note: 'Exported prints' },
    { label: 'Active Theme', value: activeTheme.name || 'Classic Liturgy', icon: 'palette', page: 'themes', note: 'Document style', isText: true },
  ];

  return `
  <!-- Top Church Hub Header -->
  <div class="card p-5 sm:p-6 mb-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-5">
      <div class="flex items-center gap-4 min-w-0">
        <div class="dashboard-logo-box rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-sm" style="width: 56px; height: 56px; min-width: 56px; min-height: 56px; max-width: 56px; max-height: 56px; flex-shrink: 0; overflow: hidden;">
          ${App.church && App.church.logo ? `<img src="${esc(safeImgSrc(App.church.logo))}" alt="Logo" class="w-full h-full max-w-full max-h-full object-contain block" style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; display: block;">` : `<img src="/logo-icon.png" alt="Logo" class="w-full h-full max-w-full max-h-full object-contain block" style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; display: block;">`}
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2.5 flex-wrap">
            <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 truncate">
              ${esc(churchName)}
            </h1>
            <span class="chip chip-navy text-[10px] font-semibold">Liturgical Studio</span>
          </div>
          <p class="text-xs text-slate-500 mt-1 truncate">
            ${esc((App.church && App.church.tagline) || 'Weekly order of service planner & vector print publisher')}
          </p>
          <div class="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
            <i data-lucide="calendar" class="w-3.5 h-3.5 text-blue-900"></i>
            <span>Next Sunday: <strong class="text-slate-800 font-semibold">${esc(nextSun)}</strong></span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
        <button class="btn btn-primary text-xs py-2 px-3.5 shadow-sm" data-action="nav" data-page="newService">
          <i data-lucide="calendar-plus" class="w-4 h-4"></i>Plan This Sunday
        </button>
        <button class="btn btn-ghost text-xs py-2 px-3 border border-slate-200" data-action="nav" data-page="templates">
          <i data-lucide="layout-template" class="w-4 h-4 text-slate-500"></i>Templates
        </button>
      </div>
    </div>
  </div>

  <!-- Next Sunday Spotlight Hero -->
  ${nextService ? `
  <div class="card p-5 mb-6 border-l-4 border-l-blue-900 bg-white">
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div class="flex items-start sm:items-center gap-3.5 min-w-0">
        <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-900 border border-blue-100 flex flex-col items-center justify-center shrink-0 leading-none">
          <span class="text-[9px] font-bold uppercase tracking-wider">${esc(fmtMonthDay(nextService.date).month)}</span>
          <span class="text-base font-extrabold mt-0.5">${esc(fmtMonthDay(nextService.date).day)}</span>
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="chip text-[10px] font-bold uppercase tracking-wider">Upcoming Service</span>
            <span class="text-xs text-slate-500 font-medium">${esc(fmtLongDate(nextService.date))}</span>
          </div>
          <h2 class="text-base sm:text-lg font-bold text-slate-900 truncate mt-0.5">
            ${esc(nextService.theme || nextService.templateName || 'Sunday Worship Service')}
          </h2>
          <p class="text-xs text-slate-500 truncate mt-0.5">
            ${(nextService.items || []).length} liturgy items planned${nextService.templateName ? ' • ' + esc(nextService.templateName) : ''}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button class="btn btn-primary text-xs py-1.5 px-3.5" data-action="open-service" data-id="${nextService.id}">
          <i data-lucide="file-edit" class="w-4 h-4"></i>Open Live Editor &amp; Paper
        </button>
        <button class="btn btn-ghost text-xs py-1.5 px-3 border border-slate-200" data-action="download-service-pdf" data-id="${nextService.id}">
          <i data-lucide="file-down" class="w-4 h-4 text-slate-600"></i>PDF
        </button>
      </div>
    </div>
  </div>` : ''}

  <!-- Stats Grid -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-6">
    ${stats.map(st => `
    <button class="card p-4 sm:p-4.5 text-left card-hover cursor-pointer" data-action="nav" data-page="${st.page}">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wide truncate">${st.label}</span>
        <div class="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600 shrink-0">
          <i data-lucide="${st.icon}" class="w-4 h-4"></i>
        </div>
      </div>
      <p class="${st.isText ? 'text-sm sm:text-base font-bold truncate mt-2 text-blue-900' : 'text-2xl font-bold mt-1.5 text-slate-900'}">${st.value}</p>
      <p class="text-[11px] text-slate-500 mt-0.5 truncate">${st.note}</p>
    </button>`).join('')}
  </div>

  <!-- Quick Liturgy Templates Strip -->
  <div class="mb-6">
    <div class="flex items-center justify-between mb-3 px-1">
      <div>
        <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Fast Start from Template</h2>
      </div>
      <button class="text-xs font-semibold text-blue-900 hover:underline flex items-center gap-1" data-action="nav" data-page="templates">
        <span>Browse all blueprints</span><i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
      </button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      ${allTemplates.slice(0, 3).map(t => `
      <div class="card card-hover p-4 cursor-pointer group flex flex-col justify-between" data-action="use-template" data-id="${t.id}">
        <div>
          <div class="flex items-center justify-between">
            <span class="chip text-[10px]">${(t.items || []).length} items</span>
            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform"></i>
          </div>
          <h3 class="font-bold text-sm text-slate-900 mt-2.5 group-hover:text-blue-900 transition-colors truncate">${esc(t.name)}</h3>
          <p class="text-xs text-slate-500 mt-1 line-clamp-2">${esc(t.description || 'Standard weekly liturgy')}</p>
        </div>
        <div class="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-blue-900">
          <span>Use for Sunday</span>
          <i data-lucide="arrow-right" class="w-3 h-3"></i>
        </div>
      </div>`).join('')}
    </div>
  </div>

  <!-- Recent Services -->
  <section class="card">
    <div class="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
      <div>
        <h2 class="text-sm font-bold text-slate-900">Recent Planned Services</h2>
        <p class="text-[11px] text-slate-500">Access and edit your recent Sunday programs.</p>
      </div>
      <button class="btn btn-ghost py-1 px-2.5 text-xs border border-slate-200" data-action="nav" data-page="sundays">View All</button>
    </div>
    ${recent.length ? recent.map(s => {
      const md = fmtMonthDay(s.date);
      return `
      <div class="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-3.5 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors">
        <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-900 border border-blue-100 flex flex-col items-center justify-center shrink-0 leading-none">
          <span class="text-[9px] font-bold tracking-wider">${esc(md.month)}</span>
          <span class="text-sm font-extrabold mt-0.5">${esc(md.day)}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="font-bold text-sm text-slate-900 truncate">${esc(s.theme || s.templateName || 'Sunday Service')}</p>
            <span class="chip text-[10px]">${(s.items || []).length} items</span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5 truncate">${esc(fmtLongDate(s.date))}${s.templateName ? ' • ' + esc(s.templateName) : ''}</p>
        </div>
        <div class="flex gap-2 shrink-0">
          <button class="btn btn-soft py-1 px-3 text-xs" data-action="open-service" data-id="${s.id}">Edit</button>
          <button class="btn btn-ghost py-1 px-3 text-xs border border-slate-200" data-action="download-service-pdf" data-id="${s.id}"><i data-lucide="file-down" class="w-3.5 h-3.5 text-slate-600"></i>PDF</button>
        </div>
      </div>`;
    }).join('') : `
      <div class="px-5 py-10 text-center">
        <div class="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center"><i data-lucide="church" class="w-6 h-6"></i></div>
        <p class="font-bold text-slate-800 mt-2 text-sm">No services planned yet</p>
        <p class="text-xs text-slate-500 mt-0.5">Start by creating your first Sunday service.</p>
        <button class="btn btn-primary mt-4 text-xs" data-action="nav" data-page="newService"><i data-lucide="plus" class="w-4 h-4"></i>Plan Sunday Service</button>
      </div>`}
  </section>`;
}

// ======================================
// THEMES
// ======================================

function miniPaperHtml(theme, church) {
  const primary = themePrimary(theme, church);
  const hf = theme.headingFont === 'serif' ? "'Playfair Display', Georgia, serif" : "'Plus Jakarta Sans', sans-serif";
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
  <div class="card p-4 relative cursor-pointer transition-all ${active ? 'border-blue-900 shadow-md ring-1 ring-blue-900' : 'hover:border-slate-300'}" data-action="set-theme" data-id="${theme.id}" title="Activate theme">
    <div class="pt-1">${miniPaperHtml(theme, church)}</div>
    <div class="mt-3.5 flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="font-bold text-sm text-slate-900 truncate">${esc(theme.name)}</p>
        <p class="text-[11px] text-slate-500 mt-0.5">${theme.builtIn ? 'Built-in' : 'Custom'} • ${theme.headingFont === 'serif' ? 'Serif' : 'Sans'}</p>
      </div>
      ${active ? '<span class="chip chip-navy text-[10px] shrink-0">Active</span>' : ''}
    </div>
    ${!theme.builtIn ? `
    <div class="absolute top-2.5 right-2.5 flex gap-1">
      <button class="icon-btn bg-white border border-slate-200" data-action="edit-theme" data-id="${theme.id}" aria-label="Edit ${esc(theme.name)}"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
      <button class="icon-btn danger bg-white border border-slate-200" data-action="delete-theme" data-id="${theme.id}" aria-label="Delete ${esc(theme.name)}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
    </div>` : ''}
  </div>`;
}

async function renderThemes() {
  App.themeCache = await db.themes.toArray();
  const activeId = (App.church && App.church.activeThemeId) || '';
  return `
  <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900">Document Themes</h1>
      <p class="text-sm text-slate-500 mt-0.5">Select the visual appearance of printed programs and live previews.</p>
    </div>
    <button class="btn btn-primary" data-action="new-theme"><i data-lucide="plus" class="w-4 h-4"></i>Create Custom Theme</button>
  </div>

  <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
    ${App.themeCache.map(t => themeCardHtml(t, App.church, activeId)).join('')}
    <button class="card p-4 border-dashed border-slate-300 hover:border-blue-900 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center text-center min-h-[270px] group" data-action="new-theme">
      <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform"><i data-lucide="plus" class="w-5 h-5"></i></div>
      <p class="font-bold text-slate-800 mt-3 text-sm">Create Theme</p>
      <p class="text-xs text-slate-500 mt-1 px-2">Custom colors, fonts and border styles</p>
    </button>
  </div>`;
}

async function setActiveTheme(id) {
  const theme = (App.themeCache || []).find(t => t.id === id);
  if (!theme) return;
  if (App.church.activeThemeId === id) { toast(theme.name + ' is already active', 'info'); return; }
  App.church.activeThemeId = id;
  await db.church.put(App.church);
  toast(theme.name + ' theme activated');
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
  $('#theme-modal-title').textContent = theme ? 'Edit Theme' : 'Create Custom Theme';
  $('#th-name').value = theme ? theme.name : '';
  const primary = theme ? theme.primary : '#1E3A8A';
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
    text: '"' + theme.name + '" will be deleted.',
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
// ACCOUNT & DATA MANAGEMENT
// ======================================

async function renderAccount() {
  const c = App.church || {};
  return `
  <div class="mb-6">
    <h1 class="text-2xl font-bold tracking-tight text-slate-900">Account &amp; Data Management</h1>
    <p class="text-sm text-slate-500 mt-0.5">Manage local storage, perform JSON backups and restore services.</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
    <div class="card p-6">
      <div class="flex flex-col items-center text-center">
        <div class="w-16 h-16 rounded-2xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center p-1.5 shrink-0 shadow-sm" style="width: 64px; height: 64px; min-width: 64px; min-height: 64px;">
          ${c.logo ? '<img src="' + esc(safeImgSrc(c.logo)) + '" alt="' + esc(c.name) + ' logo" class="w-full h-full max-w-full max-h-full object-contain" style="max-width: 100%; max-height: 100%;">' : '<img src="/logo-icon.png" alt="Logo" class="w-full h-full max-w-full max-h-full object-contain" style="max-width: 100%; max-height: 100%;">'}
        </div>
        <h2 class="text-lg font-bold mt-3 text-slate-900">${esc(c.name || 'Redeem Church')}</h2>
        <p class="text-xs text-slate-500 mt-0.5 break-all">${esc(c.email || 'hello@redeemchurch.org')}</p>
        <span class="chip chip-navy mt-2.5">Local Workspace</span>
      </div>

      <div class="mt-5 divide-y divide-slate-100 border-y border-slate-100 text-xs">
        <div class="flex items-center justify-between py-2.5">
          <span class="text-slate-500 flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4 text-slate-400"></i>Created</span>
          <span class="font-semibold text-slate-800">${esc(fmtMonthYear(c.createdAt))}</span>
        </div>
        <div class="flex items-center justify-between py-2.5">
          <span class="text-slate-500 flex items-center gap-2"><i data-lucide="database" class="w-4 h-4 text-slate-400"></i>IndexedDB Storage</span>
          <span class="font-semibold text-slate-800" id="acc-storage">—</span>
        </div>
        <div class="flex items-center justify-between py-2.5">
          <span class="text-slate-500 flex items-center gap-2"><i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>Privacy</span>
          <span class="font-semibold text-emerald-700">Stored on your device</span>
        </div>
      </div>

      <div class="mt-5 flex flex-col sm:flex-row gap-2.5">
        <button class="btn btn-ghost flex-1 text-xs" data-action="nav" data-page="settings"><i data-lucide="settings" class="w-4 h-4"></i>Settings</button>
        <button class="btn btn-danger flex-1 text-xs" data-action="sign-out"><i data-lucide="trash-2" class="w-4 h-4"></i>Reset Data</button>
      </div>
    </div>

    <!-- Backup & Export Section -->
    <div class="space-y-4">
      <div class="card p-5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center shrink-0"><i data-lucide="download" class="w-4 h-4"></i></div>
          <div>
            <h3 class="font-bold text-sm text-slate-900">Backup &amp; Export</h3>
            <p class="text-xs text-slate-500">Download a full JSON archive of your data.</p>
          </div>
        </div>
        <p class="text-xs text-slate-500 mt-3">Exports all templates, saved Sunday programs and church branding to a single portable file.</p>
        <button class="btn btn-primary w-full mt-4 text-xs" data-action="export-backup"><i data-lucide="download" class="w-4 h-4"></i>Export JSON Backup</button>
      </div>

      <div class="card p-5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"><i data-lucide="upload" class="w-4 h-4"></i></div>
          <div>
            <h3 class="font-bold text-sm text-slate-900">Restore from Backup</h3>
            <p class="text-xs text-slate-500">Import a previously saved JSON file.</p>
          </div>
        </div>
        <p class="text-xs text-slate-500 mt-3">Restores all templates and historical programs back into this browser.</p>
        <button class="btn btn-ghost w-full mt-4 text-xs" data-action="import-backup"><i data-lucide="upload" class="w-4 h-4"></i>Restore from File</button>
        <input type="file" id="backup-file" accept=".json" class="hidden">
      </div>
    </div>
  </div>`;
}

function afterAccount() {
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(est => {
      const el = document.getElementById('acc-storage');
      if (el && est && est.usage != null) el.textContent = (est.usage / 1048576).toFixed(2) + ' MB';
    }).catch(() => {});
  }
}

async function exportBackupJson() {
  try {
    const [church, templates, services, themes, pdfHistory] = await Promise.all([
      db.church.toArray(),
      db.templates.toArray(),
      db.services.toArray(),
      db.themes.toArray(),
      db.pdfHistory.toArray(),
    ]);

    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      church, templates, services, themes, pdfHistory,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'redeem-church-backup-' + isoOf(new Date()) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded');
  } catch (e) {
    console.error(e);
    toast('Could not export backup', 'error');
  }
}

async function handleBackupFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    toast('Backup file is too large (max 10MB)', 'error');
    return;
  }
  try {
    const text = await file.text();
    // Prevent prototype pollution in JSON payload
    if (/"(?:__proto__|constructor|prototype)"\s*:/i.test(text)) {
      toast('Security warning: invalid properties detected in backup file', 'error');
      return;
    }
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.templates) || !Array.isArray(data.church)) {
      toast('Invalid backup format: expected church and templates arrays', 'error');
      return;
    }

    const cleanChurch = data.church.map(c => {
      if (!c || typeof c !== 'object') return null;
      return {
        id: String(c.id || 'main'),
        name: String(c.name || 'Redeem Church').slice(0, 100),
        tagline: String(c.tagline || '').slice(0, 120),
        address: String(c.address || '').slice(0, 200),
        phone: String(c.phone || '').slice(0, 50),
        email: String(c.email || '').slice(0, 100),
        website: String(c.website || '').slice(0, 100),
        brandColor: isValidHex(c.brandColor) ? c.brandColor : '#1E3A8A',
        logo: c.logo ? safeImgSrc(String(c.logo)) : null,
        logoRemoved: !!c.logoRemoved,
        activeThemeId: c.activeThemeId ? String(c.activeThemeId).slice(0, 50) : null,
        createdAt: c.createdAt || new Date().toISOString()
      };
    }).filter(Boolean);

    const cleanTemplates = (data.templates || []).map(t => {
      if (!t || typeof t !== 'object') return null;
      return {
        id: String(t.id || uid()),
        name: String(t.name || 'Untitled Template').slice(0, 100),
        description: String(t.description || '').slice(0, 300),
        items: Array.isArray(t.items) ? t.items.map(it => ({
          id: String(it.id || uid()),
          title: String(it.title || 'Item').slice(0, 100),
          description: String(it.description || '').slice(0, 300),
          requiresPerson: !!it.requiresPerson
        })) : [],
        createdAt: t.createdAt || new Date().toISOString(),
        updatedAt: t.updatedAt || new Date().toISOString()
      };
    }).filter(Boolean);

    const cleanServices = (Array.isArray(data.services) ? data.services : []).map(s => {
      if (!s || typeof s !== 'object') return null;
      return {
        id: String(s.id || uid()),
        templateId: s.templateId ? String(s.templateId) : null,
        templateName: s.templateName ? String(s.templateName).slice(0, 100) : '',
        date: String(s.date || isoOf(nextSunday())).slice(0, 30),
        theme: String(s.theme || '').slice(0, 150),
        description: String(s.description || '').slice(0, 300),
        items: Array.isArray(s.items) ? s.items.map(it => ({
          id: String(it.id || uid()),
          title: String(it.title || 'Item').slice(0, 100),
          description: String(it.description || '').slice(0, 300),
          requiresPerson: !!it.requiresPerson,
          person: String(it.person || '').slice(0, 100)
        })) : [],
        createdAt: s.createdAt || new Date().toISOString(),
        updatedAt: s.updatedAt || new Date().toISOString()
      };
    }).filter(Boolean);

    const cleanThemes = (Array.isArray(data.themes) ? data.themes : []).map(th => {
      if (!th || typeof th !== 'object') return null;
      return {
        id: String(th.id || uid()),
        name: String(th.name || 'Theme').slice(0, 60),
        primary: isValidHex(th.primary) ? th.primary : '#1E3A8A',
        secondary: isValidHex(th.secondary) ? th.secondary : '#5C6670',
        headingFont: th.headingFont === 'serif' ? 'serif' : 'sans',
        bodyFont: th.bodyFont === 'serif' ? 'serif' : 'sans',
        borderStyle: ['none', 'line', 'double'].includes(th.borderStyle) ? th.borderStyle : 'none',
        footerStyle: ['classic', 'line', 'minimal'].includes(th.footerStyle) ? th.footerStyle : 'classic',
        logoPosition: th.logoPosition === 'left' ? 'left' : 'center',
        isDefault: !!th.isDefault
      };
    }).filter(Boolean);

    const cleanHistory = (Array.isArray(data.pdfHistory) ? data.pdfHistory : []).map(h => {
      if (!h || typeof h !== 'object') return null;
      return {
        id: String(h.id || uid()),
        serviceId: h.serviceId ? String(h.serviceId) : null,
        title: String(h.title || 'Order of Service').slice(0, 100),
        date: String(h.date || '').slice(0, 30),
        createdAt: h.createdAt || new Date().toISOString(),
        service: h.service && typeof h.service === 'object' ? h.service : null,
        church: h.church && typeof h.church === 'object' ? h.church : null,
        theme: h.theme && typeof h.theme === 'object' ? h.theme : null,
        fileName: sanitizeFile(String(h.fileName || 'service.pdf')),
        thumbnail: h.thumbnail ? safeImgSrc(String(h.thumbnail)) : null
      };
    }).filter(Boolean);

    const ok = await confirmDialog({
      title: 'Restore backup data?',
      text: 'Import ' + cleanTemplates.length + ' templates and ' + cleanServices.length + ' services.',
      confirmText: 'Restore',
    });
    if (!ok) return;

    if (cleanChurch.length) await db.church.bulkPut(cleanChurch);
    if (cleanTemplates.length) await db.templates.bulkPut(cleanTemplates);
    if (cleanServices.length) await db.services.bulkPut(cleanServices);
    if (cleanThemes.length) await db.themes.bulkPut(cleanThemes);
    if (cleanHistory.length) await db.pdfHistory.bulkPut(cleanHistory);

    App.church = await db.church.get('main');
    await loadThemes();
    applyAccent();
    updateBranding();
    toast('Backup restored successfully');
    showPage('dashboard');
  } catch (err) {
    console.error(err);
    toast('Failed to restore backup: ' + (err.message || 'corrupt file'), 'error');
  }
}

async function signOut() {
  const ok = await confirmDialog({
    title: 'Reset workspace data?',
    text: 'This will remove all templates and saved services from this browser. Ensure you have downloaded a backup.',
    confirmText: 'Reset',
  });
  if (!ok) return;
  try { await db.delete(); } catch (e) { /* ignore */ }
  window.location.reload();
}

// ======================================
// MODAL CONTROLLER
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
    if (m.classList.contains('show')) return;
    m.classList.add('hidden');
    if (!$('.modal.show')) document.body.style.overflow = '';
  }, 200);
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
    confirmButtonColor: (App.church && App.church.brandColor) || '#1E3A8A',
    cancelButtonColor: '#64748B',
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

const BOTTOM_SHORT = { dashboard: 'Home', templates: 'Templates', newService: 'Plan', history: 'History', settings: 'Settings' };

async function showPage(page) {
  App.page = page;
  App.searchQuery = '';
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
    if (id === 'newService') {
      return `
      <div class="flex items-center justify-center">
        <button class="bottom-nav-fab w-11 h-11 -mt-4 rounded-full bg-blue-900 text-white border-2 border-white flex items-center justify-center hover:bg-blue-800" data-action="nav" data-page="newService" data-bottom="newService" aria-label="Plan Sunday Service" title="Plan Sunday Service">
          <i data-lucide="plus" class="w-5 h-5 stroke-[2.5]"></i>
        </button>
      </div>`;
    }
    return `
    <button class="flex flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-slate-500 transition-colors" data-action="nav" data-page="${id}" data-bottom="${id}" aria-label="${esc(n.label || id)}">
      <i data-lucide="${n.icon}" class="w-4 h-4"></i><span>${esc(BOTTOM_SHORT[id] || n.label || id)}</span>
    </button>`;
  }).join('');
}

function updateNavActive() {
  const target = NAV_PARENT[App.page] || App.page;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === target));
  $$('[data-bottom]').forEach(b => {
    const active = b.dataset.bottom === target;
    if (b.dataset.bottom === 'newService') {
      b.classList.toggle('ring-2', active);
      b.classList.toggle('ring-blue-900', active);
      b.classList.toggle('ring-offset-2', active);
    } else {
      b.classList.toggle('text-blue-900', active);
      b.classList.toggle('font-bold', active);
      b.classList.toggle('text-slate-500', !active);
    }
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
// GLOBAL EVENT DISPATCHER
// ======================================

let searchDebounceTimer = null;
function handleSearchInput(type, value) {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(async () => {
    App.searchQuery = value.trim();
    if (type === 'templates') {
      const container = document.getElementById('tpl-list-container');
      if (container && App.page === 'templates') {
        let templates = (await db.templates.toArray()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
        if (App.searchQuery) {
          const q = App.searchQuery.toLowerCase();
          templates = templates.filter(t => t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
        }
        container.innerHTML = templates.length
          ? '<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">' + templates.map(templateCardHtml).join('') + '</div>'
          : `<div class="card p-12 text-center max-w-xl mx-auto">
              <div class="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center"><i data-lucide="layout-template" class="w-6 h-6"></i></div>
              <h3 class="mt-4 font-bold text-slate-800">${App.searchQuery ? 'No templates matching "' + esc(App.searchQuery) + '"' : 'No templates created yet'}</h3>
              <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Create your first template to quickly prepare Sunday services.</p>
              <button class="btn btn-primary mt-5 text-xs" data-action="open-template-editor"><i data-lucide="plus" class="w-4 h-4"></i>Create Template</button>
            </div>`;
        refreshIcons();
      }
    } else if (type === 'sundays') {
      const container = document.getElementById('sundays-list-container');
      if (container && App.page === 'sundays') {
        let services = (await db.services.toArray())
          .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        if (App.searchQuery) {
          const q = App.searchQuery.toLowerCase();
          services = services.filter(s => (s.theme && s.theme.toLowerCase().includes(q)) || (s.templateName && s.templateName.toLowerCase().includes(q)) || (s.date && s.date.includes(q)));
        }
        container.innerHTML = services.length
          ? '<div class="card max-w-4xl divide-y divide-slate-100">' + services.map(sundayRowHtml).join('') + '</div>'
          : `<div class="card p-12 text-center max-w-2xl mx-auto">
              <div class="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center"><i data-lucide="calendar-days" class="w-6 h-6"></i></div>
              <h3 class="mt-4 font-bold text-slate-800">${App.searchQuery ? 'No services found' : 'No saved Sundays yet'}</h3>
              <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Create a Sunday service, assign ministers, and save it here.</p>
              <button class="btn btn-primary mt-5 text-xs" data-action="nav" data-page="newService"><i data-lucide="plus" class="w-4 h-4"></i>Create Sunday Service</button>
            </div>`;
        refreshIcons();
      }
    } else if (type === 'history') {
      const container = document.getElementById('history-list-container');
      if (container && App.page === 'history') {
        let records = (await db.pdfHistory.toArray())
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        if (App.searchQuery) {
          const q = App.searchQuery.toLowerCase();
          records = records.filter(r => (r.service && r.service.theme && r.service.theme.toLowerCase().includes(q)) || (r.date && r.date.includes(q)) || (r.fileName && r.fileName.toLowerCase().includes(q)));
        }
        container.innerHTML = records.length
          ? '<div class="space-y-3.5 max-w-4xl">' + records.map(historyCardHtml).join('') + '</div>'
          : `<div class="card p-12 text-center max-w-2xl mx-auto">
              <div class="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center"><i data-lucide="file-text" class="w-6 h-6"></i></div>
              <h3 class="mt-4 font-bold text-slate-800">${App.searchQuery ? 'No PDFs match search' : 'No PDFs generated yet'}</h3>
              <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Generate your first order of service PDF to automatically save a snapshot here.</p>
              <button class="btn btn-primary mt-5 text-xs" data-action="nav" data-page="newService"><i data-lucide="plus" class="w-4 h-4"></i>Create Sunday Service</button>
            </div>`;
        refreshIcons();
      }
    }
  }, 100);
}

function bindGlobalEvents() {
  document.addEventListener('click', (e) => {
    // Modal backdrop close
    const closer = e.target.closest('[data-close-modal]');
    if (closer) {
      const m = closer.closest('.modal');
      if (m) closeModal(m.id);
      return;
    }
    // Segmented buttons
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
      'add-item':                 () => openItemModal(null, 'template'),
      'edit-item':                () => openItemModal((App.currentTemplate && App.currentTemplate.items.find(i => i.id === id)) || null, 'template'),
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
      'print-history-current':    () => {
        document.body.classList.add('modal-printing');
        window.print();
        setTimeout(() => document.body.classList.remove('modal-printing'), 500);
      },
      'delete-history':           () => deleteHistoryRecord(id),
      'set-theme':                () => setActiveTheme(id),
      'new-theme':                () => openThemeEditor(null),
      'edit-theme':               () => openThemeEditor(id),
      'delete-theme':             () => deleteTheme(id),
      'save-theme':               () => saveThemeFromModal(),
      'logo-upload':              () => { const f = document.getElementById('logo-file'); if (f) f.click(); },
      'logo-remove':              async () => {
        App.church.logo = null;
        App.church.logoRemoved = true;
        try { await db.church.put(App.church); } catch (e) {}
        updateBranding();
        showPage('settings');
        toast('Logo removed');
      },
      'save-settings':            () => saveChurchSettings(),
      'sign-out':                 () => signOut(),
      'export-backup':            () => exportBackupJson(),
      'import-backup':            () => { const f = document.getElementById('backup-file'); if (f) f.click(); },
      'print-live-preview':       () => window.print(),
      'add-service-item':         () => openItemModal(null, 'service'),
      'edit-service-item':        () => {
        const it = (App.currentService && App.currentService.items.find(i => i.id === id)) || null;
        if (it) openItemModal(it, 'service');
      },
      'remove-service-item':      async () => {
        if (!App.currentService) return;
        const it = App.currentService.items.find(i => i.id === id);
        const name = it ? it.title : 'this item';
        const ok = await confirmDialog({
          title: 'Remove service item?',
          text: `Are you sure you want to remove "${name}" from this service?`,
          confirmText: 'Remove'
        });
        if (!ok) return;
        App.currentService.items = App.currentService.items.filter(i => i.id !== id);
        refreshServiceEditorItems();
        refreshLivePreview();
        toast('Item removed');
      },
      'zoom-preview':             () => {
        const delta = parseFloat(t.dataset.delta || '0');
        App.previewScale = Math.max(0.6, Math.min(1.4, App.previewScale + delta));
        const scaler = document.getElementById('live-paper-scaler');
        const txt = document.getElementById('zoom-level-text');
        if (scaler) scaler.style.transform = `scale(${App.previewScale})`;
        if (txt) txt.textContent = Math.round(App.previewScale * 100) + '%';
      },
      'quick-accent':             () => {
        const hex = t.dataset.hex;
        if (hex && App.church) {
          App.church.brandColor = hex;
          const pick = document.getElementById('set-color');
          const hexInput = document.getElementById('set-color-hex');
          if (pick) pick.value = hex;
          if (hexInput) hexInput.value = hex;
          applyAccent();
        }
      }
    };
    const fn = ACTIONS[action];
    if (fn) fn();
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el || (!el.id && !el.dataset)) return;

    // Search inputs (in-place filtering without destroying the active input)
    if (el.id === 'tpl-search-input') {
      handleSearchInput('templates', el.value);
      return;
    }
    if (el.id === 'sundays-search-input') {
      handleSearchInput('sundays', el.value);
      return;
    }
    if (el.id === 'history-search-input') {
      handleSearchInput('history', el.value);
      return;
    }

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
      if (el.dataset.live === 'theme') {
        const titleEl = document.getElementById('se-header-title');
        if (titleEl) titleEl.textContent = el.value || 'Sunday Order of Service';
      }
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
    if (el.id === 'backup-file') {
      handleBackupFile(el.files && el.files[0]);
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
// BOOTSTRAP INITIALIZATION
// ======================================

async function boot() {
  try {
    await db.open();
    await seedIfEmpty();
    App.church = await db.church.get('main');
    if (App.church) {
      let changed = false;
      if (!App.church.logo && !App.church.logoRemoved) { App.church.logo = '/logo.png'; changed = true; }
      if (App.church.name === 'Redeem Church') {
        App.church.name = 'Order of Service';
        App.church.tagline = 'Plan • Create • Worship';
        changed = true;
      }
      if (changed) { try { await db.church.put(App.church); } catch (e) {} }
    }
    await loadThemes();
    applyAccent();
    updateBranding();
    buildNav();
    bindGlobalEvents();
    await showPage('dashboard');
    document.getElementById('app').classList.remove('hidden');
    await new Promise(r => setTimeout(r, 350));
    const ls = document.getElementById('loading-screen');
    if (ls) {
      ls.style.opacity = '0';
      setTimeout(() => { ls.remove(); }, 320);
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
      <h2 class="text-lg font-bold mt-4 text-slate-900">Could not start planner</h2>
      <p class="text-xs text-slate-500 mt-2">Browser storage may be restricted in private window mode or offline.</p>
      <p class="text-xs text-red-600 mt-3 font-mono break-all">${esc(String((err && err.message) || err))}</p>
      <button class="btn btn-primary mt-5 text-xs" onclick="window.location.reload()">Reload Application</button>
    </div>`;
  refreshIcons();
}

window.addEventListener('DOMContentLoaded', () => { boot(); });

