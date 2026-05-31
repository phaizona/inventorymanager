/* ================================================================
   FANTASY INVENTORY MANAGER — app.js

   COORDINATE SYSTEM
   ─────────────────
   • Free items:   item.wx / item.wy  = world-space px (absolute in #canvasWorld)
   • Foldered items: item.wx / item.wy = folder-body-relative px
     (i.e. pixel offset inside the .folder-body div, which starts at
      folder.wx + 0, folder.wy + HEADER_H in world-space)

   FOLDER_HEADER_H must stay in sync with the CSS min-height of .folder-header.
================================================================ */

const FOLDER_HEADER_H = 34;   // px — height of the folder title bar
const WORLD_W   = 3000;
const WORLD_H   = 3000;
const SCALE_MIN  = 0.25;
const SCALE_MAX  = 3.0;
const SCALE_STEP = 0.15;
const MERGE_DIST = 60;        // world-px threshold for merge highlight

/* ── State ── */
let inventory  = [];   // [{id, name, src, qty, wx, wy, folderId}]
let folders    = [];   // [{id, name, wx, wy, w, h}]
let selectedId  = null;
let ctxTargetId = null;
let view        = { x: 0, y: 0, scale: 1 };

/* ── DOM refs ── */
const viewport     = document.getElementById('canvasViewport');
const world        = document.getElementById('canvasWorld');
const uploadZone   = document.getElementById('uploadZone');
const fileInput    = document.getElementById('fileInput');
const previewImg   = document.getElementById('previewImg');
const placeholder  = document.getElementById('uploadPlaceholder');
const itemNameEl   = document.getElementById('itemName');
const nameWarn     = document.getElementById('nameWarn');
const qtyDisplay   = document.getElementById('qtyDisplay');
const addBtn       = document.getElementById('addBtn');
const itemCount    = document.getElementById('itemCount');
const emptyMsg     = document.getElementById('emptyMsg');
const itemControls = document.getElementById('itemControls');
const ctrlName     = document.getElementById('ctrlName');
const ctrlSub      = document.getElementById('ctrlSub');
const ctrlQty      = document.getElementById('ctrlQty');
const ctrlEject    = document.getElementById('ctrlEject');
const toastCont    = document.getElementById('toastContainer');
const importInput  = document.getElementById('importInput');
const ctxMenu      = document.getElementById('ctxMenu');
const zoomLabel    = document.getElementById('zoomLabel');
const ctxEjectBtn  = document.getElementById('ctxEjectFolder');

let sidebarQty = 1;
let pendingImg  = null;

/* ================================================================
   UTILITIES
================================================================ */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function toast(msg, warn = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (warn ? ' warn' : '');
  el.textContent = msg;
  toastCont.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, warn ? 3200 : 2400);
}

function nameExists(name, excludeId = null) {
  return inventory.some(
    i => i.id !== excludeId && i.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
}

/* ── Convert folder-relative coords → world coords ── */
function folderRelToWorld(item) {
  const folder = folders.find(f => f.id === item.folderId);
  if (!folder) return { x: item.wx, y: item.wy };
  return {
    x: folder.wx + item.wx,
    y: folder.wy + FOLDER_HEADER_H + item.wy,
  };
}

/* ── World centre of an item (item icon is 72px wide/tall) ── */
function itemWorldCenter(item) {
  if (item.folderId) {
    const w = folderRelToWorld(item);
    return { x: w.x + 40, y: w.y + 36 };
  }
  return { x: item.wx + 40, y: item.wy + 36 };
}

/* ── Is a world point inside a folder's body area? ── */
function inFolderBody(wx, wy, folder) {
  return wx >= folder.wx &&
         wx <= folder.wx + folder.w &&
         wy >= folder.wy + FOLDER_HEADER_H &&
         wy <= folder.wy + folder.h;
}

/* ================================================================
   PERSISTENCE
================================================================ */
const STORAGE_KEY = 'fantasy_inventory_v3';

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ inventory, folders, view })); }
  catch (_) { toast('⚠ Storage full — export to back up!', true); }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data)) { inventory = data; return; }
    if (data.inventory) inventory = data.inventory;
    if (data.folders)   folders   = data.folders;
    if (data.view)      view      = data.view;
  } catch (_) { inventory = []; folders = []; }
}

/* ================================================================
   EXPORT / IMPORT / CLEAR
================================================================ */
document.getElementById('exportBtn').addEventListener('click', () => {
  if (!inventory.length && !folders.length) { toast('Nothing to export!'); return; }
  const blob = new Blob(
    [JSON.stringify({ inventory, folders, view }, null, 2)],
    { type: 'application/json' }
  );
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'fantasy_inventory.json',
  });
  a.click();
  URL.revokeObjectURL(a.href);
  toast('⬇ Exported!');
});

document.getElementById('importBtn').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (Array.isArray(data)) { inventory = data; folders = []; }
      else if (data.inventory)  { inventory = data.inventory; folders = data.folders || []; if (data.view) view = data.view; }
      else throw new Error();
      save(); renderAll(); applyView();
      toast('⬆ Inventory imported!');
    } catch (_) { toast('✕ Invalid file.', true); }
    importInput.value = '';
  };
  reader.readAsText(file);
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (!inventory.length && !folders.length) { toast('Already empty!'); return; }
  if (!confirm('Clear your entire inventory and all folders?')) return;
  inventory = []; folders = []; selectedId = null;
  closeCtxMenu(); hideControls(); save(); renderAll();
  toast('✕ Inventory cleared.');
});

/* ================================================================
   VIEW — Pan & Zoom
================================================================ */
function applyView() {
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  zoomLabel.textContent = Math.round(view.scale * 100) + '%';
}

function zoomBy(delta, screenX, screenY) {
  const newScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, view.scale + delta));
  if (newScale === view.scale) return;
  const vr = viewport.getBoundingClientRect();
  const ox = screenX - vr.left;
  const oy = screenY - vr.top;
  const wx = (ox - view.x) / view.scale;
  const wy = (oy - view.y) / view.scale;
  view.scale = newScale;
  view.x = ox - wx * view.scale;
  view.y = oy - wy * view.scale;
  applyView();
}

viewport.addEventListener('wheel', e => {
  e.preventDefault();
  zoomBy(e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP, e.clientX, e.clientY);
}, { passive: false });

document.getElementById('zoomIn').addEventListener('click', () => {
  const r = viewport.getBoundingClientRect();
  zoomBy(SCALE_STEP, r.left + r.width / 2, r.top + r.height / 2);
});
document.getElementById('zoomOut').addEventListener('click', () => {
  const r = viewport.getBoundingClientRect();
  zoomBy(-SCALE_STEP, r.left + r.width / 2, r.top + r.height / 2);
});
document.getElementById('zoomReset').addEventListener('click', () => {
  const vr = viewport.getBoundingClientRect();
  view.scale = 1;
  view.x = vr.width  / 2 - WORLD_W / 2;
  view.y = vr.height / 2 - WORLD_H / 2;
  applyView();
});

/* ── Pan ── */
let isPanning = false, panStart = { x: 0, y: 0 }, viewStart = { x: 0, y: 0 };

viewport.addEventListener('pointerdown', e => {
  const bg = e.target === viewport || e.target === world ||
             e.target.classList.contains('empty-msg') ||
             e.target.classList.contains('empty-icon');
  if (!bg) return;
  closeCtxMenu(); deselectItem();
  isPanning = true;
  panStart  = { x: e.clientX, y: e.clientY };
  viewStart = { x: view.x,    y: view.y };
  viewport.setPointerCapture(e.pointerId);
  viewport.style.cursor = 'grabbing';
});
viewport.addEventListener('pointermove', e => {
  if (!isPanning) return;
  view.x = viewStart.x + (e.clientX - panStart.x);
  view.y = viewStart.y + (e.clientY - panStart.y);
  applyView();
});
viewport.addEventListener('pointerup', () => {
  isPanning = false;
  viewport.style.cursor = '';
  save();
});

/* ================================================================
   SIDEBAR
================================================================ */
uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => { if (e.target.files[0]) readImg(e.target.files[0]); fileInput.value = ''; });
uploadZone.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) readImg(f);
});

function readImg(file) {
  const r = new FileReader();
  r.onload = ev => {
    pendingImg = ev.target.result;
    previewImg.src = pendingImg; previewImg.style.display = 'block';
    placeholder.style.display = 'none';
    checkReady();
  };
  r.readAsDataURL(file);
}

function checkReady() {
  const name   = itemNameEl.value.trim();
  const exists = name && nameExists(name);
  nameWarn.classList.toggle('visible', !!exists);
  itemNameEl.classList.toggle('error', !!exists);
  addBtn.disabled = !(pendingImg && name && !exists);
}

itemNameEl.addEventListener('input', checkReady);
document.getElementById('qtyMinus').addEventListener('click', () => { if (sidebarQty > 1) { sidebarQty--; qtyDisplay.textContent = sidebarQty; } });
document.getElementById('qtyPlus').addEventListener('click',  () => { sidebarQty++; qtyDisplay.textContent = sidebarQty; });

/* ================================================================
   ADD ITEM
================================================================ */
addBtn.addEventListener('click', () => {
  const name = itemNameEl.value.trim();
  if (!name || !pendingImg) return;
  if (nameExists(name)) { toast('⚠ An item with that name already exists!', true); return; }

  const vr      = viewport.getBoundingClientRect();
  const centreX = (vr.width  / 2 - view.x) / view.scale;
  const centreY = (vr.height / 2 - view.y) / view.scale;
  const scatter = 140;

  const item = {
    id: uid(), name, src: pendingImg, qty: sidebarQty,
    wx: centreX + (Math.random() - 0.5) * scatter,
    wy: centreY + (Math.random() - 0.5) * scatter,
    folderId: null,
  };
  inventory.push(item);
  save(); renderAll();

  itemNameEl.value = ''; pendingImg = null; sidebarQty = 1;
  qtyDisplay.textContent = '1';
  previewImg.style.display = 'none'; previewImg.src = '';
  placeholder.style.display = 'flex';
  checkReady();
  toast(`✦ "${name}" forged!`);
});

/* ================================================================
   CREATE FOLDER
================================================================ */
function createFolder(name) {
  const vr = viewport.getBoundingClientRect();
  const cx = (vr.width  / 2 - view.x) / view.scale;
  const cy = (vr.height / 2 - view.y) / view.scale;
  const folder = { id: uid(), name, wx: cx - 120, wy: cy - 90, w: 260, h: 200 };
  folders.push(folder);
  save(); renderAll();
  toast(`📁 Folder "${name}" created!`);
  return folder;
}

document.getElementById('newFolderBtn').addEventListener('click', () => {
  const n = prompt('Folder name:', 'Pouch');
  if (n && n.trim()) createFolder(n.trim());
});
document.getElementById('sidebarFolderBtn').addEventListener('click', () => {
  const n = prompt('Folder name:', 'Pouch');
  if (n && n.trim()) createFolder(n.trim());
});

/* ================================================================
   RENDER ALL
================================================================ */
function renderAll() {
  world.querySelectorAll('.inv-folder, .inv-item').forEach(el => el.remove());

  /* Render folders first (background) */
  folders.forEach(f => world.appendChild(buildFolderEl(f)));

  /* Render items — foldered ones go into their folder's .folder-body */
  inventory.forEach(item => {
    const el = buildItemEl(item);
    if (item.folderId) {
      const bodyEl = world.querySelector(`.inv-folder[data-fid="${item.folderId}"] .folder-body`);
      if (bodyEl) {
        bodyEl.appendChild(el);
      } else {
        item.folderId = null;   /* orphaned — free it */
        world.appendChild(el);
      }
    } else {
      world.appendChild(el);
    }
  });

  /* Update folder item-count labels */
  folders.forEach(f => {
    const cnt = inventory.filter(i => i.folderId === f.id).length;
    const label = world.querySelector(`.inv-folder[data-fid="${f.id}"] .folder-count`);
    if (label) label.textContent = cnt ? `${cnt} item${cnt !== 1 ? 's' : ''}` : '';
  });

  emptyMsg.style.display = (!inventory.length && !folders.length) ? 'block' : 'none';
  updateCount();

  if (selectedId) {
    const el = world.querySelector(`[data-id="${selectedId}"]`);
    if (el) el.classList.add('selected');
  }
}

function updateCount() {
  const total = inventory.reduce((s, i) => s + i.qty, 0);
  itemCount.textContent = inventory.length
    ? `${inventory.length} type${inventory.length > 1 ? 's' : ''} · ${total} total · ${folders.length} folder${folders.length !== 1 ? 's' : ''}`
    : 'No items in inventory';
}

/* ================================================================
   BUILD FOLDER ELEMENT
================================================================ */
function buildFolderEl(folder) {
  const el = document.createElement('div');
  el.className  = 'inv-folder';
  el.dataset.fid = folder.id;
  el.style.left   = folder.wx + 'px';
  el.style.top    = folder.wy + 'px';
  el.style.width  = folder.w  + 'px';
  el.style.height = folder.h  + 'px';

  el.innerHTML = `
    <div class="folder-header">
      <span class="folder-icon">📁</span>
      <span class="folder-name-el">${folder.name}</span>
      <div class="folder-actions">
        <button class="folder-action-btn" title="Rename" data-action="rename">✎</button>
        <button class="folder-action-btn danger" title="Delete folder" data-action="delete">✕</button>
      </div>
    </div>
    <div class="folder-body"></div>
    <div class="folder-count"></div>
    <div class="folder-resize"></div>
  `;

  /* ── Rename ── */
  el.querySelector('[data-action="rename"]').addEventListener('click', e => {
    e.stopPropagation();
    const nameSpan = el.querySelector('.folder-name-el');
    const input    = document.createElement('input');
    input.className = 'folder-rename-input';
    input.value     = folder.name;
    nameSpan.replaceWith(input);
    input.focus(); input.select();

    function commit() {
      folder.name = input.value.trim() || folder.name;
      const restored = document.createElement('span');
      restored.className   = 'folder-name-el';
      restored.textContent = folder.name;
      input.replaceWith(restored);
      save();
    }
    input.addEventListener('blur', commit, { once: true });
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter')  { ev.preventDefault(); input.blur(); }
      if (ev.key === 'Escape') { input.value = folder.name; input.blur(); }
    });
  });

  /* ── Delete ── */
  el.querySelector('[data-action="delete"]').addEventListener('click', e => {
    e.stopPropagation();
    const inside = inventory.filter(i => i.folderId === folder.id).length;
    const msg = inside > 0
      ? `Delete folder "${folder.name}"? The ${inside} item(s) inside will be freed.`
      : `Delete folder "${folder.name}"?`;
    if (!confirm(msg)) return;
    /* Free items: place them next to the folder in world-space */
    inventory.forEach(i => {
      if (i.folderId === folder.id) {
        const w = folderRelToWorld(i);
        i.folderId = null;
        i.wx = w.x;
        i.wy = w.y;
      }
    });
    folders = folders.filter(f => f.id !== folder.id);
    save(); renderAll();
    toast(`📁 Folder "${folder.name}" deleted.`);
  });

  /* ── Folder drag — moves folder + contained items together ── */
  const header = el.querySelector('.folder-header');
  let fDragging  = false, fHasMoved = false;
  let fMouseStart = { x: 0, y: 0 };
  let fFolderStart = { x: 0, y: 0 };
  /* NOTE: items inside a folder keep their coords RELATIVE to the folder,
     so we only need to move the folder itself. Items follow automatically
     because their DOM parent (.folder-body) moves with the folder element. */

  header.addEventListener('pointerdown', e => {
    if (e.target.closest('.folder-action-btn')) return;
    e.stopPropagation();
    closeCtxMenu(); deselectItem();
    fDragging    = true; fHasMoved = false;
    fMouseStart  = { x: e.clientX, y: e.clientY };
    fFolderStart = { x: folder.wx, y: folder.wy };
    header.setPointerCapture(e.pointerId);
  });

  header.addEventListener('pointermove', e => {
    if (!fDragging) return;
    const dx = (e.clientX - fMouseStart.x) / view.scale;
    const dy = (e.clientY - fMouseStart.y) / view.scale;
    if (!fHasMoved && Math.hypot(dx, dy) < 4) return;
    fHasMoved = true;
    el.classList.add('folder-dragging');
    folder.wx = fFolderStart.x + dx;
    folder.wy = fFolderStart.y + dy;
    el.style.left = folder.wx + 'px';
    el.style.top  = folder.wy + 'px';
    /* No need to update item.wx/wy — they're relative coords, unchanged */
  });

  header.addEventListener('pointerup', () => {
    if (!fDragging) return;
    fDragging = false;
    el.classList.remove('folder-dragging');
    if (fHasMoved) save();
  });

  /* ── Resize ── */
  const resizeHandle = el.querySelector('.folder-resize');
  let rDragging = false, rStart = { x: 0, y: 0 }, rWStart = 0, rHStart = 0;

  resizeHandle.addEventListener('pointerdown', e => {
    e.stopPropagation();
    rDragging = true;
    rStart    = { x: e.clientX, y: e.clientY };
    rWStart   = folder.w; rHStart = folder.h;
    resizeHandle.setPointerCapture(e.pointerId);
  });
  resizeHandle.addEventListener('pointermove', e => {
    if (!rDragging) return;
    const dx = (e.clientX - rStart.x) / view.scale;
    const dy = (e.clientY - rStart.y) / view.scale;
    folder.w = Math.max(160, rWStart + dx);
    folder.h = Math.max(120, rHStart + dy);
    el.style.width  = folder.w + 'px';
    el.style.height = folder.h + 'px';
  });
  resizeHandle.addEventListener('pointerup', () => { rDragging = false; save(); });

  return el;
}

/* ================================================================
   BUILD ITEM ELEMENT

   COORDINATE MODEL
   ─────────────────
   • Free item  → positioned as child of #canvasWorld
                  el.style.left/top = item.wx / item.wy  (world px)

   • Foldered   → positioned as child of .folder-body
                  el.style.left/top = item.wx / item.wy  (body-relative px)

   During drag we always work in WORLD SPACE internally, then convert
   back to the appropriate space on drop.
================================================================ */
function buildItemEl(item) {
  const el = document.createElement('div');
  el.className  = 'inv-item';
  el.dataset.id = item.id;
  el.style.left = item.wx + 'px';
  el.style.top  = item.wy + 'px';

  el.innerHTML = `
    <div class="item-frame">
      <img src="${item.src}" alt="${item.name}" draggable="false"/>
      <div class="item-qty">${item.qty > 1 ? item.qty : ''}</div>
    </div>
    <div class="item-name">${item.name}</div>
  `;

  /* ── Drag state ── */
  let dragging    = false, hasMoved = false;
  let mouseStart  = { x: 0, y: 0 };
  // dragWorldStart = world-space position of item at drag begin
  let dragWorldStart = { x: 0, y: 0 };
  let mergeTargetId  = null;

  el.addEventListener('pointerdown', e => {
    e.stopPropagation();
    closeCtxMenu();
    dragging  = true;
    hasMoved  = false;
    mouseStart = { x: e.clientX, y: e.clientY };

    /* Record current world-space position regardless of whether item is free or foldered */
    const c = itemWorldCenter(item);
    dragWorldStart = { x: c.x - 40, y: c.y - 36 };  // top-left, not center

    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = (e.clientX - mouseStart.x) / view.scale;
    const dy = (e.clientY - mouseStart.y) / view.scale;
    if (!hasMoved && Math.hypot(dx, dy) < 5) return;

    if (!hasMoved) {
      /* First real move: reparent to world so it floats above everything */
      hasMoved = true;
      el.classList.add('dragging');

      if (item.folderId) {
        /* Temporarily reparent to world for visual drag */
        const worldPos = folderRelToWorld(item);
        el.style.left = worldPos.x + 'px';
        el.style.top  = worldPos.y + 'px';
        world.appendChild(el);
      }
    }

    /* Move in world-space */
    const wx = dragWorldStart.x + dx;
    const wy = dragWorldStart.y + dy;
    el.style.left = wx + 'px';
    el.style.top  = wy + 'px';

    /* World center for hit-testing */
    const cx = wx + 40;
    const cy = wy + 36;

    /* ── Merge highlight ── */
    if (mergeTargetId) {
      const prev = world.querySelector(`[data-id="${mergeTargetId}"]`);
      if (prev) prev.classList.remove('merge-target');
      mergeTargetId = null;
    }
    const candidate = findMergeCandidate(item, cx, cy);
    if (candidate) {
      mergeTargetId = candidate.id;
      const cEl = world.querySelector(`[data-id="${candidate.id}"]`);
      if (cEl) cEl.classList.add('merge-target');
    }

    /* ── Folder hover highlight ── */
    folders.forEach(f => {
      const fEl = world.querySelector(`.inv-folder[data-fid="${f.id}"]`);
      if (!fEl) return;
      const inside = inFolderBody(cx, cy, f);
      fEl.classList.toggle('drag-over-folder', inside && item.folderId !== f.id);
    });
  });

  el.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    world.querySelectorAll('.inv-folder').forEach(f => f.classList.remove('drag-over-folder'));

    if (!hasMoved) {
      /* ── Click: open context menu ── */
      openCtxMenu(item.id, e.clientX, e.clientY);
      return;
    }

    /* Current world position from element style (we were floating on world) */
    const curWx = parseFloat(el.style.left);
    const curWy = parseFloat(el.style.top);
    const cx = curWx + 40;
    const cy = curWy + 36;

    /* ── 1. Merge ── */
    if (mergeTargetId) {
      const target = inventory.find(i => i.id === mergeTargetId);
      if (target) {
        target.qty += item.qty;
        const tEl = world.querySelector(`[data-id="${target.id}"]`);
        if (tEl) {
          tEl.classList.remove('merge-target');
          tEl.classList.add('merge-flash');
          tEl.addEventListener('animationend', () => tEl.classList.remove('merge-flash'), { once: true });
        }
        inventory = inventory.filter(i => i.id !== item.id);
        if (selectedId === item.id) { selectedId = null; hideControls(); }
        toast(`⚗ Merged into "${target.name}" (×${target.qty})`);
        save(); renderAll();
        return;
      }
    }

    /* ── 2. Drop into a folder ── */
    const hitFolder = folders.find(f => f.id !== item.folderId && inFolderBody(cx, cy, f));
    if (hitFolder) {
      item.folderId = hitFolder.id;
      /* Convert world position → folder-body-relative */
      item.wx = curWx - hitFolder.wx;
      item.wy = curWy - hitFolder.wy - FOLDER_HEADER_H;
      item.wx = Math.max(0, item.wx);
      item.wy = Math.max(0, item.wy);
      toast(`📁 "${item.name}" added to "${hitFolder.name}"`);
      save(); renderAll();
      if (selectedId === item.id) selectItem(item.id);
      return;
    }

    /* ── 3. Dropped outside its own folder → eject ── */
    if (item.folderId) {
      const ownFolder = folders.find(f => f.id === item.folderId);
      if (ownFolder && !inFolderBody(cx, cy, ownFolder)) {
        item.folderId = null;
        item.wx = curWx;
        item.wy = curWy;
        toast(`📤 "${item.name}" removed from folder`);
        save(); renderAll();
        if (selectedId === item.id) selectItem(item.id);
        return;
      }
    }

    /* ── 4. Normal free move — stays in same folder or is already free ── */
    if (item.folderId) {
      const ownFolder = folders.find(f => f.id === item.folderId);
      if (ownFolder) {
        /* Convert back to folder-relative */
        item.wx = curWx - ownFolder.wx;
        item.wy = curWy - ownFolder.wy - FOLDER_HEADER_H;
        item.wx = Math.max(0, item.wx);
        item.wy = Math.max(0, item.wy);
      }
    } else {
      item.wx = curWx;
      item.wy = curWy;
    }
    save(); renderAll();
    if (selectedId === item.id) selectItem(item.id);
  });

  return el;
}

/* ── Find same-name item close enough to merge ── */
function findMergeCandidate(dragged, worldCx, worldCy) {
  return inventory.find(other => {
    if (other.id === dragged.id) return false;
    if (other.name.trim().toLowerCase() !== dragged.name.trim().toLowerCase()) return false;
    const c = itemWorldCenter(other);
    return Math.hypot(worldCx - c.x, worldCy - c.y) < MERGE_DIST;
  });
}

/* ================================================================
   CONTEXT MENU
================================================================ */
function openCtxMenu(id, screenX, screenY) {
  ctxTargetId = id;
  const item  = inventory.find(i => i.id === id);
  if (!item) return;

  selectItem(id);

  document.getElementById('ctxTitle').textContent = item.name;
  const takeOneBtn = document.getElementById('ctxTakeOne');
  takeOneBtn.disabled      = item.qty < 2;
  takeOneBtn.style.opacity = item.qty < 2 ? '0.4' : '1';
  ctxEjectBtn.style.display = item.folderId ? 'block' : 'none';

  const vr    = viewport.getBoundingClientRect();
  const menuW = 160, menuH = 190;
  const left  = Math.min(screenX - vr.left + 12, vr.width  - menuW - 8);
  const top   = Math.min(screenY - vr.top  - 20, vr.height - menuH - 90);

  ctxMenu.style.left = left + 'px';
  ctxMenu.style.top  = top  + 'px';
  ctxMenu.classList.add('open');
}

function closeCtxMenu() {
  ctxMenu.classList.remove('open');
  ctxTargetId = null;
}

viewport.addEventListener('pointerdown', e => {
  if (!ctxMenu.contains(e.target)) closeCtxMenu();
}, true);

/* Take One */
document.getElementById('ctxTakeOne').addEventListener('click', () => {
  const item = inventory.find(i => i.id === ctxTargetId);
  if (!item || item.qty < 2) return;
  item.qty--;
  const offset = 90 + Math.random() * 40;
  const angle  = Math.random() * Math.PI * 2;
  const w = folderRelToWorld(item);   // world coords of original
  const single = {
    id: uid(), name: item.name, src: item.src, qty: 1,
    wx: w.x + Math.cos(angle) * offset,
    wy: w.y + Math.sin(angle) * offset,
    folderId: null,
  };
  inventory.push(single);
  closeCtxMenu(); save(); renderAll();
  selectItem(single.id);
  toast(`☝ Took 1 × ${item.name}`);
});

/* Clone */
document.getElementById('ctxClone').addEventListener('click', () => {
  const item = inventory.find(i => i.id === ctxTargetId);
  if (!item) return;
  const offset = 100 + Math.random() * 40;
  const angle  = Math.random() * Math.PI * 2;
  const w = folderRelToWorld(item);
  const clone = {
    id: uid(), name: item.name, src: item.src, qty: item.qty,
    wx: w.x + Math.cos(angle) * offset,
    wy: w.y + Math.sin(angle) * offset,
    folderId: null,
  };
  inventory.push(clone);
  closeCtxMenu(); save(); renderAll();
  selectItem(clone.id);
  toast(`⎘ Cloned "${item.name}"`);
});

/* Rename */
document.getElementById('ctxRename').addEventListener('click', () => {
  const item = inventory.find(i => i.id === ctxTargetId);
  if (!item) return;
  closeCtxMenu();

  const el      = world.querySelector(`[data-id="${item.id}"]`);
  const nameDiv = el.querySelector('.item-name');
  const input   = document.createElement('input');
  input.type      = 'text';
  input.className = 'rename-input';
  input.value     = item.name;
  input.maxLength = 40;
  nameDiv.replaceWith(input);
  input.focus(); input.select();

  function commitRename() {
    const newName = input.value.trim() || item.name;
    if (newName !== item.name && nameExists(newName, item.id)) {
      toast('⚠ An item with that name already exists!', true);
    } else {
      item.name = newName;
      toast(`✎ Renamed to "${item.name}"`);
    }
    save(); renderAll(); selectItem(item.id);
  }
  input.addEventListener('blur',    commitRename, { once: true });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  { ev.preventDefault(); input.blur(); }
    if (ev.key === 'Escape') { input.value = item.name; input.blur(); }
  });
});

/* Eject */
ctxEjectBtn.addEventListener('click', () => { ejectFromFolder(ctxTargetId); closeCtxMenu(); });

/* Remove */
document.getElementById('ctxRemove').addEventListener('click', () => {
  const item = inventory.find(i => i.id === ctxTargetId);
  if (!item) return;
  if (!confirm(`Remove "${item.name}"?`)) return;
  removeItem(item.id); closeCtxMenu();
});

/* ================================================================
   SELECTION & BOTTOM PANEL
================================================================ */
function selectItem(id) {
  if (selectedId) {
    const prev = world.querySelector(`[data-id="${selectedId}"]`);
    if (prev) prev.classList.remove('selected');
  }
  selectedId = id;
  const item = inventory.find(i => i.id === id);
  if (!item) return;
  const el = world.querySelector(`[data-id="${id}"]`);
  if (el) el.classList.add('selected');

  ctrlName.childNodes[0].textContent = item.name;
  ctrlSub.textContent = 'selected';
  ctrlQty.textContent = item.qty;
  ctrlEject.style.display = item.folderId ? 'flex' : 'none';
  itemControls.classList.add('visible');
}

function deselectItem() {
  if (selectedId) {
    const el = world.querySelector(`[data-id="${selectedId}"]`);
    if (el) el.classList.remove('selected');
  }
  selectedId = null;
  hideControls();
}

function hideControls() { itemControls.classList.remove('visible'); }

document.getElementById('ctrlPlus').addEventListener('click', () => {
  const item = inventory.find(i => i.id === selectedId); if (!item) return;
  item.qty++;
  ctrlQty.textContent = item.qty;
  const badge = world.querySelector(`[data-id="${selectedId}"] .item-qty`);
  if (badge) badge.textContent = item.qty > 1 ? item.qty : '';
  save(); updateCount();
});

document.getElementById('ctrlMinus').addEventListener('click', () => {
  const item = inventory.find(i => i.id === selectedId); if (!item) return;
  if (item.qty > 1) {
    item.qty--;
    ctrlQty.textContent = item.qty;
    const badge = world.querySelector(`[data-id="${selectedId}"] .item-qty`);
    if (badge) badge.textContent = item.qty > 1 ? item.qty : '';
    save(); updateCount();
  } else {
    if (confirm(`Remove "${item.name}"?`)) removeItem(item.id);
  }
});

document.getElementById('ctrlRemove').addEventListener('click', () => {
  const item = inventory.find(i => i.id === selectedId);
  if (item && confirm(`Remove "${item.name}"?`)) removeItem(item.id);
});

ctrlEject.addEventListener('click', () => ejectFromFolder(selectedId));

function ejectFromFolder(id) {
  const item = inventory.find(i => i.id === id);
  if (!item || !item.folderId) return;
  const w = folderRelToWorld(item);
  const folder = folders.find(f => f.id === item.folderId);
  item.folderId = null;
  /* Place just to the right of the folder */
  item.wx = folder ? folder.wx + folder.w + 20 : w.x;
  item.wy = folder ? folder.wy + 40             : w.y;
  save(); renderAll(); selectItem(id);
  toast(`📤 "${item.name}" removed from folder`);
}

function removeItem(id) {
  const item = inventory.find(i => i.id === id);
  const name = item ? item.name : 'Item';
  inventory = inventory.filter(i => i.id !== id);
  if (selectedId === id) { selectedId = null; hideControls(); }
  save(); renderAll();
  toast(`✕ "${name}" removed.`);
}

/* ================================================================
   INIT
================================================================ */
load();

requestAnimationFrame(() => {
  const vr = viewport.getBoundingClientRect();
  if (view.x === 0 && view.y === 0 && view.scale === 1) {
    view.x = vr.width  / 2 - WORLD_W / 2;
    view.y = vr.height / 2 - WORLD_H / 2;
  }
  applyView();
});

renderAll();