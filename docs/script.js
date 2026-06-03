/* ================================================================
   CONSTANTS & RARITIES
================================================================ */
const FOLDER_HEADER_H  = 34;
const PLAYER_HEADER_H  = 36;
const PLAYER_STATS_H   = 34;
const WORLD_W = 3000, WORLD_H = 3000;
const SCALE_MIN = 0.25, SCALE_MAX = 3.0, SCALE_STEP = 0.15;
const MERGE_DIST = 60;
const STORAGE_KEY = 'fantasy_inventory_v9';

const RARITIES = [
  { key: 'common',    label: 'Common',    color: '#8a8a8a' },
  { key: 'uncommon',  label: 'Uncommon',  color: '#4caf50' },
  { key: 'rare',      label: 'Rare',      color: '#2979ff' },
  { key: 'epic',      label: 'Epic',      color: '#aa44cc' },
  { key: 'legendary', label: 'Legendary', color: '#ff9800' },
  { key: 'mythic',    label: 'Mythic',    color: '#ff1744' },
];
function rarityColor(key) { return (RARITIES.find(r => r.key === key) || RARITIES[0]).color; }

const ITEM_TAGS = [
  { key: 'equipment',  label: 'Equipment',  color: '#e87830', icon: '⚔' },
  { key: 'consumable', label: 'Consumable', color: '#44bb66', icon: '🧪' },
  { key: 'materials',  label: 'Materials',  color: '#aa8844', icon: '🪨' },
  { key: 'special',    label: 'Special',    color: '#cc44aa', icon: '✨' },
  { key: 'valuable',   label: 'Valuable',   color: '#ddcc22', icon: '💎' },
  { key: 'misc',       label: 'Misc',       color: '#778899', icon: '📦' },
];
function getTag(key) { return ITEM_TAGS.find(t => t.key === key) || ITEM_TAGS[ITEM_TAGS.length - 1]; }

const FOLDER_TYPES = [
  { key: 'default',  label: 'Folder',    emoji: '📁' },
  { key: 'chest',    label: 'Chest',     emoji: '🪙' },
  { key: 'backpack', label: 'Backpack',  emoji: '🎒' },
  { key: 'crate',    label: 'Crate',     emoji: '📦' },
  { key: 'bag',      label: 'Bag',       emoji: '👜' },
];
function getFolderType(key) { return FOLDER_TYPES.find(t => t.key === key) || FOLDER_TYPES[0]; }

/* ================================================================
   STATE
================================================================ */
let library   = [];
let inventory = [];
let folders   = [];
let players   = [];
let ropes     = [];
let recipes   = [];

let selectedId      = null;
let multiSelected   = new Set();
let ctxTargetId     = null;
let view = { x: 0, y: 0, scale: 1 };

let connectingFromId = null;
let previewRopeEl    = null;
let ropeDragging     = false;

let lassoActive  = false;
let lassoStart   = { x: 0, y: 0 };
let lassoRect    = null;
let lassoPointer = null;
let lassoHasMoved = false;

let sidebarQty    = 1;
let sidebarRarity = 0;
let sidebarTag    = 'misc';
let pendingImg    = null;
let selectedAvatar = '🧙';
let editingPlayerId = null;

let craftSlotAId = null;
let craftSlotBId = null;
let craftSlotResultId = null;
let pickerTarget = null;

let pendingConfirmCb = null;

let libEditEntryId = null;
let libEditRarityIdx = 0;
let libEditTag = 'misc';

let isPanning = false, panStart = { x: 0, y: 0 }, viewStart = { x: 0, y: 0 };

let pendingCraftHint = null;

let libTagFilter = 'all';

const arrowKeys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
let arrowAnimId = null;
const ARROW_PAN_SPEED = 8;

/* ================================================================
   IMAGE COMPRESSION
================================================================ */
function compressImage(dataUrl, maxSize = 256, quality = 0.72) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else       { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/webp', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/* ================================================================
   DOM REFS
================================================================ */
const viewport      = document.getElementById('canvasViewport');
const world         = document.getElementById('canvasWorld');
const ropeLayer     = document.getElementById('ropeLayer');
const uploadZone    = document.getElementById('uploadZone');
const fileInput     = document.getElementById('fileInput');
const previewImg    = document.getElementById('previewImg');
const placeholder   = document.getElementById('uploadPlaceholder');
const itemNameEl    = document.getElementById('itemName');
const nameWarn      = document.getElementById('nameWarn');
const nameWarnLink  = document.getElementById('nameWarnLink');
const qtyDisplay    = document.getElementById('qtyDisplay');
const rarityDisplay = document.getElementById('rarityDisplay');
const weightInput   = document.getElementById('weightInput');
const goldInput     = document.getElementById('goldInput');
const descInput     = document.getElementById('descInput');        // NEW
const descCharCount = document.getElementById('descCharCount');    // NEW
const addBtn        = document.getElementById('addBtn');
const itemCount     = document.getElementById('itemCount');
const emptyMsg      = document.getElementById('emptyMsg');
const itemControls  = document.getElementById('itemControls');
const ctrlName      = document.getElementById('ctrlName');
const ctrlSub       = document.getElementById('ctrlSub');
const ctrlQty       = document.getElementById('ctrlQty');
const ctrlEject     = document.getElementById('ctrlEject');
const ctrlEjectPlayer = document.getElementById('ctrlEjectPlayer');
const ctrlWeight    = document.getElementById('ctrlWeight');
const ctrlGold      = document.getElementById('ctrlGold');
const ctrlDescPanel = document.getElementById('ctrlDescPanel');    // NEW
const ctrlDescSep   = document.getElementById('ctrlDescSep');      // NEW
const ctrlDescText  = document.getElementById('ctrlDescText');     // NEW
const toastCont     = document.getElementById('toastContainer');
const importInput   = document.getElementById('importInput');
const ctxMenu       = document.getElementById('ctxMenu');
const zoomLabel     = document.getElementById('zoomLabel');
const ctxEjectBtn   = document.getElementById('ctxEjectFolder');
const ctxEjectPlayerBtn = document.getElementById('ctxEjectPlayer');
const connectBanner = document.getElementById('connectBanner');
const libGrid       = document.getElementById('libGrid');
const libEmpty      = document.getElementById('libEmpty');
const libFooter     = document.getElementById('libFooter');
const libSearch     = document.getElementById('libSearch');
const libSearchClear= document.getElementById('libSearchClear');
const multiselectBar= document.getElementById('multiselectBar');
const msCount       = document.getElementById('msCount');
const lassoEl       = document.getElementById('lassoRect');
const playerModal   = document.getElementById('playerModal');
const pmName        = document.getElementById('pmName');
const pmAvatar      = document.getElementById('pmAvatar');
const pmMaxWeight   = document.getElementById('pmMaxWeight');
const pmGold        = document.getElementById('pmGold');
const playerListSidebar = document.getElementById('playerListSidebar');
const playerListEmpty   = document.getElementById('playerListEmpty');
const canvasConfirm = document.getElementById('canvasConfirm');
const craftHintBanner = document.getElementById('craftHintBanner');

/* ================================================================
   UTILITIES
================================================================ */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function toast(msg, warn = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (warn ? ' warn' : '');
  el.textContent = msg;
  toastCont.appendChild(el);
  setTimeout(() => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove(), { once: true }); }, warn ? 3200 : 2400);
}

function libNameExists(name, excludeId = null) {
  return library.some(l => l.id !== excludeId && l.name.trim().toLowerCase() === name.trim().toLowerCase());
}

/* ── Inline Canvas Confirm ── */
function showCanvasConfirm(msg, x, y, onYes) {
  pendingConfirmCb = onYes;
  document.getElementById('canvasConfirmMsg').innerHTML = msg;
  const vr = viewport.getBoundingClientRect();
  const lx = Math.min(x, vr.width - 220);
  const ly = Math.min(y, vr.height - 100);
  canvasConfirm.style.left = lx + 'px';
  canvasConfirm.style.top  = ly + 'px';
  canvasConfirm.classList.add('open');
}
function closeCanvasConfirm() {
  canvasConfirm.classList.remove('open');
  pendingConfirmCb = null;
}
document.getElementById('ccYes').addEventListener('click', () => {
  const cb = pendingConfirmCb; closeCanvasConfirm(); if (cb) cb();
});
document.getElementById('ccNo').addEventListener('click', closeCanvasConfirm);

function containerRelToWorld(item) {
  if (item.folderId) {
    const folder = folders.find(f => f.id === item.folderId);
    if (!folder) return { x: item.wx, y: item.wy };
    return { x: folder.wx + item.wx, y: folder.wy + FOLDER_HEADER_H + item.wy };
  }
  if (item.playerId) {
    const player = players.find(p => p.id === item.playerId);
    if (!player) return { x: item.wx, y: item.wy };
    return { x: player.wx + item.wx, y: player.wy + PLAYER_HEADER_H + PLAYER_STATS_H + item.wy };
  }
  return { x: item.wx, y: item.wy };
}
function folderRelToWorld(item) { return containerRelToWorld(item); }

function itemWorldCenter(item) {
  if (item._dragging && item._dragWx !== undefined) return { x: item._dragWx + 40, y: item._dragWy + 36 };
  const w = containerRelToWorld(item);
  return { x: w.x + 40, y: w.y + 36 };
}

function inFolderBody(wx, wy, folder) {
  return wx >= folder.wx && wx <= folder.wx + folder.w && wy >= folder.wy + FOLDER_HEADER_H && wy <= folder.wy + folder.h + 40;
}
function inPlayerBody(wx, wy, player) {
  const topOffset = PLAYER_HEADER_H + PLAYER_STATS_H;
  return wx >= player.wx && wx <= player.wx + player.w && wy >= player.wy + topOffset && wy <= player.wy + player.h + 40;
}
function screenToWorld(sx, sy) {
  const vr = viewport.getBoundingClientRect();
  return { x: (sx - vr.left - view.x) / view.scale, y: (sy - vr.top - view.y) / view.scale };
}

function playerTotalWeight(playerId) {
  return inventory.filter(i => i.playerId === playerId).reduce((s, i) => s + (i.weight || 0) * i.qty, 0);
}
function playerTotalGoldFromItems(playerId) {
  return inventory.filter(i => i.playerId === playerId).reduce((s, i) => s + (i.gold || 0) * i.qty, 0);
}

/* ================================================================
   PERSISTENCE
================================================================ */
function save() {
  try {
    const data = JSON.stringify({ library, inventory, folders, players, ropes, recipes, view });
    localStorage.setItem(STORAGE_KEY, data);
  } catch (e) {
    if (!save._warned) {
      save._warned = true;
      toast('⚠ Storage nearly full — export to back up!', true);
    }
  }
}

function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) raw = localStorage.getItem('fantasy_inventory_v8');
    if (!raw) raw = localStorage.getItem('fantasy_inventory_v7');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data)) { inventory = data; return; }
    if (data.inventory) inventory = data.inventory;
    if (data.folders)   folders   = data.folders   || [];
    if (data.players)   players   = data.players   || [];
    if (data.ropes)     ropes     = data.ropes     || [];
    if (data.recipes)   recipes   = data.recipes   || [];
    if (data.view)      view      = data.view;
    if (data.library) {
      library = data.library;
    } else {
      const seen = new Set();
      inventory.forEach(it => { const k=it.name.trim().toLowerCase(); if(!seen.has(k)){seen.add(k);library.push({id:uid(),name:it.name,src:it.src,rarity:it.rarity||'common',weight:it.weight||0,gold:it.gold||0,starred:false,tag:'misc',description:''});}});
    }
    library.forEach(l => {
      if (l.gold === undefined) l.gold = 0;
      if (l.starred === undefined) l.starred = false;
      if (!l.tag) l.tag = 'misc';
      if (l.description === undefined) l.description = '';   // NEW
    });
    inventory.forEach(i => {
      if (i.gold === undefined) i.gold = 0;
      if (i.playerId === undefined) i.playerId = null;
      if (!i.tag) i.tag = 'misc';
      if (i.description === undefined) i.description = '';   // NEW
    });
    players.forEach(p => {
      if (p.maxWeight === undefined) p.maxWeight = 50;
      if (p.gold === undefined) p.gold = 100;
      if (p.avatar === undefined) p.avatar = '🧙';
      if (p.w === undefined) p.w = 300;
      if (p.h === undefined) p.h = 220;
    });
    folders.forEach(f => {
      if (!f.type) f.type = 'default';
    });
  } catch(_) { inventory=[]; folders=[]; players=[]; ropes=[]; library=[]; recipes=[]; }
}

/* ================================================================
   EXPORT / IMPORT / CLEAR
================================================================ */
document.getElementById('exportBtn').addEventListener('click', () => {
  if(!inventory.length&&!folders.length&&!players.length&&!library.length){toast('Nothing to export!');return;}
  const exportData = { library, inventory, folders, players, ropes, recipes, view };
  const blob=new Blob([JSON.stringify(exportData, null, 2)],{type:'application/json'});
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'fantasy_inventory.json'});
  a.click();URL.revokeObjectURL(a.href);toast('⬇ Exported!');
});

document.getElementById('importBtn').addEventListener('click', ()=>importInput.click());
importInput.addEventListener('change', e => {
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      if(Array.isArray(data)){
        inventory=data;folders=[];players=[];ropes=[];library=[];recipes=[];
        const seen=new Set();
        inventory.forEach(it=>{const k=it.name.trim().toLowerCase();if(!seen.has(k)){seen.add(k);library.push({id:uid(),name:it.name,src:it.src,rarity:it.rarity||'common',weight:it.weight||0,gold:it.gold||0,starred:false,tag:'misc',description:''});}});
      } else if(data.inventory){
        inventory=data.inventory||[];
        folders=data.folders||[];
        players=data.players||[];
        ropes=data.ropes||[];
        library=data.library||[];
        recipes=data.recipes||[];
        if(data.view) view=data.view;
      } else throw new Error('Unknown format');
      library.forEach(l=>{if(l.gold===undefined)l.gold=0;if(l.starred===undefined)l.starred=false;if(!l.tag)l.tag='misc';if(l.description===undefined)l.description='';});
      inventory.forEach(i=>{if(i.gold===undefined)i.gold=0;if(i.playerId===undefined)i.playerId=null;if(!i.tag)i.tag='misc';if(i.description===undefined)i.description='';});
      players.forEach(p=>{if(p.maxWeight===undefined)p.maxWeight=50;if(p.gold===undefined)p.gold=100;if(p.avatar===undefined)p.avatar='🧙';if(p.w===undefined)p.w=300;if(p.h===undefined)p.h=220;});
      folders.forEach(f=>{if(!f.type)f.type='default';});
      save._warned = false;
      save();renderAll();renderLibrary();renderPlayersSidebar();renderRecipes();applyView();toast('⬆ Inventory imported!');
    }catch(_){toast('✕ Invalid file.',true);}
    importInput.value='';
  };
  reader.readAsText(file);
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if(!inventory.length&&!folders.length&&!players.length){toast('Already empty!');return;}
  showCanvasConfirm('Clear entire canvas?<br/><em>Library & recipes kept.</em>', viewport.getBoundingClientRect().width/2-100, viewport.getBoundingClientRect().height/2-50, () => {
    inventory=[];folders=[];players=[];ropes=[];selectedId=null;multiSelected.clear();
    cancelConnect();closeCtxMenu();hideControls();updateMultiselectBar();
    save();renderAll();renderPlayersSidebar();toast('✕ Canvas cleared.');
  });
});

/* ================================================================
   THEME SYSTEM
================================================================ */
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.themeId;
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (theme === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fantasy_theme', theme);
  });
});
const savedTheme = localStorage.getItem('fantasy_theme');
if (savedTheme && savedTheme !== 'default') {
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.themeId === savedTheme));
}

/* ================================================================
   SIDEBAR TABS
================================================================ */
document.querySelectorAll('.sidebar-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.sidebar-panel').forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    let panelId='forgePanel';
    if(tab.dataset.tab==='library') panelId='libraryPanel';
    else if(tab.dataset.tab==='craft') panelId='craftPanel';
    else if(tab.dataset.tab==='players') panelId='playersPanel';
    document.getElementById(panelId).classList.add('active');
    if(tab.dataset.tab==='library') renderLibrary();
    if(tab.dataset.tab==='players') renderPlayersSidebar();
    if(tab.dataset.tab==='craft') renderCraftPanel();
  });
});
function switchToLibrary() {
  document.querySelectorAll('.sidebar-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.sidebar-panel').forEach(p=>p.classList.remove('active'));
  document.querySelector('[data-tab="library"]').classList.add('active');
  document.getElementById('libraryPanel').classList.add('active');
  renderLibrary();
}
function switchToCraft() {
  document.querySelectorAll('.sidebar-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.sidebar-panel').forEach(p=>p.classList.remove('active'));
  document.querySelector('[data-tab="craft"]').classList.add('active');
  document.getElementById('craftPanel').classList.add('active');
  renderCraftPanel();
}

/* ================================================================
   VIEW & ZOOM
================================================================ */
function applyView() {
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  zoomLabel.textContent = Math.round(view.scale * 100) + '%';
}
function zoomBy(delta, screenX, screenY) {
  const newScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, view.scale + delta));
  if (newScale === view.scale) return;
  const vr = viewport.getBoundingClientRect();
  const ox = screenX - vr.left, oy = screenY - vr.top;
  const wx = (ox - view.x) / view.scale, wy = (oy - view.y) / view.scale;
  view.scale = newScale; view.x = ox - wx * view.scale; view.y = oy - wy * view.scale;
  applyView();
}

viewport.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP, e.clientX, e.clientY); }, { passive: false });
document.getElementById('zoomIn').addEventListener('click', () => { const r=viewport.getBoundingClientRect(); zoomBy(SCALE_STEP, r.left+r.width/2, r.top+r.height/2); });
document.getElementById('zoomOut').addEventListener('click', () => { const r=viewport.getBoundingClientRect(); zoomBy(-SCALE_STEP, r.left+r.width/2, r.top+r.height/2); });
document.getElementById('zoomReset').addEventListener('click', () => { const vr=viewport.getBoundingClientRect(); view.scale=1; view.x=vr.width/2-WORLD_W/2; view.y=vr.height/2-WORLD_H/2; applyView(); });
document.getElementById('canvasFolderBtn').addEventListener('click', () => { openFolderCreateConfirm(); });
document.getElementById('canvasPlayerBtn').addEventListener('click', () => quickCreatePlayer());

function openFolderCreateConfirm() {
  const vr = viewport.getBoundingClientRect();
  const x = vr.width/2 - 100, y = 60;
  document.getElementById('canvasConfirmMsg').innerHTML =
    `<span style="font-size:11px;color:var(--gold-light)">📁 New folder name:</span><br/><input id="folderNameInput" style="margin-top:6px;width:100%;background:rgba(0,0,0,0.5);border:1.5px solid var(--gold);border-radius:3px;color:var(--parchment);font-family:var(--font-body);font-size:13px;padding:5px 7px;outline:none;" placeholder="e.g. Potions…" maxlength="30" />`;
  document.getElementById('ccYes').textContent = '📁 Create';
  document.getElementById('ccNo').textContent = 'Cancel';
  pendingConfirmCb = () => {
    const inp = document.getElementById('folderNameInput');
    const n = inp ? inp.value.trim() : '';
    document.getElementById('ccYes').textContent = 'Confirm';
    document.getElementById('ccNo').textContent = 'Cancel';
    if (n) createFolder(n);
  };
  canvasConfirm.style.left = x + 'px';
  canvasConfirm.style.top  = y + 'px';
  canvasConfirm.classList.add('open');
  requestAnimationFrame(() => {
    const inp = document.getElementById('folderNameInput');
    if (inp) { inp.focus(); inp.addEventListener('keydown', ev => { if(ev.key==='Enter'){ev.preventDefault();document.getElementById('ccYes').click();} }); }
  });
}

viewport.addEventListener('contextmenu', e => { e.preventDefault(); });

viewport.addEventListener('pointerdown', e => {
  if (e.button === 2) {
    e.preventDefault();
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    viewStart = { x: view.x, y: view.y };
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add('panning');
    return;
  }
  if (e.button === 1) {
    e.preventDefault();
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    viewStart = { x: view.x, y: view.y };
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add('panning');
    return;
  }
  if (e.button === 0) {
    const bg = e.target === viewport || e.target === world ||
               e.target.classList.contains('empty-msg') || e.target.classList.contains('empty-icon');
    if (!bg) return;
    if (connectingFromId) { cancelConnect(); return; }
    closeCtxMenu(); closeCanvasConfirm();
    dismissCraftHint();
    lassoActive = true;
    lassoHasMoved = false;
    lassoPointer = e.pointerId;
    lassoStart = { x: e.clientX, y: e.clientY };
    lassoEl.style.display = 'none';
    lassoEl.style.left = lassoEl.style.top = lassoEl.style.width = lassoEl.style.height = '0px';
    viewport.setPointerCapture(e.pointerId);
  }
});

viewport.addEventListener('pointermove', e => {
  if (isPanning) {
    view.x = viewStart.x + (e.clientX - panStart.x);
    view.y = viewStart.y + (e.clientY - panStart.y);
    applyView();
    return;
  }
  if (lassoActive && e.pointerId === lassoPointer) {
    const dx = e.clientX - lassoStart.x, dy = e.clientY - lassoStart.y;
    if (!lassoHasMoved && Math.hypot(dx, dy) < 8) return;
    if (!lassoHasMoved) {
      lassoHasMoved = true;
      deselectItem(); clearMultiSelect();
      lassoEl.style.display = 'block';
    }
    const vr = viewport.getBoundingClientRect();
    const x1 = Math.min(e.clientX, lassoStart.x) - vr.left;
    const y1 = Math.min(e.clientY, lassoStart.y) - vr.top;
    const x2 = Math.max(e.clientX, lassoStart.x) - vr.left;
    const y2 = Math.max(e.clientY, lassoStart.y) - vr.top;
    lassoEl.style.left   = x1 + 'px';
    lassoEl.style.top    = y1 + 'px';
    lassoEl.style.width  = (x2 - x1) + 'px';
    lassoEl.style.height = (y2 - y1) + 'px';
    lassoRect = { x1: x1 + vr.left, y1: y1 + vr.top, x2: x2 + vr.left, y2: y2 + vr.top };
    return;
  }
  if (!connectingFromId || !previewRopeEl || isPanning) return;
  const w = screenToWorld(e.clientX, e.clientY);
  const src = inventory.find(i => i.id === connectingFromId);
  if (!src) return;
  const sc = itemWorldCenter(src);
  previewRopeEl.setAttribute('d', ropePathD(sc.x, sc.y, w.x, w.y));
});

viewport.addEventListener('pointerup', e => {
  if (isPanning) {
    isPanning = false;
    viewport.classList.remove('panning');
    save();
    return;
  }
  if (lassoActive && e.pointerId === lassoPointer) {
    lassoActive = false; lassoPointer = null;
    lassoEl.style.display = 'none';
    if (lassoHasMoved && lassoRect) { applyLassoSelection(lassoRect); }
    else { deselectItem(); clearMultiSelect(); }
    lassoRect = null; lassoHasMoved = false;
    return;
  }
});

function startArrowPan() {
  if (arrowAnimId) return;
  function tick() {
    let moved = false;
    if (arrowKeys.ArrowLeft)  { view.x += ARROW_PAN_SPEED; moved = true; }
    if (arrowKeys.ArrowRight) { view.x -= ARROW_PAN_SPEED; moved = true; }
    if (arrowKeys.ArrowUp)    { view.y += ARROW_PAN_SPEED; moved = true; }
    if (arrowKeys.ArrowDown)  { view.y -= ARROW_PAN_SPEED; moved = true; }
    if (moved) applyView();
    if (arrowKeys.ArrowLeft || arrowKeys.ArrowRight || arrowKeys.ArrowUp || arrowKeys.ArrowDown) {
      arrowAnimId = requestAnimationFrame(tick);
    } else {
      arrowAnimId = null;
      save();
    }
  }
  arrowAnimId = requestAnimationFrame(tick);
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key in arrowKeys) {
    e.preventDefault();
    if (!arrowKeys[e.key]) {
      arrowKeys[e.key] = true;
      startArrowPan();
    }
    return;
  }
  switch(e.key) {
    case 'Escape': cancelConnect(); dismissCraftHint(); closeCanvasConfirm(); break;
  }
});

document.addEventListener('keyup', e => {
  if (e.key in arrowKeys) {
    arrowKeys[e.key] = false;
  }
});

function applyLassoSelection(rect) {
  const vr = viewport.getBoundingClientRect();
  const newSel = new Set();
  inventory.forEach(item => {
    const c = itemWorldCenter(item);
    const sx = c.x * view.scale + view.x + vr.left;
    const sy = c.y * view.scale + view.y + vr.top;
    if (sx >= rect.x1 && sx <= rect.x2 && sy >= rect.y1 && sy <= rect.y2) newSel.add(item.id);
  });
  if (newSel.size > 0) { multiSelected = newSel; renderMultiSelectHighlights(); updateMultiselectBar(); }
}

/* ================================================================
   MULTI-SELECT
================================================================ */
function clearMultiSelect() {
  multiSelected.clear();
  world.querySelectorAll('.inv-item.multi-selected').forEach(el=>el.classList.remove('multi-selected'));
  updateMultiselectBar();
}
function renderMultiSelectHighlights() {
  world.querySelectorAll('.inv-item').forEach(el=>el.classList.toggle('multi-selected',multiSelected.has(el.dataset.id)));
}
function updateMultiselectBar() {
  const count = multiSelected.size;
  multiselectBar.classList.toggle('visible', count > 1);
  msCount.textContent = count;
}
document.getElementById('msDeleteBtn').addEventListener('click', () => {
  if(!multiSelected.size) return;
  const ids = [...multiSelected];
  showCanvasConfirm(`Delete <em>${ids.length} selected items</em>?`, 200, 60, () => {
    ids.forEach(id => { inventory=inventory.filter(i=>i.id!==id); removeRopesForItem(id); });
    multiSelected.clear(); selectedId=null; hideControls(); updateMultiselectBar();
    save(); renderAll(); refreshAllPlayerStats();
    toast(`✕ Deleted ${ids.length} items.`);
  });
});
document.getElementById('msCancelBtn').addEventListener('click', () => clearMultiSelect());

/* ================================================================
   FORGE PANEL — TAG SELECTOR
================================================================ */
function buildForgeTagSelector() {
  const container = document.getElementById('forgeTagSelector');
  if (!container) return;
  container.innerHTML = '';
  ITEM_TAGS.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag-pill' + (sidebarTag === tag.key ? ' active' : '');
    btn.dataset.tagKey = tag.key;
    btn.style.setProperty('--tag-color', tag.color);
    btn.textContent = tag.icon + ' ' + tag.label;
    btn.addEventListener('click', () => {
      sidebarTag = tag.key;
      container.querySelectorAll('.tag-pill').forEach(b => b.classList.toggle('active', b.dataset.tagKey === tag.key));
    });
    container.appendChild(btn);
  });
}

/* ================================================================
   FORGE PANEL
================================================================ */
uploadZone.addEventListener('click', ()=>fileInput.click());
fileInput.addEventListener('change', e=>{if(e.target.files[0])readImg(e.target.files[0]);fileInput.value='';});
uploadZone.addEventListener('dragover', e=>{e.preventDefault();uploadZone.classList.add('drag-over');});
uploadZone.addEventListener('dragleave', ()=>uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e=>{e.preventDefault();uploadZone.classList.remove('drag-over');const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))readImg(f);});

function readImg(file) {
  const r = new FileReader();
  r.onload = async ev => {
    const compressed = await compressImage(ev.target.result, 256, 0.75);
    pendingImg = compressed;
    previewImg.src = pendingImg;
    previewImg.style.display = 'block';
    placeholder.style.display = 'none';
    checkReady();
  };
  r.readAsDataURL(file);
}

function checkReady() { const name=itemNameEl.value.trim();const exists=name&&libNameExists(name);nameWarn.classList.toggle('visible',!!exists);itemNameEl.classList.toggle('error',!!exists);addBtn.disabled=!(pendingImg&&name&&!exists); }
itemNameEl.addEventListener('input', checkReady);
nameWarnLink.addEventListener('click', ()=>switchToLibrary());
document.getElementById('qtyMinus').addEventListener('click', ()=>{if(sidebarQty>1){sidebarQty--;qtyDisplay.textContent=sidebarQty;}});
document.getElementById('qtyPlus').addEventListener('click', ()=>{sidebarQty++;qtyDisplay.textContent=sidebarQty;});
function updateRarityDisplay() { const r=RARITIES[sidebarRarity];rarityDisplay.textContent=r.label;rarityDisplay.className=`selector-display rarity-${r.key}`; }
document.getElementById('rarityPrev').addEventListener('click', ()=>{sidebarRarity=(sidebarRarity-1+RARITIES.length)%RARITIES.length;updateRarityDisplay();});
document.getElementById('rarityNext').addEventListener('click', ()=>{sidebarRarity=(sidebarRarity+1)%RARITIES.length;updateRarityDisplay();});
updateRarityDisplay();

// Description char counter
descInput.addEventListener('input', () => {
  descCharCount.textContent = `${descInput.value.length} / 600`;
});

addBtn.addEventListener('click', () => {
  const name=itemNameEl.value.trim();const weight=parseFloat(weightInput.value)||0;const gold=parseFloat(goldInput.value)||0;
  const description = descInput.value.trim();   // NEW
  if(!name||!pendingImg) return;
  if(libNameExists(name)){toast('⚠ Already in library!',true);return;}
  const rarity=RARITIES[sidebarRarity].key;
  const tag=sidebarTag||'misc';
  const libEntry={id:uid(),name,src:pendingImg,rarity,weight,gold,starred:false,tag,description};  // NEW
  library.push(libEntry);
  placeLibItemOnCanvas(libEntry,sidebarQty);
  itemNameEl.value='';pendingImg=null;sidebarQty=1;sidebarRarity=0;sidebarTag='misc';
  qtyDisplay.textContent='1';weightInput.value='0.0';goldInput.value='0';
  descInput.value='';descCharCount.textContent='0 / 600';   // NEW
  previewImg.style.display='none';previewImg.src='';placeholder.style.display='flex';
  updateRarityDisplay();
  buildForgeTagSelector();
  checkReady();
  toast(`✦ "${name}" forged & added to Library!`);
});

function placeLibItemOnCanvas(libEntry, qty) {
  const vr=viewport.getBoundingClientRect();
  const cx=(vr.width/2-view.x)/view.scale;const cy=(vr.height/2-view.y)/view.scale;
  const scatter=130;
  const item={id:uid(),name:libEntry.name,src:libEntry.src,qty,rarity:libEntry.rarity,weight:libEntry.weight||0,gold:libEntry.gold||0,tag:libEntry.tag||'misc',description:libEntry.description||'',wx:cx+(Math.random()-0.5)*scatter,wy:cy+(Math.random()-0.5)*scatter,folderId:null,playerId:null};  // NEW description
  inventory.push(item);save();renderAll();return item;
}

/* ================================================================
   FOLDER CREATE
================================================================ */
function createFolder(name) {
  const vr=viewport.getBoundingClientRect();
  const cx=(vr.width/2-view.x)/view.scale;const cy=(vr.height/2-view.y)/view.scale;
  const folder={id:uid(),name,type:'default',wx:cx-120,wy:cy-90,w:260,h:200};
  folders.push(folder);save();renderAll();toast(`📁 Folder "${name}" created!`);return folder;
}

/* ================================================================
   PLAYER SYSTEM
================================================================ */
document.querySelectorAll('.player-avatar-pick').forEach(btn => {
  btn.addEventListener('click', ()=>{
    selectedAvatar=btn.dataset.emoji;
    document.getElementById('playerAvatarCustom').value='';
    document.querySelectorAll('.player-avatar-pick').forEach(b=>{b.style.background='rgba(85,153,238,0.05)';b.style.borderColor='rgba(58,111,168,0.4)';});
    btn.style.background='rgba(85,153,238,0.25)';btn.style.borderColor='var(--player-border)';
  });
});
document.getElementById('playerAvatarCustom').addEventListener('input', e=>{if(e.target.value.trim()){selectedAvatar=e.target.value.trim();document.querySelectorAll('.player-avatar-pick').forEach(b=>{b.style.background='rgba(85,153,238,0.05)';b.style.borderColor='rgba(58,111,168,0.4)';});}});
document.getElementById('createPlayerBtn').addEventListener('click', ()=>{
  const name=document.getElementById('playerNameInput').value.trim()||'Adventurer';
  const maxWeight=parseFloat(document.getElementById('playerMaxWeightInput').value)||50;
  const gold=parseFloat(document.getElementById('playerGoldInput').value)||0;
  const avatar=document.getElementById('playerAvatarCustom').value.trim()||selectedAvatar;
  createPlayer(name,maxWeight,gold,avatar);
  document.getElementById('playerNameInput').value='';
  document.getElementById('playerMaxWeightInput').value='50';
  document.getElementById('playerGoldInput').value='100';
  document.getElementById('playerAvatarCustom').value='';
});
function quickCreatePlayer() {
  const vr = viewport.getBoundingClientRect();
  document.getElementById('canvasConfirmMsg').innerHTML =
    `<span style="font-size:11px;color:var(--player-accent-light)">🧙 New player name:</span><br/><input id="playerCreateInput" style="margin-top:6px;width:100%;background:rgba(0,0,0,0.5);border:1.5px solid var(--player-border);border-radius:3px;color:var(--parchment);font-family:var(--font-body);font-size:13px;padding:5px 7px;outline:none;" placeholder="e.g. Aragorn…" maxlength="30" />`;
  document.getElementById('ccYes').textContent = '🧙 Create';
  document.getElementById('ccNo').textContent = 'Cancel';
  pendingConfirmCb = () => {
    const inp = document.getElementById('playerCreateInput');
    const n = inp ? inp.value.trim() : '';
    document.getElementById('ccYes').textContent = 'Confirm';
    document.getElementById('ccNo').textContent = 'Cancel';
    if (n) createPlayer(n, 50, 100, '🧙');
  };
  canvasConfirm.style.left = (vr.width/2-100) + 'px';
  canvasConfirm.style.top  = '60px';
  canvasConfirm.classList.add('open');
  requestAnimationFrame(() => {
    const inp = document.getElementById('playerCreateInput');
    if (inp) { inp.focus(); inp.addEventListener('keydown', ev=>{if(ev.key==='Enter'){ev.preventDefault();document.getElementById('ccYes').click();}}); }
  });
}
function createPlayer(name,maxWeight,gold,avatar) {
  const vr=viewport.getBoundingClientRect();
  const cx=(vr.width/2-view.x)/view.scale;const cy=(vr.height/2-view.y)/view.scale;
  const player={id:uid(),name,avatar:avatar||'🧙',maxWeight:maxWeight||50,gold:gold||0,wx:cx-150,wy:cy-110,w:300,h:220};
  players.push(player);save();renderAll();renderPlayersSidebar();toast(`🧙 Player "${name}" created!`);return player;
}
function renderPlayersSidebar() {
  playerListSidebar.innerHTML='';
  if(!players.length){playerListEmpty.style.display='block';return;}
  playerListEmpty.style.display='none';
  players.forEach(p=>{
    const tw=playerTotalWeight(p.id);const tg=playerTotalGoldFromItems(p.id);const netWorth=tg+(p.gold||0);
    const div=document.createElement('div');
    div.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 8px;background:rgba(10,25,55,0.45);border:1px solid rgba(58,111,168,0.35);border-radius:5px;cursor:pointer;transition:background 0.14s;';
    div.innerHTML=`<span style="font-size:18px;flex-shrink:0;">${p.avatar}</span><div style="flex:1;min-width:0;"><div style="font-family:var(--font-heading);font-size:11px;color:var(--player-accent-light);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div><div style="font-family:var(--font-body);font-size:10px;color:var(--parchment-dark);font-style:italic;">⚖ ${tw.toFixed(1)}/${p.maxWeight}kg · 🪙 ${netWorth.toFixed(0)}gp</div></div>`;
    div.addEventListener('mouseenter',()=>div.style.background='rgba(85,153,238,0.12)');
    div.addEventListener('mouseleave',()=>div.style.background='rgba(10,25,55,0.45)');
    div.addEventListener('click',()=>{const vr=viewport.getBoundingClientRect();view.x=vr.width/2-(p.wx+p.w/2)*view.scale;view.y=vr.height/2-(p.wy+p.h/2)*view.scale;applyView();});
    playerListSidebar.appendChild(div);
  });
}

/* ================================================================
   LIBRARY PANEL
================================================================ */
function buildLibTagFilterBar() {
  const bar = document.getElementById('libTagFilterBar');
  if (!bar) return;
  bar.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'lib-tag-filter-btn' + (libTagFilter === 'all' ? ' active' : '');
  allBtn.dataset.filterKey = 'all';
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => { libTagFilter = 'all'; buildLibTagFilterBar(); renderLibrary(); });
  bar.appendChild(allBtn);
  ITEM_TAGS.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'lib-tag-filter-btn' + (libTagFilter === tag.key ? ' active' : '');
    btn.dataset.filterKey = tag.key;
    btn.style.setProperty('--tag-color', tag.color);
    btn.textContent = tag.icon;
    btn.title = tag.label;
    btn.addEventListener('click', () => {
      libTagFilter = libTagFilter === tag.key ? 'all' : tag.key;
      buildLibTagFilterBar();
      renderLibrary();
    });
    bar.appendChild(btn);
  });
}

function renderLibrary() {
  const query = libSearch.value.trim().toLowerCase();
  let sorted = [...library].sort((a, b) => {
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    return a.name.localeCompare(b.name);
  });
  if (query) sorted = sorted.filter(l => l.name.toLowerCase().includes(query));
  if (libTagFilter !== 'all') sorted = sorted.filter(l => l.tag === libTagFilter);
  libGrid.innerHTML = '';
  if (!library.length) {
    libEmpty.style.display = 'flex';
    libGrid.style.display = 'none';
  } else {
    libEmpty.style.display = 'none';
    libGrid.style.display = 'flex';
    sorted.forEach(entry => libGrid.appendChild(buildLibCard(entry)));
  }
  const total = library.length;
  const shown = sorted.length;
  libFooter.textContent = total
    ? `${total} item${total !== 1 ? 's' : ''} in library` + (shown !== total ? ` (${shown} shown)` : '')
    : 'Library is empty';
}

function buildLibCard(entry) {
  const card=document.createElement('div');card.className='lib-card';card.dataset.lid=entry.id;
  const tag = getTag(entry.tag || 'misc');
  const rc=rarityColor(entry.rarity);
  card.title=`${entry.name}\nRarity: ${entry.rarity}\nTag: ${tag.label}\nWeight: ${entry.weight}kg · Gold: ${entry.gold}gp${entry.description?'\n\n'+entry.description:''}\n\nClick to place · Drag onto canvas`;

  const frame=document.createElement('div');frame.className='lib-card-frame';frame.style.borderColor=rc;frame.style.boxShadow=`0 0 5px ${rc}55`;
  const img=document.createElement('img');img.src=entry.src;img.alt=entry.name;img.draggable=false;frame.appendChild(img);

  const rarityDot=document.createElement('div');rarityDot.className='lib-card-rarity';rarityDot.style.color=rc;rarityDot.style.background=rc;frame.appendChild(rarityDot);

  const starBtn=document.createElement('button');
  starBtn.className='lib-card-star' + (entry.starred ? ' starred' : '');
  starBtn.textContent = entry.starred ? '★' : '☆';
  starBtn.title = entry.starred ? 'Unstar item' : 'Star item (pins to top)';
  starBtn.addEventListener('pointerdown', e => e.stopPropagation());
  starBtn.addEventListener('click', e => {
    e.stopPropagation(); e.preventDefault();
    entry.starred = !entry.starred;
    save();
    renderLibrary();
  });
  frame.appendChild(starBtn);

  const tagBadge=document.createElement('div');
  tagBadge.className='lib-card-tag-badge';
  tagBadge.style.setProperty('--tag-color', tag.color);
  tagBadge.textContent = tag.icon;
  tagBadge.title = tag.label;
  frame.appendChild(tagBadge);

  const nameEl=document.createElement('div');nameEl.className='lib-card-name';nameEl.textContent=entry.name;
  const btns=document.createElement('div');btns.className='lib-card-btns';
  const editBtn=document.createElement('button');editBtn.className='lib-card-btn lib-card-edit';editBtn.textContent='✎';editBtn.title='Edit item';
  editBtn.addEventListener('pointerdown',e=>e.stopPropagation());
  editBtn.addEventListener('click',e=>{e.stopPropagation();e.preventDefault();openLibEdit(entry.id);});
  const removeBtn=document.createElement('button');removeBtn.className='lib-card-btn lib-card-remove';removeBtn.textContent='×';removeBtn.title=`Remove "${entry.name}"`;
  removeBtn.addEventListener('pointerdown',e=>e.stopPropagation());
  removeBtn.addEventListener('click',e=>{e.stopPropagation();e.preventDefault();removeFromLibrary(entry.id);});
  btns.appendChild(editBtn);btns.appendChild(removeBtn);
  card.appendChild(frame);card.appendChild(nameEl);card.appendChild(btns);

  let libDragging=false,libMoved=false,libMS={x:0,y:0};let ghostEl=null;
  card.addEventListener('pointerdown',e=>{if(e.target===editBtn||e.target===removeBtn||e.target===starBtn)return;e.stopPropagation();libDragging=true;libMoved=false;libMS={x:e.clientX,y:e.clientY};card.setPointerCapture(e.pointerId);});
  card.addEventListener('pointermove',e=>{
    if(!libDragging) return;
    const dx=e.clientX-libMS.x,dy=e.clientY-libMS.y;
    if(!libMoved&&Math.hypot(dx,dy)<6) return;
    if(!libMoved){libMoved=true;ghostEl=document.createElement('div');ghostEl.style.cssText=`position:fixed;pointer-events:none;z-index:9000;width:56px;height:56px;border:2px solid ${rc};border-radius:6px;background:rgba(0,0,0,0.7);overflow:hidden;opacity:0.85;box-shadow:0 4px 20px rgba(0,0,0,0.6),0 0 12px ${rc}88;transform:translate(-50%,-50%);`;const gImg=document.createElement('img');gImg.src=entry.src;gImg.style.cssText='width:100%;height:100%;object-fit:contain;padding:4px;';ghostEl.appendChild(gImg);document.body.appendChild(ghostEl);}
    if(ghostEl){ghostEl.style.left=e.clientX+'px';ghostEl.style.top=e.clientY+'px';}
    const vr=viewport.getBoundingClientRect();const over=e.clientX>=vr.left&&e.clientX<=vr.right&&e.clientY>=vr.top&&e.clientY<=vr.bottom;viewport.style.boxShadow=over?`inset 0 0 0 2px ${rc}`:'';
  });
  card.addEventListener('pointerup',e=>{
    if(!libDragging) return;libDragging=false;if(ghostEl){ghostEl.remove();ghostEl=null;}viewport.style.boxShadow='';
    if(!libMoved){placeLibItemOnCanvas(entry,1);toast(`✦ "${entry.name}" placed!`);return;}
    const vr=viewport.getBoundingClientRect();const over=e.clientX>=vr.left&&e.clientX<=vr.right&&e.clientY>=vr.top&&e.clientY<=vr.bottom;
    if(!over){toast('Drop onto the canvas to place',true);return;}
    const wx=(e.clientX-vr.left-view.x)/view.scale-40;const wy=(e.clientY-vr.top-view.y)/view.scale-36;
    const item={id:uid(),name:entry.name,src:entry.src,qty:1,rarity:entry.rarity,weight:entry.weight||0,gold:entry.gold||0,tag:entry.tag||'misc',description:entry.description||'',wx,wy,folderId:null,playerId:null};
    inventory.push(item);save();renderAll();toast(`✦ "${entry.name}" placed!`);
  });
  return card;
}

/* Library item edit panel */
function openLibEdit(libId) {
  const entry = library.find(l=>l.id===libId); if (!entry) return;
  libEditEntryId = libId;
  libEditRarityIdx = RARITIES.findIndex(r=>r.key===entry.rarity)||0;
  libEditTag = entry.tag || 'misc';
  document.getElementById('libEditImg').src = entry.src;
  document.getElementById('libEditTitle').textContent = `Edit: ${entry.name}`;
  document.getElementById('libEditName').value = entry.name;
  document.getElementById('libEditWeight').value = entry.weight;
  document.getElementById('libEditGold').value = entry.gold;
  // Description NEW
  const libEditDescEl = document.getElementById('libEditDesc');
  const libEditDescCountEl = document.getElementById('libEditDescCount');
  libEditDescEl.value = entry.description || '';
  libEditDescCountEl.textContent = `${libEditDescEl.value.length} / 600`;
  libEditDescEl.oninput = () => { libEditDescCountEl.textContent = `${libEditDescEl.value.length} / 600`; };
  updateLibEditRarityDisplay();
  buildLibEditTagSelector();
  document.getElementById('libEditPanel').classList.add('open');
}
function updateLibEditRarityDisplay() {
  const r=RARITIES[libEditRarityIdx];
  const d=document.getElementById('libEditRarityDisplay');
  d.textContent=r.label;d.className=`selector-display rarity-${r.key}`;
}
function buildLibEditTagSelector() {
  const container = document.getElementById('libEditTagSelector');
  if (!container) return;
  container.innerHTML = '';
  ITEM_TAGS.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag-pill' + (libEditTag === tag.key ? ' active' : '');
    btn.dataset.tagKey = tag.key;
    btn.style.setProperty('--tag-color', tag.color);
    btn.textContent = tag.icon + ' ' + tag.label;
    btn.addEventListener('click', () => {
      libEditTag = tag.key;
      container.querySelectorAll('.tag-pill').forEach(b => b.classList.toggle('active', b.dataset.tagKey === tag.key));
    });
    container.appendChild(btn);
  });
}

document.getElementById('libEditRarityPrev').addEventListener('click',()=>{libEditRarityIdx=(libEditRarityIdx-1+RARITIES.length)%RARITIES.length;updateLibEditRarityDisplay();});
document.getElementById('libEditRarityNext').addEventListener('click',()=>{libEditRarityIdx=(libEditRarityIdx+1)%RARITIES.length;updateLibEditRarityDisplay();});
document.getElementById('libEditClose').addEventListener('click',()=>document.getElementById('libEditPanel').classList.remove('open'));
document.getElementById('libEditCancel').addEventListener('click',()=>document.getElementById('libEditPanel').classList.remove('open'));
document.getElementById('libEditSave').addEventListener('click',()=>{
  const entry=library.find(l=>l.id===libEditEntryId);if(!entry) return;
  const newName=document.getElementById('libEditName').value.trim()||entry.name;
  if(newName!==entry.name&&libNameExists(newName,libEditEntryId)){toast('⚠ Name already exists!',true);return;}
  const oldName=entry.name;
  entry.name=newName;
  entry.rarity=RARITIES[libEditRarityIdx].key;
  entry.weight=parseFloat(document.getElementById('libEditWeight').value)||0;
  entry.gold=parseFloat(document.getElementById('libEditGold').value)||0;
  entry.tag=libEditTag||'misc';
  entry.description=document.getElementById('libEditDesc').value.trim();  // NEW
  inventory.forEach(i=>{if(i.name.trim().toLowerCase()===oldName.trim().toLowerCase()){i.name=entry.name;i.rarity=entry.rarity;i.weight=entry.weight;i.gold=entry.gold;i.tag=entry.tag;i.description=entry.description;}});  // NEW sync
  save();renderLibrary();renderAll();refreshAllPlayerStats();
  document.getElementById('libEditPanel').classList.remove('open');
  toast(`✎ "${entry.name}" updated!`);
});

function removeFromLibrary(libId) {
  const entry=library.find(l=>l.id===libId);if(!entry) return;
  const inUse=inventory.filter(i=>i.name.toLowerCase()===entry.name.toLowerCase()).length;
  showCanvasConfirm(
    `Remove <em>${entry.name}</em> from library?${inUse>0?`<br/><span style="font-size:10px;opacity:0.7">${inUse} canvas instance(s) will remain</span>`:''}`,
    100, 200, () => {
      library=library.filter(l=>l.id!==libId);save();renderLibrary();toast(`📚 "${entry.name}" removed.`);
    }
  );
}

libSearch.addEventListener('input',()=>{libSearchClear.classList.toggle('hidden',!libSearch.value);renderLibrary();});
libSearchClear.addEventListener('click',()=>{libSearch.value='';libSearchClear.classList.add('hidden');renderLibrary();});

/* ================================================================
   CRAFTING SYSTEM
================================================================ */
function renderCraftPanel() {
  updateCraftSlotUI('a');
  updateCraftSlotUI('b');
  updateCraftSlotUI('result');
  updateCraftBtn();
  renderRecipes();
}

function getLibEntry(id) { return library.find(l=>l.id===id); }

function updateCraftSlotUI(slot) {
  const slotEl = document.getElementById(slot==='result'?'craftSlotResult':(slot==='a'?'craftSlotA':'craftSlotB'));
  const libId = slot==='result' ? craftSlotResultId : (slot==='a' ? craftSlotAId : craftSlotBId);
  const entry = libId ? getLibEntry(libId) : null;
  slotEl.innerHTML = '';
  if (entry) {
    const rc = rarityColor(entry.rarity);
    slotEl.className = slot==='result' ? 'craft-result-slot filled' : 'craft-slot filled';
    const thumb=document.createElement('div');thumb.className='craft-slot-thumb';
    const img=document.createElement('img');img.src=entry.src;img.alt=entry.name;
    thumb.appendChild(img);slotEl.appendChild(thumb);
    const nm=document.createElement('div');nm.className='craft-slot-name';nm.style.color=rc;nm.textContent=entry.name;slotEl.appendChild(nm);
    const clr=document.createElement('button');clr.className='craft-slot-clear';clr.textContent='✕ clear';
    clr.addEventListener('click',e=>{e.stopPropagation();if(slot==='a')craftSlotAId=null;else if(slot==='b')craftSlotBId=null;else craftSlotResultId=null;updateCraftSlotUI(slot);updateCraftBtn();});
    slotEl.appendChild(clr);
  } else {
    slotEl.className = slot==='result' ? 'craft-result-slot unfilled' : 'craft-slot';
    const icon=document.createElement('span');icon.className='craft-slot-empty-icon';icon.textContent=slot==='result'?'✨':(slot==='a'?'🪄':'🌿');
    const txt=document.createElement('span');txt.className='craft-slot-empty-text';txt.textContent='Click to pick\nfrom library';
    slotEl.appendChild(icon);slotEl.appendChild(txt);
  }
  slotEl.addEventListener('click',()=>openItemPicker(slot));
}

function updateCraftBtn() {
  const ready = craftSlotAId && craftSlotBId && craftSlotResultId;
  document.getElementById('craftBtn').disabled = !ready;
  document.getElementById('saveRecipeBtn').disabled = !ready;
}

function openItemPicker(slot) {
  pickerTarget = slot;
  document.getElementById('itemPickerTitle').textContent = slot==='result' ? 'Pick Result Item' : 'Pick Ingredient';
  const grid = document.getElementById('itemPickerGrid');
  grid.innerHTML = '';
  if (!library.length) { grid.innerHTML='<div style="padding:20px;text-align:center;color:var(--ink-faded);font-style:italic;font-size:12px;">No library items yet.</div>'; }
  else {
    library.forEach(entry => {
      const rc = rarityColor(entry.rarity);
      const card=document.createElement('div');card.className='picker-card';
      const frame=document.createElement('div');frame.className='picker-card-frame';frame.style.borderColor=rc;
      const img=document.createElement('img');img.src=entry.src;img.alt=entry.name;
      frame.appendChild(img);
      const nm=document.createElement('div');nm.className='picker-card-name';nm.textContent=entry.name;
      card.appendChild(frame);card.appendChild(nm);
      card.addEventListener('click',()=>{ selectPickerItem(entry.id); });
      grid.appendChild(card);
    });
  }
  document.getElementById('itemPickerOverlay').classList.add('open');
}
function selectPickerItem(libId) {
  if(pickerTarget==='a') craftSlotAId=libId;
  else if(pickerTarget==='b') craftSlotBId=libId;
  else craftSlotResultId=libId;
  document.getElementById('itemPickerOverlay').classList.remove('open');
  updateCraftSlotUI(pickerTarget);
  updateCraftBtn();
}
document.getElementById('itemPickerClose').addEventListener('click',()=>document.getElementById('itemPickerOverlay').classList.remove('open'));

document.getElementById('craftBtn').addEventListener('click', ()=>{
  if(!craftSlotAId||!craftSlotBId||!craftSlotResultId) return;
  executeCraft(craftSlotAId, craftSlotBId, craftSlotResultId);
});

function executeCraft(aLibId, bLibId, resultLibId) {
  const ea = getLibEntry(aLibId), eb = getLibEntry(bLibId), er = getLibEntry(resultLibId);
  if(!ea||!eb||!er) { toast('⚠ Library entries missing',true); return; }
  const sameIngredient = (aLibId === bLibId);
  const aMatches = inventory.filter(i => i.name.trim().toLowerCase() === ea.name.trim().toLowerCase() && i.qty >= 1);
  const bMatches = inventory.filter(i => i.name.trim().toLowerCase() === eb.name.trim().toLowerCase() && i.qty >= 1);
  if (!aMatches.length) { toast(`⚠ Need "${ea.name}" on canvas`, true); return; }
  let itemA, itemB;
  if (sameIngredient) {
    const stackOf2 = aMatches.find(i => i.qty >= 2);
    if (stackOf2) { itemA = stackOf2; itemB = stackOf2; }
    else if (aMatches.length >= 2) { itemA = aMatches[0]; itemB = aMatches[1]; }
    else { toast(`⚠ Need at least 2 × "${ea.name}"`, true); return; }
  } else {
    itemA = aMatches[0];
    if (!bMatches.length) { toast(`⚠ Need "${eb.name}" on canvas`, true); return; }
    itemB = bMatches[0];
  }
  const spawnPos = containerRelToWorld(itemA);
  if (itemA === itemB) { itemA.qty -= 2; } else { itemA.qty -= 1; itemB.qty -= 1; }
  const toRemove = [];
  if (itemA.qty <= 0) toRemove.push(itemA.id);
  if (itemB !== itemA && itemB.qty <= 0) toRemove.push(itemB.id);
  toRemove.forEach(id => { inventory = inventory.filter(i => i.id !== id); removeRopesForItem(id); });
  const resultItem = {
    id: uid(), name: er.name, src: er.src, qty: 1, rarity: er.rarity,
    weight: er.weight || 0, gold: er.gold || 0, tag: er.tag || 'misc',
    description: er.description || '',   // NEW
    wx: spawnPos.x + 110 + Math.random() * 40,
    wy: spawnPos.y + (Math.random() - 0.5) * 40,
    folderId: null, playerId: null
  };
  inventory.push(resultItem);
  save(); renderAll(); refreshAllPlayerStats();
  requestAnimationFrame(() => {
    const el = world.querySelector(`[data-id="${resultItem.id}"]`);
    if (el) { el.classList.add('craft-flash'); el.addEventListener('animationend', () => el.classList.remove('craft-flash'), { once: true }); }
  });
  toast(`⚗ Crafted "${er.name}"!`);
}

document.getElementById('saveRecipeBtn').addEventListener('click', ()=>{
  if(!craftSlotAId||!craftSlotBId||!craftSlotResultId) return;
  const dup=recipes.find(r=>{
    const sameAB=(r.a===craftSlotAId&&r.b===craftSlotBId)||(r.a===craftSlotBId&&r.b===craftSlotAId);
    return sameAB&&r.result===craftSlotResultId;
  });
  if(dup){toast('⚠ Recipe already saved!',true);return;}
  recipes.push({id:uid(),a:craftSlotAId,b:craftSlotBId,result:craftSlotResultId});
  save();renderRecipes();toast('💾 Recipe saved!');
});

function renderRecipes() {
  const list=document.getElementById('recipeList');
  const section=document.getElementById('recipeSection');
  list.innerHTML='';
  const validRecipes=recipes.filter(r=>getLibEntry(r.a)&&getLibEntry(r.b)&&getLibEntry(r.result));
  recipes=validRecipes;
  if(!validRecipes.length){section.style.display='none';return;}
  section.style.display='block';
  validRecipes.forEach(recipe=>{
    const ea=getLibEntry(recipe.a),eb=getLibEntry(recipe.b),er=getLibEntry(recipe.result);
    const row=document.createElement('div');row.className='craft-recipe-item';
    row.title=`Click to load recipe`;
    const mkThumb=(e)=>{const d=document.createElement('div');d.className='craft-recipe-thumb';const img=document.createElement('img');img.src=e.src;img.alt=e.name;d.appendChild(img);return d;};
    const txt=document.createElement('div');txt.className='craft-recipe-text';
    txt.innerHTML=`<strong>${ea.name}</strong> + <strong>${eb.name}</strong> → <strong style="color:var(--gold-light)">${er.name}</strong>`;
    const del=document.createElement('button');del.className='craft-recipe-del';del.textContent='✕';del.title='Delete recipe';
    del.addEventListener('click',e=>{e.stopPropagation();recipes=recipes.filter(r=>r.id!==recipe.id);save();renderRecipes();toast('Recipe deleted.');});
    const quickCraft=document.createElement('button');quickCraft.style.cssText='border:none;background:rgba(80,200,40,0.15);border-radius:3px;color:#80d040;font-size:9px;padding:2px 6px;cursor:pointer;font-family:var(--font-heading);';quickCraft.textContent='⚗ Craft';
    quickCraft.addEventListener('click',e=>{e.stopPropagation();executeCraft(recipe.a,recipe.b,recipe.result);});
    row.appendChild(mkThumb(ea));row.appendChild(txt);row.appendChild(quickCraft);row.appendChild(del);
    row.addEventListener('click',()=>{craftSlotAId=recipe.a;craftSlotBId=recipe.b;craftSlotResultId=recipe.result;renderCraftPanel();});
    list.appendChild(row);
  });
}

let craftHintCb = null;
function showCraftHint(msg, onCraft) {
  craftHintCb = onCraft;
  document.getElementById('craftHintMsg').textContent = msg;
  craftHintBanner.classList.add('visible');
}
function dismissCraftHint() { craftHintBanner.classList.remove('visible'); craftHintCb=null; pendingCraftHint=null; }
document.getElementById('craftHintYes').addEventListener('click',()=>{ if(craftHintCb)craftHintCb(); dismissCraftHint(); });
document.getElementById('craftHintNo').addEventListener('click',()=>dismissCraftHint());

function checkCraftHintForDrop(droppedItem, nearbyItem) {
  const di=droppedItem.name.trim().toLowerCase();
  const ni=nearbyItem.name.trim().toLowerCase();
  const recipe=recipes.find(r=>{
    const ea=getLibEntry(r.a),eb=getLibEntry(r.b);if(!ea||!eb) return false;
    const ean=ea.name.trim().toLowerCase(),ebn=eb.name.trim().toLowerCase();
    return (ean===di&&ebn===ni)||(ean===ni&&ebn===di);
  });
  if(recipe){
    const er=getLibEntry(recipe.result);if(!er) return;
    showCraftHint(`"${droppedItem.name}" + "${nearbyItem.name}" → "${er.name}"`, ()=>{
      executeCraft(recipe.a, recipe.b, recipe.result);
    });
  }
}

/* ================================================================
   ROPE SYSTEM
================================================================ */
function ropePathD(x1,y1,x2,y2) { const dist=Math.hypot(x2-x1,y2-y1);const sag=Math.min(dist*0.22,90);const mx=(x1+x2)/2,my=(y1+y2)/2+sag;return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`; }
function buildRopeElement(rope) {
  const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.dataset.ropeId=rope.id;
  const shadow=document.createElementNS('http://www.w3.org/2000/svg','path');shadow.setAttribute('class','rope-path');shadow.setAttribute('stroke','rgba(0,0,0,0.45)');shadow.setAttribute('stroke-width','5');shadow.style.pointerEvents='none';
  const body=document.createElementNS('http://www.w3.org/2000/svg','path');body.setAttribute('class','rope-path');body.setAttribute('stroke','#7a4e1a');body.setAttribute('stroke-width','4');body.style.pointerEvents='none';
  const highlight=document.createElementNS('http://www.w3.org/2000/svg','path');highlight.setAttribute('class','rope-path');highlight.setAttribute('stroke','#c8922a');highlight.setAttribute('stroke-width','1.5');highlight.setAttribute('stroke-dasharray','6 8');highlight.style.pointerEvents='none';
  const hit=document.createElementNS('http://www.w3.org/2000/svg','path');hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','24');hit.setAttribute('fill','none');hit.style.cursor='grab';hit.style.pointerEvents='stroke';hit.dataset.ropeId=rope.id;
  g.appendChild(shadow);g.appendChild(body);g.appendChild(highlight);g.appendChild(hit);
  let rdDragging=false,rdMoved=false,rdMS={x:0,y:0},rdA={x:0,y:0},rdB={x:0,y:0};
  hit.addEventListener('pointerdown',e=>{e.stopPropagation();if(connectingFromId) return;closeCtxMenu();const ia=inventory.find(i=>i.id===rope.a),ib=inventory.find(i=>i.id===rope.b);if(!ia||!ib) return;if(ia.folderId||ib.folderId||ia.playerId||ib.playerId){toast('Cannot drag rope — items are in containers',true);return;}rdDragging=true;rdMoved=false;ropeDragging=true;rdMS={x:e.clientX,y:e.clientY};rdA={x:ia.wx,y:ia.wy};rdB={x:ib.wx,y:ib.wy};hit.setPointerCapture(e.pointerId);hit.style.cursor='grabbing';});
  hit.addEventListener('pointermove',e=>{if(!rdDragging) return;const dx=(e.clientX-rdMS.x)/view.scale,dy=(e.clientY-rdMS.y)/view.scale;if(!rdMoved&&Math.hypot(dx,dy)<4) return;rdMoved=true;const ia=inventory.find(i=>i.id===rope.a),ib=inventory.find(i=>i.id===rope.b);if(!ia||!ib) return;ia.wx=rdA.x+dx;ia.wy=rdA.y+dy;ib.wx=rdB.x+dx;ib.wy=rdB.y+dy;const elA=world.querySelector(`[data-id="${ia.id}"]`),elB=world.querySelector(`[data-id="${ib.id}"]`);if(elA){elA.style.left=ia.wx+'px';elA.style.top=ia.wy+'px';}if(elB){elB.style.left=ib.wx+'px';elB.style.top=ib.wy+'px';}updateAllRopePaths();});
  hit.addEventListener('pointerup',()=>{if(!rdDragging) return;rdDragging=false;ropeDragging=false;hit.style.cursor='grab';if(!rdMoved){showCanvasConfirm('Remove this rope connection?',200,200,()=>{ropes=ropes.filter(r=>r.id!==rope.id);save();renderRopes();toast('🔗 Connection removed.');});}else save();});
  return g;
}
function updateAllRopePaths() {
  ropes.forEach(rope=>{const ia=inventory.find(i=>i.id===rope.a),ib=inventory.find(i=>i.id===rope.b);if(!ia||!ib) return;const ca=itemWorldCenter(ia),cb=itemWorldCenter(ib);const d=ropePathD(ca.x,ca.y,cb.x,cb.y);const g=ropeLayer.querySelector(`g[data-rope-id="${rope.id}"]`);if(g)g.querySelectorAll('path').forEach(p=>p.setAttribute('d',d));});
}
function renderRopes() {
  ropeLayer.querySelectorAll('g[data-rope-id]').forEach(el=>el.remove());
  const ids=new Set(inventory.map(i=>i.id));ropes=ropes.filter(r=>ids.has(r.a)&&ids.has(r.b));
  ropes.forEach(rope=>{const ia=inventory.find(i=>i.id===rope.a),ib=inventory.find(i=>i.id===rope.b);if(!ia||!ib) return;const ca=itemWorldCenter(ia),cb=itemWorldCenter(ib);const d=ropePathD(ca.x,ca.y,cb.x,cb.y);const g=buildRopeElement(rope);g.querySelectorAll('path').forEach(p=>p.setAttribute('d',d));if(previewRopeEl)ropeLayer.insertBefore(g,previewRopeEl);else ropeLayer.appendChild(g);});
}
function hasRope(idA,idB){return ropes.some(r=>(r.a===idA&&r.b===idB)||(r.a===idB&&r.b===idA));}
function removeRopesForItem(id){ropes=ropes.filter(r=>r.a!==id&&r.b!==id);renderRopes();}
function breakRopesOnContextChange(id){const had=ropes.some(r=>r.a===id||r.b===id);if(had){ropes=ropes.filter(r=>r.a!==id&&r.b!==id);renderRopes();toast('🔗 Rope(s) broken');}}
function startConnect(fromId){connectingFromId=fromId;connectBanner.classList.add('visible');world.querySelectorAll('.inv-item').forEach(el=>el.classList.toggle('connecting-source',el.dataset.id===fromId));previewRopeEl=document.createElementNS('http://www.w3.org/2000/svg','path');previewRopeEl.setAttribute('class','rope-preview-path');ropeLayer.appendChild(previewRopeEl);}
function cancelConnect(){connectingFromId=null;connectBanner.classList.remove('visible');if(previewRopeEl){previewRopeEl.remove();previewRopeEl=null;}world.querySelectorAll('.inv-item').forEach(el=>el.classList.remove('connecting-source','connect-hover'));}
document.getElementById('cancelConnectBtn').addEventListener('click', cancelConnect);

/* ================================================================
   RENDER ALL
================================================================ */
function renderAll() {
  world.querySelectorAll('.inv-folder, .inv-player, .inv-item').forEach(el=>el.remove());
  folders.forEach(f=>world.appendChild(buildFolderEl(f)));
  players.forEach(p=>world.appendChild(buildPlayerEl(p)));
  inventory.forEach(item=>{
    const el=buildItemEl(item);
    if(item.folderId){const bodyEl=world.querySelector(`.inv-folder[data-fid="${item.folderId}"] .folder-body`);if(bodyEl)bodyEl.appendChild(el);else{item.folderId=null;world.appendChild(el);}}
    else if(item.playerId){const bodyEl=world.querySelector(`.inv-player[data-pid="${item.playerId}"] .player-body`);if(bodyEl)bodyEl.appendChild(el);else{item.playerId=null;world.appendChild(el);}}
    else world.appendChild(el);
  });
  folders.forEach(f=>{
    const items = inventory.filter(i=>i.folderId===f.id);
    const totalQty = items.reduce((s,i)=>s+i.qty,0);
    const label=world.querySelector(`.inv-folder[data-fid="${f.id}"] .folder-count`);
    if(label) label.textContent = totalQty ? `${totalQty} item${totalQty!==1?'s':''}` : '';
  });
  players.forEach(p=>refreshPlayerStatsEl(p.id));
  emptyMsg.style.display=(!inventory.length&&!folders.length&&!players.length)?'block':'none';
  updateCount();renderRopes();renderMultiSelectHighlights();
  if(selectedId){const el=world.querySelector(`[data-id="${selectedId}"]`);if(el)el.classList.add('selected');}
}

function updateCount() {
  const total=inventory.reduce((s,i)=>s+i.qty,0);
  itemCount.textContent=inventory.length?`${inventory.length} type${inventory.length>1?'s':''} · ${total} total · ${folders.length} folder${folders.length!==1?'s':''} · ${players.length} player${players.length!==1?'s':''}`:'No items in inventory';
}

function refreshPlayerStatsEl(playerId) {
  const p=players.find(pl=>pl.id===playerId);if(!p) return;
  const el=world.querySelector(`.inv-player[data-pid="${playerId}"]`);if(!el) return;
  const tw=playerTotalWeight(playerId);const tg=playerTotalGoldFromItems(playerId);const netWorth=tg+(p.gold||0);
  const pct=p.maxWeight>0?Math.min(tw/p.maxWeight,1):0;const over=tw>p.maxWeight;const near=!over&&pct>=0.75;
  const fill=el.querySelector('.player-weight-bar-fill');if(fill){fill.style.width=(pct*100)+'%';fill.style.background=over?'#ff4433':near?'#ffaa33':'#44aaff';}
  const weightEl=el.querySelector('.psc-weight');if(weightEl){weightEl.textContent=tw.toFixed(1)+' / '+p.maxWeight+' kg';weightEl.classList.toggle('over-limit',over);weightEl.classList.toggle('near-limit',near&&!over);}
  const goldEl=el.querySelector('.psc-gold');if(goldEl)goldEl.textContent=p.gold.toFixed(0)+' gp';
  const netEl=el.querySelector('.psc-networth');if(netEl)netEl.textContent=netWorth.toFixed(0)+' gp';
  const items = inventory.filter(i=>i.playerId===playerId);
  const totalQty = items.reduce((s,i)=>s+i.qty,0);
  const cntEl=el.querySelector('.player-item-count');
  if(cntEl) cntEl.textContent = totalQty ? `${totalQty} item${totalQty!==1?'s':''}` : '';
}
function refreshAllPlayerStats(){players.forEach(p=>refreshPlayerStatsEl(p.id));renderPlayersSidebar();}

/* ================================================================
   BUILD FOLDER ELEMENT
================================================================ */
function buildFolderEl(folder) {
  const ftype = getFolderType(folder.type || 'default');
  const el=document.createElement('div');el.className='inv-folder';el.dataset.fid=folder.id;
  el.style.cssText=`left:${folder.wx}px;top:${folder.wy}px;width:${folder.w}px;height:${folder.h}px;`;
  el.innerHTML=`<div class="folder-header">
    <span class="folder-icon">${ftype.emoji}</span>
    <span class="folder-name-el">${folder.name}</span>
    <div class="folder-actions">
      <button class="folder-action-btn" title="Change type" data-action="type">⊞</button>
      <button class="folder-action-btn" title="Rename" data-action="rename">✎</button>
      <button class="folder-action-btn danger" title="Delete folder" data-action="delete">✕</button>
    </div>
  </div>
  <div class="folder-body"></div>
  <div class="folder-count"></div>
  <div class="folder-resize"></div>`;

  el.querySelector('[data-action="type"]').addEventListener('click', e => {
    e.stopPropagation();
    const existingPicker = el.querySelector('.folder-type-picker');
    if (existingPicker) { existingPicker.remove(); return; }
    const picker = document.createElement('div');
    picker.className = 'folder-type-picker';
    FOLDER_TYPES.forEach(ft => {
      const opt = document.createElement('button');
      opt.className = 'folder-type-option' + (folder.type === ft.key ? ' active' : '');
      opt.textContent = `${ft.emoji} ${ft.label}`;
      opt.addEventListener('click', ev => {
        ev.stopPropagation();
        folder.type = ft.key;
        const iconEl = el.querySelector('.folder-icon');
        if (iconEl) iconEl.textContent = getFolderType(ft.key).emoji;
        picker.remove();
        save();
        toast(`📁 Changed to ${ft.label}`);
      });
      picker.appendChild(opt);
    });
    el.querySelector('.folder-header').appendChild(picker);
    setTimeout(() => {
      const close = (ev) => { if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener('pointerdown', close, true); } };
      document.addEventListener('pointerdown', close, true);
    }, 10);
  });

  el.querySelector('[data-action="rename"]').addEventListener('click',e=>{e.stopPropagation();const nameSpan=el.querySelector('.folder-name-el');const input=document.createElement('input');input.className='folder-rename-input';input.value=folder.name;nameSpan.replaceWith(input);input.focus();input.select();function commit(){folder.name=input.value.trim()||folder.name;const s=document.createElement('span');s.className='folder-name-el';s.textContent=folder.name;input.replaceWith(s);save();}input.addEventListener('blur',commit,{once:true});input.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();input.blur();}if(ev.key==='Escape'){input.value=folder.name;input.blur();}});});
  el.querySelector('[data-action="delete"]').addEventListener('click',e=>{e.stopPropagation();const inside=inventory.filter(i=>i.folderId===folder.id).length;const vr=viewport.getBoundingClientRect();showCanvasConfirm(`Delete folder <em>${folder.name}</em>?${inside>0?`<br/><span style="font-size:10px;opacity:0.7">${inside} item(s) will be freed</span>`:''}`,vr.width/2-100,vr.height/2-50,()=>{inventory.forEach(i=>{if(i.folderId===folder.id){const w=containerRelToWorld(i);i.folderId=null;i.wx=w.x;i.wy=w.y;}});folders=folders.filter(f=>f.id!==folder.id);save();renderAll();toast(`📁 Folder "${folder.name}" deleted.`);});});

  const header=el.querySelector('.folder-header');let fDragging=false,fHasMoved=false,fMS={x:0,y:0},fFS={x:0,y:0};
  header.addEventListener('pointerdown',e=>{if(e.target.closest('.folder-action-btn')||e.target.closest('.folder-type-picker')) return;if(e.button!==0) return;e.stopPropagation();closeCtxMenu();deselectItem();clearMultiSelect();fDragging=true;fHasMoved=false;fMS={x:e.clientX,y:e.clientY};fFS={x:folder.wx,y:folder.wy};header.setPointerCapture(e.pointerId);});
  header.addEventListener('pointermove',e=>{if(!fDragging) return;const dx=(e.clientX-fMS.x)/view.scale,dy=(e.clientY-fMS.y)/view.scale;if(!fHasMoved&&Math.hypot(dx,dy)<4) return;fHasMoved=true;el.classList.add('folder-dragging');folder.wx=fFS.x+dx;folder.wy=fFS.y+dy;el.style.left=folder.wx+'px';el.style.top=folder.wy+'px';updateAllRopePaths();});
  header.addEventListener('pointerup',()=>{if(!fDragging) return;fDragging=false;el.classList.remove('folder-dragging');if(fHasMoved)save();});
  const rh=el.querySelector('.folder-resize');let rDragging=false,rStart={x:0,y:0},rW=0,rH=0;
  rh.addEventListener('pointerdown',e=>{e.stopPropagation();rDragging=true;rStart={x:e.clientX,y:e.clientY};rW=folder.w;rH=folder.h;rh.setPointerCapture(e.pointerId);});
  rh.addEventListener('pointermove',e=>{if(!rDragging) return;folder.w=Math.max(160,(rW+(e.clientX-rStart.x)/view.scale));folder.h=Math.max(120,(rH+(e.clientY-rStart.y)/view.scale));el.style.width=folder.w+'px';el.style.height=folder.h+'px';});
  rh.addEventListener('pointerup',()=>{rDragging=false;save();});
  return el;
}

/* ================================================================
   BUILD PLAYER ELEMENT
================================================================ */
function buildPlayerEl(player) {
  const el=document.createElement('div');el.className='inv-player';el.dataset.pid=player.id;
  el.style.cssText=`left:${player.wx}px;top:${player.wy}px;width:${player.w}px;height:${player.h}px;z-index:3;`;
  const tw=playerTotalWeight(player.id);const tg=playerTotalGoldFromItems(player.id);const netWorth=tg+(player.gold||0);const pct=player.maxWeight>0?Math.min(tw/player.maxWeight,1):0;const over=tw>player.maxWeight;const near=!over&&pct>=0.75;const barColor=over?'#ff4433':near?'#ffaa33':'#44aaff';
  el.innerHTML=`<div class="player-header"><span class="player-avatar">${player.avatar}</span><div class="player-header-info"><div class="player-name-el">${player.name}</div><div class="player-weight-bar-wrap"><div class="player-weight-bar-fill" style="width:${pct*100}%;background:${barColor};"></div></div></div><div class="player-actions"><button class="player-action-btn settings-btn" title="Player settings" data-action="settings">⚙</button><button class="player-action-btn" title="Rename" data-action="rename">✎</button><button class="player-action-btn danger" title="Delete player" data-action="delete">✕</button></div></div><div class="player-stats-strip"><div class="player-stat-cell"><div class="psc-label">⚖ Weight</div><div class="psc-value psc-weight ${over?'over-limit':near?'near-limit':''}">${tw.toFixed(1)} / ${player.maxWeight} kg</div></div><div class="player-stat-cell"><div class="psc-label">🪙 Purse</div><div class="psc-value psc-gold">${(player.gold||0).toFixed(0)} gp</div></div><div class="player-stat-cell"><div class="psc-label">💰 Net Worth</div><div class="psc-value psc-networth">${netWorth.toFixed(0)} gp</div></div></div><div class="player-body"></div><div class="player-item-count"></div><div class="player-resize"></div>`;
  el.querySelector('[data-action="settings"]').addEventListener('click',e=>{e.stopPropagation();openPlayerModal(player.id);});
  el.querySelector('[data-action="rename"]').addEventListener('click',e=>{e.stopPropagation();const nameSpan=el.querySelector('.player-name-el');const input=document.createElement('input');input.className='player-rename-input';input.value=player.name;nameSpan.replaceWith(input);input.focus();input.select();function commit(){player.name=input.value.trim()||player.name;const s=document.createElement('div');s.className='player-name-el';s.textContent=player.name;input.replaceWith(s);save();renderPlayersSidebar();}input.addEventListener('blur',commit,{once:true});input.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();input.blur();}if(ev.key==='Escape'){input.value=player.name;input.blur();}});});
  el.querySelector('[data-action="delete"]').addEventListener('click',e=>{e.stopPropagation();const inside=inventory.filter(i=>i.playerId===player.id).length;const vr=viewport.getBoundingClientRect();showCanvasConfirm(`Delete player <em>${player.name}</em>?${inside>0?`<br/><span style="font-size:10px;opacity:0.7">${inside} item(s) will be freed</span>`:''}`,vr.width/2-100,vr.height/2-50,()=>{inventory.forEach(i=>{if(i.playerId===player.id){const w=containerRelToWorld(i);i.playerId=null;i.wx=w.x;i.wy=w.y;}});players=players.filter(p=>p.id!==player.id);save();renderAll();renderPlayersSidebar();toast(`🧙 Player "${player.name}" deleted.`);});});
  const header=el.querySelector('.player-header');let pDragging=false,pHasMoved=false,pMS={x:0,y:0},pPS={x:0,y:0};
  header.addEventListener('pointerdown',e=>{if(e.target.closest('.player-action-btn')) return;if(e.button!==0) return;e.stopPropagation();closeCtxMenu();deselectItem();clearMultiSelect();pDragging=true;pHasMoved=false;pMS={x:e.clientX,y:e.clientY};pPS={x:player.wx,y:player.wy};header.setPointerCapture(e.pointerId);});
  header.addEventListener('pointermove',e=>{if(!pDragging) return;const dx=(e.clientX-pMS.x)/view.scale,dy=(e.clientY-pMS.y)/view.scale;if(!pHasMoved&&Math.hypot(dx,dy)<4) return;pHasMoved=true;el.classList.add('player-dragging');player.wx=pPS.x+dx;player.wy=pPS.y+dy;el.style.left=player.wx+'px';el.style.top=player.wy+'px';updateAllRopePaths();});
  header.addEventListener('pointerup',()=>{if(!pDragging) return;pDragging=false;el.classList.remove('player-dragging');if(pHasMoved){save();renderPlayersSidebar();}});
  const rh=el.querySelector('.player-resize');let rDragging=false,rStart={x:0,y:0},rW=0,rH=0;
  rh.addEventListener('pointerdown',e=>{e.stopPropagation();rDragging=true;rStart={x:e.clientX,y:e.clientY};rW=player.w;rH=player.h;rh.setPointerCapture(e.pointerId);});
  rh.addEventListener('pointermove',e=>{if(!rDragging) return;player.w=Math.max(200,(rW+(e.clientX-rStart.x)/view.scale));player.h=Math.max(160,(rH+(e.clientY-rStart.y)/view.scale));el.style.width=player.w+'px';el.style.height=player.h+'px';});
  rh.addEventListener('pointerup',()=>{rDragging=false;save();});
  return el;
}

/* ================================================================
   PLAYER SETTINGS MODAL
================================================================ */
function openPlayerModal(playerId){const p=players.find(pl=>pl.id===playerId);if(!p)return;editingPlayerId=playerId;document.getElementById('playerModalAvatar').textContent=p.avatar;document.getElementById('playerModalTitle').textContent=p.name+' — Settings';pmName.value=p.name;pmAvatar.value=p.avatar;pmMaxWeight.value=p.maxWeight;pmGold.value=p.gold||0;playerModal.classList.add('open');pmName.focus();}
function closePlayerModal(){playerModal.classList.remove('open');editingPlayerId=null;}
document.getElementById('playerModalClose').addEventListener('click',closePlayerModal);
document.getElementById('playerModalCancel').addEventListener('click',closePlayerModal);
playerModal.addEventListener('pointerdown',e=>{if(e.target===playerModal)closePlayerModal();});
pmAvatar.addEventListener('input',()=>{document.getElementById('playerModalAvatar').textContent=pmAvatar.value||'🧙';});
document.getElementById('playerModalSave').addEventListener('click',()=>{if(!editingPlayerId)return;const p=players.find(pl=>pl.id===editingPlayerId);if(!p)return;p.name=pmName.value.trim()||p.name;p.avatar=pmAvatar.value.trim()||p.avatar;p.maxWeight=parseFloat(pmMaxWeight.value)||0;p.gold=parseFloat(pmGold.value)||0;closePlayerModal();save();renderAll();renderPlayersSidebar();toast(`✔ "${p.name}" updated!`);});

/* ================================================================
   BUILD ITEM ELEMENT
================================================================ */
function buildItemEl(item) {
  const el=document.createElement('div');el.className='inv-item';el.dataset.id=item.id;
  el.style.left=item.wx+'px';el.style.top=item.wy+'px';
  const rc=item.rarity?rarityColor(item.rarity):null;
  const rarityFrameStyle=rc?`style="--rarity-color:${rc};border-color:${rc};box-shadow:0 0 6px ${rc}66"`:'';
  const rarityFrameClass=rc?'item-frame has-rarity':'item-frame';
  el.innerHTML=`<div class="${rarityFrameClass}" ${rarityFrameStyle}><img src="${item.src}" alt="${item.name}" draggable="false"/><div class="item-qty">${item.qty>1?item.qty:''}</div></div><div class="item-name">${item.name}</div>`;

  let dragging=false,hasMoved=false;
  let mouseStart={x:0,y:0},dragWorldStart={x:0,y:0};
  let mergeTargetId=null;
  let multiDragStarts=[];

  el.addEventListener('pointerdown',e=>{
    e.stopPropagation();
    if(e.button!==0) return;
    if(connectingFromId){
      if(item.id===connectingFromId){cancelConnect();return;}
      const srcItem=inventory.find(i=>i.id===connectingFromId);if(!srcItem){cancelConnect();return;}
      if(item.folderId!==srcItem.folderId||item.playerId!==srcItem.playerId){toast('⚠ Can only connect items in same context',true);cancelConnect();return;}
      if(hasRope(connectingFromId,item.id)){toast('Already connected!',true);cancelConnect();return;}
      ropes.push({id:uid(),a:connectingFromId,b:item.id});
      toast(`🔗 Connected "${srcItem.name}" ↔ "${item.name}"`);save();renderAll();cancelConnect();return;
    }
    closeCtxMenu();if(ropeDragging) return;
    if(e.ctrlKey||e.metaKey){if(multiSelected.has(item.id))multiSelected.delete(item.id);else multiSelected.add(item.id);renderMultiSelectHighlights();updateMultiselectBar();return;}
    dragging=true;hasMoved=false;
    mouseStart={x:e.clientX,y:e.clientY};
    dragWorldStart=containerRelToWorld(item);
    el.setPointerCapture(e.pointerId);
    multiDragStarts=[];
    if(multiSelected.has(item.id)&&multiSelected.size>1){multiSelected.forEach(id=>{if(id===item.id) return;const other=inventory.find(i=>i.id===id);if(other&&!other.folderId&&!other.playerId)multiDragStarts.push({item:other,sx:other.wx,sy:other.wy});});}
  });

  el.addEventListener('pointermove',e=>{
    if(!dragging) return;
    const dx=(e.clientX-mouseStart.x)/view.scale,dy=(e.clientY-mouseStart.y)/view.scale;
    if(!hasMoved&&Math.hypot(dx,dy)<5) return;
    if(!hasMoved){hasMoved=true;el.classList.add('dragging');if(item.folderId||item.playerId){el.style.left=dragWorldStart.x+'px';el.style.top=dragWorldStart.y+'px';world.appendChild(el);}}
    const wx=dragWorldStart.x+dx,wy=dragWorldStart.y+dy;
    el.style.left=wx+'px';el.style.top=wy+'px';
    if(!item.folderId&&!item.playerId){item.wx=wx;item.wy=wy;}
    item._dragWx=wx;item._dragWy=wy;item._dragging=true;
    multiDragStarts.forEach(({item:other,sx,sy})=>{other.wx=sx+dx;other.wy=sy+dy;const otherEl=world.querySelector(`[data-id="${other.id}"]`);if(otherEl){otherEl.style.left=other.wx+'px';otherEl.style.top=other.wy+'px';}});
    updateAllRopePaths();
    const cx=wx+40,cy=wy+36;
    if(mergeTargetId){const prev=world.querySelector(`[data-id="${mergeTargetId}"]`);if(prev)prev.classList.remove('merge-target');mergeTargetId=null;}
    if(!multiDragStarts.length){const candidate=findMergeCandidate(item,cx,cy);if(candidate){mergeTargetId=candidate.id;const cEl=world.querySelector(`[data-id="${candidate.id}"]`);if(cEl)cEl.classList.add('merge-target');}}
    folders.forEach(f=>{const fEl=world.querySelector(`.inv-folder[data-fid="${f.id}"]`);if(!fEl) return;fEl.classList.toggle('drag-over-folder',inFolderBody(cx,cy,f)&&item.folderId!==f.id&&!multiDragStarts.length);});
    players.forEach(p=>{const pEl=world.querySelector(`.inv-player[data-pid="${p.id}"]`);if(!pEl) return;pEl.classList.toggle('drag-over-player',inPlayerBody(cx,cy,p)&&item.playerId!==p.id&&!multiDragStarts.length);});
  });

  el.addEventListener('pointerup',e=>{
    if(!dragging) return;dragging=false;el.classList.remove('dragging');item._dragging=false;
    world.querySelectorAll('.inv-folder').forEach(f=>f.classList.remove('drag-over-folder'));
    world.querySelectorAll('.inv-player').forEach(p=>p.classList.remove('drag-over-player'));
    if(!hasMoved){openCtxMenu(item.id,e.clientX,e.clientY);return;}
    const curWx=parseFloat(el.style.left),curWy=parseFloat(el.style.top);
    const cx=curWx+40,cy=curWy+36;
    const prevFolderId=item.folderId;const prevPlayerId=item.playerId;
    if(multiDragStarts.length){if(!item.folderId&&!item.playerId){item.wx=curWx;item.wy=curWy;}save();renderAll();refreshAllPlayerStats();if(selectedId===item.id)selectItem(item.id);return;}
    if(mergeTargetId){const target=inventory.find(i=>i.id===mergeTargetId);if(target){target.qty+=item.qty;const tEl=world.querySelector(`[data-id="${target.id}"]`);if(tEl){tEl.classList.remove('merge-target');tEl.classList.add('merge-flash');tEl.addEventListener('animationend',()=>tEl.classList.remove('merge-flash'),{once:true});}inventory=inventory.filter(i=>i.id!==item.id);removeRopesForItem(item.id);if(selectedId===item.id){selectedId=null;hideControls();}toast(`⚗ Merged into "${target.name}" (×${target.qty})`);save();renderAll();refreshAllPlayerStats();return;}}
    const hitPlayer=players.find(p=>p.id!==item.playerId&&inPlayerBody(cx,cy,p));
    if(hitPlayer){item.playerId=hitPlayer.id;item.folderId=null;item.wx=Math.max(0,curWx-hitPlayer.wx);item.wy=Math.max(0,curWy-hitPlayer.wy-PLAYER_HEADER_H-PLAYER_STATS_H);if(prevPlayerId!==hitPlayer.id)breakRopesOnContextChange(item.id);toast(`🧙 "${item.name}" → "${hitPlayer.name}"`);save();renderAll();refreshAllPlayerStats();if(selectedId===item.id)selectItem(item.id);return;}
    const hitFolder=folders.find(f=>f.id!==item.folderId&&inFolderBody(cx,cy,f));
    if(hitFolder){item.folderId=hitFolder.id;item.playerId=null;item.wx=Math.max(0,curWx-hitFolder.wx);item.wy=Math.max(0,curWy-hitFolder.wy-FOLDER_HEADER_H);if(prevFolderId!==hitFolder.id)breakRopesOnContextChange(item.id);toast(`📁 "${item.name}" → "${hitFolder.name}"`);save();renderAll();refreshAllPlayerStats();if(selectedId===item.id)selectItem(item.id);return;}
    if(item.playerId){const ownPlayer=players.find(p=>p.id===item.playerId);if(ownPlayer&&!inPlayerBody(cx,cy,ownPlayer)){item.playerId=null;item.wx=curWx;item.wy=curWy;breakRopesOnContextChange(item.id);toast(`🚪 "${item.name}" freed from player`);save();renderAll();refreshAllPlayerStats();if(selectedId===item.id)selectItem(item.id);return;}}
    if(item.folderId){const ownFolder=folders.find(f=>f.id===item.folderId);if(ownFolder&&!inFolderBody(cx,cy,ownFolder)){item.folderId=null;item.wx=curWx;item.wy=curWy;breakRopesOnContextChange(item.id);toast(`📤 "${item.name}" freed from folder`);save();renderAll();refreshAllPlayerStats();if(selectedId===item.id)selectItem(item.id);return;}}
    if(item.folderId){const ownFolder=folders.find(f=>f.id===item.folderId);if(ownFolder){item.wx=Math.max(0,curWx-ownFolder.wx);item.wy=Math.max(0,curWy-ownFolder.wy-FOLDER_HEADER_H);}}
    else if(item.playerId){const ownPlayer=players.find(p=>p.id===item.playerId);if(ownPlayer){item.wx=Math.max(0,curWx-ownPlayer.wx);item.wy=Math.max(0,curWy-ownPlayer.wy-PLAYER_HEADER_H-PLAYER_STATS_H);}}
    else{item.wx=curWx;item.wy=curWy;}
    if(!item.folderId&&!item.playerId){
      const nearby=inventory.find(other=>{
        if(other.id===item.id) return false;
        if(other.folderId||other.playerId) return false;
        const c=itemWorldCenter(other);return Math.hypot(cx-c.x,cy-c.y)<MERGE_DIST+20;
      });
      if(nearby&&nearby.name.trim().toLowerCase()!==item.name.trim().toLowerCase()){
        checkCraftHintForDrop(item,nearby);
      }
    }
    save();renderAll();refreshAllPlayerStats();if(selectedId===item.id)selectItem(item.id);
  });

  el.addEventListener('pointerenter',()=>{if(connectingFromId&&item.id!==connectingFromId)el.classList.add('connect-hover');});
  el.addEventListener('pointerleave',()=>el.classList.remove('connect-hover'));
  return el;
}

function findMergeCandidate(dragged,worldCx,worldCy) {
  return inventory.find(other=>{if(other.id===dragged.id) return false;if(other.name.trim().toLowerCase()!==dragged.name.trim().toLowerCase()) return false;const c=itemWorldCenter(other);return Math.hypot(worldCx-c.x,worldCy-c.y)<MERGE_DIST;});
}

/* ================================================================
   CONTEXT MENU
================================================================ */
function openCtxMenu(id,screenX,screenY) {
  ctxTargetId=id;const item=inventory.find(i=>i.id===id);if(!item) return;
  selectItem(id);
  document.getElementById('ctxTitle').textContent=item.name;
  const takeOneBtn=document.getElementById('ctxTakeOne');takeOneBtn.disabled=item.qty<2;takeOneBtn.style.opacity=item.qty<2?'0.4':'1';
  ctxEjectBtn.style.display=item.folderId?'block':'none';
  ctxEjectPlayerBtn.style.display=item.playerId?'block':'none';
  const vr=viewport.getBoundingClientRect();const menuW=160,menuH=270;
  const left=Math.min(screenX-vr.left+12,vr.width-menuW-8);const top=Math.min(screenY-vr.top-20,vr.height-menuH-90);
  ctxMenu.style.left=left+'px';ctxMenu.style.top=top+'px';ctxMenu.classList.add('open');
}
function closeCtxMenu(){ctxMenu.classList.remove('open');ctxTargetId=null;}
viewport.addEventListener('pointerdown',e=>{if(!ctxMenu.contains(e.target)&&!canvasConfirm.contains(e.target))closeCtxMenu();},true);

document.getElementById('ctxTakeOne').addEventListener('click',()=>{const item=inventory.find(i=>i.id===ctxTargetId);if(!item||item.qty<2) return;item.qty--;const offset=90+Math.random()*40,angle=Math.random()*Math.PI*2,w=containerRelToWorld(item);inventory.push({id:uid(),name:item.name,src:item.src,qty:1,rarity:item.rarity,weight:item.weight||0,gold:item.gold||0,tag:item.tag||'misc',description:item.description||'',wx:w.x+Math.cos(angle)*offset,wy:w.y+Math.sin(angle)*offset,folderId:null,playerId:null});closeCtxMenu();save();renderAll();refreshAllPlayerStats();toast(`☝ Took 1 × ${item.name}`);});
document.getElementById('ctxClone').addEventListener('click',()=>{const item=inventory.find(i=>i.id===ctxTargetId);if(!item) return;const offset=100+Math.random()*40,angle=Math.random()*Math.PI*2,w=containerRelToWorld(item);const clone={id:uid(),name:item.name,src:item.src,qty:item.qty,rarity:item.rarity,weight:item.weight||0,gold:item.gold||0,tag:item.tag||'misc',description:item.description||'',wx:w.x+Math.cos(angle)*offset,wy:w.y+Math.sin(angle)*offset,folderId:null,playerId:null};inventory.push(clone);closeCtxMenu();save();renderAll();selectItem(clone.id);toast(`⎘ Cloned "${item.name}"`);});
document.getElementById('ctxRename').addEventListener('click',()=>{const item=inventory.find(i=>i.id===ctxTargetId);if(!item) return;closeCtxMenu();const el=world.querySelector(`[data-id="${item.id}"]`);const nameDiv=el.querySelector('.item-name');const input=document.createElement('input');input.type='text';input.className='rename-input';input.value=item.name;input.maxLength=40;nameDiv.replaceWith(input);input.focus();input.select();function commitRename(){const newName=input.value.trim()||item.name;item.name=newName;save();renderAll();selectItem(item.id);toast(`✎ Renamed to "${item.name}"`);}input.addEventListener('blur',commitRename,{once:true});input.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();input.blur();}if(ev.key==='Escape'){input.value=item.name;input.blur();}});});
document.getElementById('ctxConnect').addEventListener('click',()=>{const id=ctxTargetId;closeCtxMenu();startConnect(id);toast('🔗 Click another item to connect');});
document.getElementById('ctxCraft').addEventListener('click',()=>{
  const item=inventory.find(i=>i.id===ctxTargetId);if(!item) return;closeCtxMenu();
  const libEntry=library.find(l=>l.name.trim().toLowerCase()===item.name.trim().toLowerCase());
  if(!libEntry){toast('⚠ Item not found in library',true);return;}
  craftSlotAId=libEntry.id;
  switchToCraft();
  toast(`⚗ "${item.name}" added as ingredient A`);
});
ctxEjectBtn.addEventListener('click',()=>{ejectFromFolder(ctxTargetId);closeCtxMenu();});
ctxEjectPlayerBtn.addEventListener('click',()=>{ejectFromPlayer(ctxTargetId);closeCtxMenu();});
document.getElementById('ctxRemove').addEventListener('click',()=>{
  const item=inventory.find(i=>i.id===ctxTargetId);if(!item) return;closeCtxMenu();
  const el=world.querySelector(`[data-id="${item.id}"]`);
  const rect=el?el.getBoundingClientRect():{left:200,top:200};
  const vr=viewport.getBoundingClientRect();
  showCanvasConfirm(`Remove <em>${item.name}</em>?`,rect.left-vr.left-10,rect.top-vr.top-80,()=>removeItem(item.id));
});

/* ================================================================
   SELECTION & BOTTOM PANEL
================================================================ */
function selectItem(id){
  if(selectedId){const prev=world.querySelector(`[data-id="${selectedId}"]`);if(prev)prev.classList.remove('selected');}
  selectedId=id;
  const item=inventory.find(i=>i.id===id);if(!item) return;
  const el=world.querySelector(`[data-id="${id}"]`);if(el)el.classList.add('selected');
  ctrlName.childNodes[0].textContent=item.name;
  ctrlSub.textContent='selected';
  ctrlQty.textContent=item.qty;
  ctrlEject.style.display=item.folderId?'flex':'none';
  ctrlEjectPlayer.style.display=item.playerId?'flex':'none';
  const totalW=((item.weight||0)*item.qty).toFixed(1);
  const totalG=((item.gold||0)*item.qty).toFixed(0);
  ctrlWeight.textContent=`${totalW} kg${item.qty>1?' ('+item.weight+'×'+item.qty+')':''}`;
  ctrlGold.textContent=`${totalG} gp${item.qty>1?' ('+item.gold+'×'+item.qty+')':''}`;

  // Description panel NEW
  const desc = item.description || '';
  if (desc) {
    ctrlDescText.textContent = desc;
    ctrlDescPanel.style.display = 'flex';
    ctrlDescSep.style.display = 'block';
  } else {
    ctrlDescPanel.style.display = 'none';
    ctrlDescSep.style.display = 'none';
  }

  itemControls.classList.add('visible');
}
function deselectItem(){if(selectedId){const el=world.querySelector(`[data-id="${selectedId}"]`);if(el)el.classList.remove('selected');}selectedId=null;hideControls();}
function hideControls(){itemControls.classList.remove('visible');}

document.getElementById('ctrlPlus').addEventListener('click',()=>{const item=inventory.find(i=>i.id===selectedId);if(!item) return;item.qty++;ctrlQty.textContent=item.qty;const badge=world.querySelector(`[data-id="${selectedId}"] .item-qty`);if(badge)badge.textContent=item.qty>1?item.qty:'';ctrlWeight.textContent=`${((item.weight||0)*item.qty).toFixed(1)} kg${item.qty>1?' ('+item.weight+'×'+item.qty+')':''}`;ctrlGold.textContent=`${((item.gold||0)*item.qty).toFixed(0)} gp${item.qty>1?' ('+item.gold+'×'+item.qty+')':''}`;save();updateCount();refreshAllPlayerStats();});
document.getElementById('ctrlMinus').addEventListener('click',()=>{const item=inventory.find(i=>i.id===selectedId);if(!item) return;if(item.qty>1){item.qty--;ctrlQty.textContent=item.qty;const badge=world.querySelector(`[data-id="${selectedId}"] .item-qty`);if(badge)badge.textContent=item.qty>1?item.qty:'';ctrlWeight.textContent=`${((item.weight||0)*item.qty).toFixed(1)} kg${item.qty>1?' ('+item.weight+'×'+item.qty+')':''}`;ctrlGold.textContent=`${((item.gold||0)*item.qty).toFixed(0)} gp${item.qty>1?' ('+item.gold+'×'+item.qty+')':''}`;save();updateCount();refreshAllPlayerStats();}else{const el=world.querySelector(`[data-id="${selectedId}"]`);const rect=el?el.getBoundingClientRect():{left:200,top:200};const vr=viewport.getBoundingClientRect();showCanvasConfirm(`Remove last <em>${item.name}</em>?`,rect.left-vr.left-10,rect.top-vr.top-80,()=>removeItem(item.id));}});
document.getElementById('ctrlRemove').addEventListener('click',()=>{const item=inventory.find(i=>i.id===selectedId);if(!item) return;const el=world.querySelector(`[data-id="${selectedId}"]`);const rect=el?el.getBoundingClientRect():{left:200,top:200};const vr=viewport.getBoundingClientRect();showCanvasConfirm(`Remove <em>${item.name}</em>?`,rect.left-vr.left-10,rect.top-vr.top-80,()=>removeItem(item.id));});
ctrlEject.addEventListener('click',()=>ejectFromFolder(selectedId));
ctrlEjectPlayer.addEventListener('click',()=>ejectFromPlayer(selectedId));

function ejectFromFolder(id){const item=inventory.find(i=>i.id===id);if(!item||!item.folderId) return;const folder=folders.find(f=>f.id===item.folderId);item.folderId=null;item.wx=folder?folder.wx+folder.w+20:item.wx;item.wy=folder?folder.wy+40:item.wy;breakRopesOnContextChange(id);save();renderAll();selectItem(id);toast(`📤 "${item.name}" freed from folder`);}
function ejectFromPlayer(id){const item=inventory.find(i=>i.id===id);if(!item||!item.playerId) return;const player=players.find(p=>p.id===item.playerId);item.playerId=null;item.wx=player?player.wx+player.w+20:item.wx;item.wy=player?player.wy+40:item.wy;breakRopesOnContextChange(id);save();renderAll();refreshAllPlayerStats();selectItem(id);toast(`🚪 "${item.name}" freed from player`);}
function removeItem(id){const item=inventory.find(i=>i.id===id);const name=item?item.name:'Item';inventory=inventory.filter(i=>i.id!==id);multiSelected.delete(id);updateMultiselectBar();removeRopesForItem(id);if(selectedId===id){selectedId=null;hideControls();}save();renderAll();refreshAllPlayerStats();toast(`✕ "${name}" removed.`);}

/* ================================================================
   INIT
================================================================ */
load();
requestAnimationFrame(()=>{
  const vr=viewport.getBoundingClientRect();
  if(view.x===0&&view.y===0&&view.scale===1){view.x=vr.width/2-WORLD_W/2;view.y=vr.height/2-WORLD_H/2;}
  applyView();
});
renderAll();
renderLibrary();
renderPlayersSidebar();
renderRecipes();
buildForgeTagSelector();
buildLibTagFilterBar();