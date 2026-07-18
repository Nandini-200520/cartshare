'use strict';

/* =========================================================
   CartShare — app.js
   Vanilla ES6, Bootstrap 5, localStorage persistence,
   cross-tab sync via the "storage" event.
   ========================================================= */

const LS_PREFIX = 'groupcart_room_';
const SS_USER = 'groupcart_username';
const SS_ROOM = 'groupcart_room';

const CATEGORY_CLASS = {
  'Groceries': 'cat-Groceries',
  'Household': 'cat-Household',
  'Electronics': 'cat-Electronics',
  'Personal Care': 'cat-Personal-Care',
  'Other': 'cat-Other'
};
const CATEGORY_ICON = {
  'Groceries': 'bi-egg-fried',
  'Household': 'bi-house-door',
  'Electronics': 'bi-cpu',
  'Personal Care': 'bi-droplet',
  'Other': 'bi-box-seam'
};

function uid(){ return Math.random().toString(36).slice(2, 10); }

function genRoomCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}

function money(n){ return '$' + Number(n || 0).toFixed(2); }

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(ts){
  const diff = Math.floor((Date.now() - ts) / 1000);
  if(diff < 5) return 'just now';
  if(diff < 60) return diff + 's ago';
  if(diff < 3600) return Math.floor(diff/60) + 'm ago';
  if(diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return new Date(ts).toLocaleString();
}

function showToast(message, variant){
  variant = variant || 'brand';
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'toast align-items-center border-0 show';
  el.style.background = variant === 'danger' ? '#F6DCD3' : '#DFF3EF';
  el.style.color = 'var(--text)';
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${escapeHtml(message)}</div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  host.appendChild(el);
  const t = new bootstrap.Toast(el, { delay: 2600 });
  t.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

function roomKey(code){ return LS_PREFIX + code.toUpperCase(); }

function roomExists(code){
  return localStorage.getItem(roomKey(code)) !== null;
}

function loadRoom(code){
  const raw = localStorage.getItem(roomKey(code));
  return raw ? JSON.parse(raw) : null;
}

function saveRoom(room){
  localStorage.setItem(roomKey(room.code), JSON.stringify(room));
}

function createRoom(){
  let code = genRoomCode();
  while(roomExists(code)) code = genRoomCode();
  const room = { code, createdAt: Date.now(), items: [], activity: [], members: [] };
  saveRoom(room);
  return room;
}

function logActivity(room, user, text){
  room.activity.unshift({ id: uid(), user, text, ts: Date.now() });
  if(room.activity.length > 200) room.activity.length = 200;
}

function ensureMember(room, user){
  if(!room.members.find(m => m.name === user)){
    room.members.push({ name: user, joinedAt: Date.now() });
    logActivity(room, user, `joined the room`);
  }
}

const state = {
  username: sessionStorage.getItem(SS_USER) || '',
  roomCode: sessionStorage.getItem(SS_ROOM) || '',
  currentView: 'cart'
};

function showScreen(name){
  document.getElementById('authScreen').classList.toggle('d-none', name !== 'auth');
  document.getElementById('authScreen').classList.toggle('d-flex', name === 'auth');
  document.getElementById('roomScreen').classList.toggle('d-none', name !== 'room');
  document.getElementById('roomScreen').classList.toggle('d-flex', name === 'room');
  document.getElementById('dashboard').classList.toggle('d-none', name !== 'dashboard');
}

function boot(){
  if(!state.username){
    showScreen('auth');
  } else if(!state.roomCode || !roomExists(state.roomCode)){
    document.getElementById('greetName').textContent = state.username;
    showScreen('room');
  } else {
    enterDashboard();
  }
}

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('usernameInput');
  const name = input.value.trim();
  if(!name) return;
  state.username = name;
  sessionStorage.setItem(SS_USER, name);
  document.getElementById('greetName').textContent = name;
  showScreen('room');
});

document.getElementById('logoutFromRoom').addEventListener('click', () => {
  sessionStorage.removeItem(SS_USER);
  state.username = '';
  showScreen('auth');
});

document.getElementById('createRoomBtn').addEventListener('click', () => {
  const room = createRoom();
  ensureMember(room, state.username);
  saveRoom(room);
  state.roomCode = room.code;
  sessionStorage.setItem(SS_ROOM, room.code);
  enterDashboard();
  showToast(`Room ${room.code} created!`);
});

document.getElementById('joinRoomForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('joinRoomInput');
  const code = input.value.trim().toUpperCase();
  if(!code) return;
  if(!roomExists(code)){
    showToast(`Room "${code}" not found. Double check the code or create a new room.`, 'danger');
    return;
  }
  const room = loadRoom(code);
  ensureMember(room, state.username);
  saveRoom(room);
  state.roomCode = code;
  sessionStorage.setItem(SS_ROOM, code);
  enterDashboard();
  showToast(`Joined room ${code}`);
});

function leaveRoom(){
  const room = loadRoom(state.roomCode);
  if(room){
    logActivity(room, state.username, 'left the room');
    saveRoom(room);
  }
  sessionStorage.removeItem(SS_ROOM);
  state.roomCode = '';
  document.getElementById('greetName').textContent = state.username;
  showScreen('room');
}
document.getElementById('leaveRoomBtn').addEventListener('click', leaveRoom);
document.getElementById('leaveRoomBtnM').addEventListener('click', leaveRoom);

function enterDashboard(){
  showScreen('dashboard');
  document.getElementById('sbRoomCode').textContent = state.roomCode;
  document.getElementById('sbRoomCodeM').textContent = state.roomCode;
  document.getElementById('sbUserName').textContent = state.username;
  document.getElementById('sbUserNameM').textContent = state.username;
  switchView('cart');
  renderAll();
}

const VIEW_TITLES = {
  cart: 'Shared Cart',
  activity: 'Activity Log',
  members: 'Members',
  receipt: 'Printable Receipt'
};

function switchView(view){
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.add('d-none'));
  document.getElementById('view-' + view).classList.remove('d-none');
  document.getElementById('viewTitle').textContent = VIEW_TITLES[view];

  [...document.querySelectorAll('#sideNav .nav-link-custom'), ...document.querySelectorAll('#sideNavMobile .nav-link-custom')]
    .forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));

  renderAll();

  const oc = bootstrap.Offcanvas.getInstance(document.getElementById('mobileSidebar'));
  if(oc) oc.hide();
}

document.querySelectorAll('#sideNav .nav-link-custom, #sideNavMobile .nav-link-custom').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function copyCode(){
  navigator.clipboard?.writeText(state.roomCode).then(() => {
    showToast('Room code copied to clipboard');
  }).catch(() => showToast('Could not copy code', 'danger'));
}
document.getElementById('copyCodeBtn').addEventListener('click', copyCode);
document.getElementById('copyCodeBtnM').addEventListener('click', copyCode);

document.getElementById('addItemForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('itemName').value.trim();
  const qty = parseInt(document.getElementById('itemQty').value, 10) || 1;
  const price = parseFloat(document.getElementById('itemPrice').value) || 0;
  const category = document.getElementById('itemCategory').value;
  if(!name) return;

  const room = loadRoom(state.roomCode);
  if(!room) return;

  const item = { id: uid(), name, qty, price, category, addedBy: state.username, addedAt: Date.now() };
  room.items.unshift(item);
  logActivity(room, state.username, `added "${name}" (x${qty})`);
  saveRoom(room);

  e.target.reset();
  document.getElementById('itemQty').value = 1;
  document.getElementById('itemPrice').value = '0.00';
  renderAll();
  showToast(`Added "${name}" to the cart`);
});

let editModalInstance = null;
function openEditModal(itemId){
  const room = loadRoom(state.roomCode);
  const item = room.items.find(i => i.id === itemId);
  if(!item) return;
  document.getElementById('editItemId').value = item.id;
  document.getElementById('editItemName').value = item.name;
  document.getElementById('editItemQty').value = item.qty;
  document.getElementById('editItemPrice').value = item.price;
  document.getElementById('editItemCategory').value = item.category;
  editModalInstance = editModalInstance || new bootstrap.Modal(document.getElementById('editItemModal'));
  editModalInstance.show();
}

document.getElementById('editItemForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('editItemId').value;
  const room = loadRoom(state.roomCode);
  const item = room.items.find(i => i.id === id);
  if(!item) return;

  item.name = document.getElementById('editItemName').value.trim() || item.name;
  item.qty = parseInt(document.getElementById('editItemQty').value, 10) || 1;
  item.price = parseFloat(document.getElementById('editItemPrice').value) || 0;
  item.category = document.getElementById('editItemCategory').value;

  logActivity(room, state.username, `edited "${item.name}"`);
  saveRoom(room);

  editModalInstance.hide();
  renderAll();
  showToast(`Updated "${item.name}"`);
});

function deleteItem(itemId){
  const room = loadRoom(state.roomCode);
  const item = room.items.find(i => i.id === itemId);
  if(!item) return;
  if(!confirm(`Remove "${item.name}" from the cart?`)) return;
  room.items = room.items.filter(i => i.id !== itemId);
  logActivity(room, state.username, `removed "${item.name}"`);
  saveRoom(room);
  renderAll();
  showToast(`Removed "${item.name}"`);
}

function renderAll(){
  const room = loadRoom(state.roomCode);
  if(!room){ leaveRoom(); return; }

  renderStats(room);
  if(state.currentView === 'cart') renderCart(room);
  if(state.currentView === 'activity') renderActivity(room);
  if(state.currentView === 'members') renderMembers(room);
  if(state.currentView === 'receipt') renderReceipt(room);
}

function renderStats(room){
  const totalItems = room.items.reduce((s,i) => s + i.qty, 0);
  const total = room.items.reduce((s,i) => s + i.qty * i.price, 0);
  document.getElementById('itemCountPill').textContent = totalItems;
  document.getElementById('totalPill').textContent = total.toFixed(2);
}

function renderCart(room){
  const wrap = document.getElementById('cartListWrap');
  const empty = document.getElementById('emptyCart');
  wrap.innerHTML = '';

  if(room.items.length === 0){
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');

  room.items.forEach(item => {
    const catClass = CATEGORY_CLASS[item.category] || 'cat-Other';
    const catIcon = CATEGORY_ICON[item.category] || 'bi-box-seam';
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-swatch ${catClass}"><i class="bi ${catIcon}"></i></div>
      <div class="item-meta">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-sub">Qty ${item.qty} &middot; ${escapeHtml(item.category)} &middot; added by ${escapeHtml(item.addedBy)}</div>
      </div>
      <div class="item-price">${money(item.qty * item.price)}</div>
      <div class="item-actions">
        <button class="btn btn-sm btn-light" data-action="edit" data-id="${item.id}" title="Edit"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-light text-danger" data-action="delete" data-id="${item.id}" title="Delete"><i class="bi bi-trash3"></i></button>
      </div>`;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  wrap.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deleteItem(btn.dataset.id));
  });
}

function renderActivity(room){
  const list = document.getElementById('activityList');
  const empty = document.getElementById('emptyActivity');
  list.innerHTML = '';
  if(room.activity.length === 0){
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');
  room.activity.forEach(a => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="activity-dot"></div>
      <div>
        <div><strong>${escapeHtml(a.user)}</strong> ${escapeHtml(a.text)}</div>
        <div class="activity-time">${timeAgo(a.ts)}</div>
      </div>`;
    list.appendChild(li);
  });
}

function renderMembers(room){
  const wrap = document.getElementById('membersList');
  wrap.innerHTML = '';
  room.members.forEach(m => {
    const col = document.createElement('div');
    col.className = 'col-sm-6 col-lg-4';
    const initials = m.name.trim().slice(0,2).toUpperCase();
    col.innerHTML = `
      <div class="member-card">
        <div class="member-avatar">${escapeHtml(initials)}</div>
        <div>
          <div class="fw-semibold">${escapeHtml(m.name)}${m.name === state.username ? ' <span class="badge bg-secondary-subtle text-dark ms-1">you</span>' : ''}</div>
          <div class="small text-muted">joined ${timeAgo(m.joinedAt)}</div>
        </div>
      </div>`;
    wrap.appendChild(col);
  });
}

function renderReceipt(room){
  document.getElementById('rcRoom').textContent = room.code;
  document.getElementById('rcDate').textContent = new Date().toLocaleString();
  const body = document.getElementById('rcBody');
  body.innerHTML = '';
  let total = 0;
  room.items.forEach(item => {
    const subtotal = item.qty * item.price;
    total += subtotal;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(item.name)}</td>
      <td>${item.qty}</td>
      <td>${money(item.price)}</td>
      <td class="text-end">${money(subtotal)}</td>`;
    body.appendChild(tr);
  });
  if(room.items.length === 0){
    body.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No items yet</td></tr>`;
  }
  document.getElementById('rcTotal').textContent = money(total);
}

document.getElementById('printBtn').addEventListener('click', () => window.print());

window.addEventListener('storage', (e) => {
  if(!e.key) return;
  if(state.roomCode && e.key === roomKey(state.roomCode)){
    renderAll();
  }
});

boot();