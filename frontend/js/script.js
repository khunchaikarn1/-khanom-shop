let finType = 'expense'; let tempFinBase64 = null; let tempOrdBase64 = null; let currentUser = null; 
// 🌟 แก้ไข API_URL ให้ชี้ไปที่ Render (อย่าลืมเปลี่ยน banana-backend เป็นชื่อโปรเจกต์ที่คุณวงศกรตั้งใน Render นะครับ)
const API_URL = 'https://banana-backend-fbt6.onrender.com/api';
let currentOrdFile = null; let currentFinFile = null; // 🌟 เพิ่มตัวแปรสำหรับเก็บไฟล์รูปจริง (Multer)
let currentEditId = null; let currentDeleteId = null; let currentDeleteTable = null; let allOrdersData = []; let currentOrderFilter = 'all'; let currentCancelOrderId = null; let currentOrderTypeFilter = 'all'; let allProductsData = []; let currentProdFilter = 'normal'; let isProductsRendered = false; let mySalesChart = null; let quickOrderItems = {}; let consignItems = {}; let consignReturnItems = {}; let previousPendingCount = 0; let isFirstLoad = true; let isStoreOpen = true; let combinedFinanceData = []; let currentFinanceFilter = 'all'; let currentConsignFilter = 'all'; let currentConsignOrderId = null; let currentEditOrderId = null; 
let currentOrderPage = 1; let savedOrdersToRender = []; const ORDERS_PER_PAGE = 5; let currentConsignPage = 1; let savedConsignToRender = [];

// ==========================================
// 🛡️ ระบบรักษาความปลอดภัย (แนบ Token อัตโนมัติ)
// ==========================================
const originalFetch = window.fetch;
window.fetch = async function() {
    let [resource, config] = arguments;
    if(typeof resource === 'string' && resource.includes(API_URL)) {
        config = config || {}; config.headers = config.headers || {};
        const token = localStorage.getItem('token');
        if (token && !config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`; // 🔑 แนบกุญแจ
        }
    }
    const res = await originalFetch(resource, config);
    // ถ้ากุญแจหมดอายุ หรือไม่มีสิทธิ์ ให้เด้งกลับไปหน้าล็อกอิน
    if ((res.status === 401 || res.status === 403) && !resource.includes('/login') && !resource.includes('/upload')) {
        localStorage.removeItem('token'); localStorage.removeItem('user');
        alert('เซสชันหมดอายุ หรือไม่มีสิทธิ์เข้าถึง กรุณาล็อกอินใหม่ครับ 🔒');
        window.location.reload();
    }
    return res;
};

// ==========================================
// 📁 ระบบอัปโหลดไฟล์ไปที่ Server (Multer)
// ==========================================
async function uploadImageToServer(file) {
    if (!file) return null;
    const formData = new FormData(); formData.append('slip', file);
    try {
        const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
        if (!res.ok) return null;
        const data = await res.json();
        const baseUrl = API_URL.replace('/api', ''); // ตัด /api ออก
        return baseUrl + data.imageUrl; // คืนค่า URL จริงของรูป
    } catch (err) { console.error("Upload error", err); return null; }
}

const notificationAudio = new Audio('https://actions.google.com/sounds/v1/doors/doorbell_melody.ogg');
function playNotificationSound() { try { notificationAudio.currentTime = 0; notificationAudio.play().catch(e => {}); } catch(e) {} }
function safeStr(str) { if (!str) return ''; return str.replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
function addToCalendar(name, total, paid, dateStr) {
    const title = encodeURIComponent(`🍌 ส่งจัดเลี้ยง: ${name}`); const details = encodeURIComponent(`ยอดรวม: ฿${total}\nโอนมาแล้ว: ฿${paid}\n(เตรียมกล้วยทอดให้พร้อมด้วยน้า!)`); let start = new Date(dateStr); if (isNaN(start.getTime())) start = new Date(); let end = new Date(start.getTime() + (2 * 60 * 60 * 1000)); const pad = (n) => String(n).padStart(2, '0'); const startFmt = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}T${pad(start.getHours())}${pad(start.getMinutes())}00`; const endFmt = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`; const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startFmt}/${endFmt}&details=${details}`; window.open(url, '_blank');
}
function getLocalDateString(dateInput) { if (!dateInput) return ''; let d = new Date(dateInput); if (isNaN(d.getTime())) return dateInput.split('T')[0]; return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function getValidOrderDate(o) { let isOnline = o.customer_name && o.customer_name.includes('(ออนไลน์)'); if (isOnline && o.created_at) return getLocalDateString(o.created_at); return getLocalDateString(o.order_date || o.created_at); }
function setOrderInputMode(mode) {
    document.getElementById('tabSaleNormal').classList.toggle('active', mode === 'normal'); document.getElementById('tabSaleConsign').classList.toggle('active', mode === 'consignment');
    if (mode === 'consignment') { document.getElementById('tabSaleConsign').style.background = '#F3E5F5'; document.getElementById('tabSaleNormal').style.background = 'none'; document.getElementById('tabSaleNormal').style.color = 'var(--text2)'; document.getElementById('ordName').value = ''; document.getElementById('ordName').placeholder = 'ชื่อร้านที่ฝากขาย (เช่น ร้านป้าน้อย)'; document.getElementById('orderSelectTitle').innerText = 'เลือกจำนวนของไปส่งร้าน (ถุง):'; document.getElementById('orderSummaryLabel').innerText = '📦 สรุปจำนวนของฝากขาย:'; document.getElementById('orderTotalLabel').innerText = 'รวมจำนวนทั้งหมด (ถุง):'; document.getElementById('btnGroupNormal').style.display = 'none'; document.getElementById('btnGroupConsign').style.display = 'flex'; document.getElementById('advancedPayment').style.display = 'none'; } 
    else { document.getElementById('tabSaleNormal').style.background = 'var(--primary)'; document.getElementById('tabSaleNormal').style.color = '#fff'; document.getElementById('tabSaleConsign').style.background = 'none'; document.getElementById('ordName').value = 'ลูกค้าหน้าร้าน'; document.getElementById('ordName').placeholder = 'ชื่อลูกค้า / จุดสังเกต'; document.getElementById('orderSelectTitle').innerText = 'จิ้มเลือกราคาที่สั่ง (กดบวกเพิ่มได้เลย):'; document.getElementById('orderSummaryLabel').innerText = '🛒 สรุปรายการสั่งซื้อ:'; document.getElementById('orderTotalLabel').innerText = 'รวมต้องจ่ายทั้งหมด (บาท):'; document.getElementById('btnGroupNormal').style.display = 'flex'; document.getElementById('btnGroupConsign').style.display = 'none'; }
    if (isProductsRendered) renderOrderProductSelection(); resetQuickOrder();
}
function addQuickItem(name, amount, emoji, index) { if (!quickOrderItems[name]) quickOrderItems[name] = { price: 0, emoji: emoji, index: index }; quickOrderItems[name].price += amount; updateQuickOrderUI(); }
function clearQuickItem(name, index) { if (quickOrderItems[name]) delete quickOrderItems[name]; updateQuickOrderUI(); }
function updateQuickOrderUI() {
  let total = 0; let summaryHtml = ''; document.querySelectorAll('[id^="qo-amt-"]').forEach(el => { el.style.display = 'none'; el.innerText = ''; });
  for (let name in quickOrderItems) { const item = quickOrderItems[name]; total += item.price; summaryHtml += `<div style="display:flex; justify-content:space-between; font-size:15px; color:var(--text); margin-bottom:6px; border-bottom:1px solid #f0f0f0; padding-bottom:4px;"><span style="font-weight:bold;">${item.emoji} ${name}</span><span style="font-weight:bold; color:var(--primary);">฿${item.price}</span></div>`; const lbl = document.getElementById(`qo-amt-${item.index}`); if (lbl) { lbl.style.display = 'inline-block'; lbl.innerText = `฿${item.price}`; } }
  document.getElementById('quickOrderSummaryList').innerHTML = summaryHtml || '<div style="color:var(--text3); font-size:13px; text-align:center; padding:10px 0;">ยังไม่ได้เลือกรายการ</div>'; document.getElementById('ordTotal').value = total > 0 ? total : ''; checkPaymentStatus();
}

function toggleOnlineMode(isChecked) {
    const nameInput = document.getElementById('ordName');
    if(isChecked) {
        if(nameInput.value === 'ลูกค้าหน้าร้าน') nameInput.value = '';
        nameInput.placeholder = 'ชื่อลูกค้า (เช่น คุณสมศรี)';
        nameInput.style.borderColor = '#B8D4FF';
        nameInput.style.color = '#0056b3';
    } else {
        if(nameInput.value === '') nameInput.value = 'ลูกค้าหน้าร้าน';
        nameInput.placeholder = 'ชื่อลูกค้า / จุดสังเกต';
        nameInput.style.borderColor = 'var(--border)';
        nameInput.style.color = 'var(--text)';
    }
}

function resetQuickOrder() { quickOrderItems = {}; updateQuickOrderUI(); document.getElementById('ordName').value = 'ลูกค้าหน้าร้าน'; document.getElementById('advancedPayment').style.display = 'none'; document.getElementById('ordPaidAmount').value = ''; document.getElementById('ordSlipInput').value = ''; document.getElementById('ordSlipPreview').style.display = 'none'; document.getElementById('ordUploadPlaceholder').style.display = 'block'; document.getElementById('btnChangeOrdSlip').style.display = 'none'; document.getElementById('ordUploadZone').style.borderStyle = 'dashed'; document.getElementById('paymentStatusText').innerHTML = ''; tempOrdBase64 = null; currentOrdFile = null; const chk = document.getElementById('isOnlineOrderCheckbox'); if (chk) { chk.checked = false; toggleOnlineMode(false); } }

function addConsignItem(name, qty, price, emoji, index) { if (!consignItems[name]) consignItems[name] = { qty: 0, price: price, emoji: emoji, index: index }; consignItems[name].qty += qty; updateConsignUI(); }
function clearConsignItem(name, index) { if (consignItems[name]) delete consignItems[name]; updateConsignUI(); }
function updateConsignUI() {
  let totalQty = 0; let totalValue = 0; let summaryHtml = ''; document.querySelectorAll('[id^="csn-amt-"]').forEach(el => { el.style.display = 'none'; el.innerText = ''; });
  for (let name in consignItems) { const item = consignItems[name]; totalQty += item.qty; let itemTotal = item.qty * item.price; totalValue += itemTotal; summaryHtml += `<div style="display:flex; justify-content:space-between; font-size:15px; color:var(--text); margin-bottom:6px; border-bottom:1px dashed #CE93D8; padding-bottom:4px;"><span style="font-weight:bold;">${item.emoji} ${name}</span><span style="font-weight:bold; color:var(--consignment);">${item.qty} ถุง (฿${itemTotal})</span></div>`; const lbl = document.getElementById(`csn-amt-${item.index}`); if (lbl) { lbl.style.display = 'inline-block'; lbl.innerText = `${item.qty} ถุง`; } }
  document.getElementById('consignSummaryList').innerHTML = summaryHtml || '<div style="color:var(--text3); font-size:13px; text-align:center; padding:10px 0;">ยังไม่ได้เลือกรายการ</div>'; document.getElementById('csnTotalQtyText').innerText = totalQty; document.getElementById('csnTotalValue').value = totalValue > 0 ? totalValue : '';
}
function resetConsignOrder() { consignItems = {}; updateConsignUI(); document.getElementById('csnName').value = ''; }
async function saveQuickCashOrder() { const total = Number(document.getElementById('ordTotal').value); if (total <= 0) return showToast('กรุณาเลือกขนมก่อนครับ', 'error'); document.getElementById('ordPaidAmount').value = total; await saveOrder(); }

async function saveOrder(forceStatus = null) {
  const dateVal = document.getElementById('ordDate').value; 
  let rawName = document.getElementById('ordName').value.trim();
  if (rawName === '') rawName = 'ลูกค้าหน้าร้าน'; 

  let amount = Number(document.getElementById('ordTotal').value); 
  const paid = Number(document.getElementById('ordPaidAmount').value) || 0; 
  
  const chk = document.getElementById('isOnlineOrderCheckbox');
  const isOnline = chk ? chk.checked : false;
  if (isOnline && !rawName.includes('(ออนไลน์)')) { rawName += ' (ออนไลน์)'; }

  let orderItems = [];
  for (let itemName in quickOrderItems) { 
      const item = quickOrderItems[itemName]; 
      orderItems.push({ name: itemName, price: item.price, emoji: item.emoji }); 
  }
  
  if(orderItems.length === 0) return showToast('กรุณาเลือกขนมอย่างน้อย 1 อย่าง', 'error'); 
  if (amount <= 0) return showToast('ยอดเงินไม่ถูกต้อง', 'error');
  
  try {
    let finalSlipUrl = tempOrdBase64;
    // 🌟 ส่งไฟล์รูปให้หลังบ้านถ้ามีการอัปโหลด
    if (currentOrdFile) {
        showToast('กำลังอัปโหลดรูปภาพ... ⏳', 'success');
        finalSlipUrl = await uploadImageToServer(currentOrdFile) || tempOrdBase64;
    }

    const payload = { customer_name: rawName, total_amount: amount, paid_amount: paid, slip_image: finalSlipUrl, items: orderItems, order_date: dateVal };
    const res = await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); 
    if(!res.ok) throw new Error(); 
    const data = await res.json();
    
    let finalStatus = forceStatus;
    if (!finalStatus) { 
        if (isOnline) finalStatus = 'cooking'; 
        else finalStatus = 'completed'; 
    }

    const targetId = data.orderId || data.id;

    if(finalStatus && targetId) { 
        await fetch(`${API_URL}/orders/${targetId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: finalStatus }) }); 
    }
    
    resetQuickOrder(); 
    setDefaultDate(); 
    
    if (isOnline) {
        setOrderFilter('cooking', document.querySelector('.tab-cooking'));
    } else {
        setOrderFilter('today', document.querySelector('.tab-today'));
    }

    await loadAllData(); 
    showToast(isOnline ? 'บันทึกคิวออนไลน์สำเร็จ! 📱' : 'บันทึกออเดอร์สำเร็จ! 🚀');
  } catch(e) { 
      showToast('เชื่อมต่อหลังบ้านไม่สำเร็จ!', 'error'); 
  }
}

async function saveConsignOrder() {
  const totalValue = Number(document.getElementById('csnTotalValue').value); if (totalValue <= 0) return showToast('กรุณาเลือกของไปส่งร้านก่อนครับ', 'error');
  let rawName = document.getElementById('csnName').value || 'ร้านค้า'; let name = `[ฝากขาย] ${rawName}`; let dateVal = document.getElementById('csnDate').value; let orderItems = [];
  for (let itemName in consignItems) { const item = consignItems[itemName]; orderItems.push({ name: itemName, qty: item.qty, price: item.price, emoji: item.emoji }); }
  try {
    const res = await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_name: name, total_amount: totalValue, paid_amount: 0, slip_image: null, items: orderItems, order_date: dateVal }) }); if(!res.ok) throw new Error(); const data = await res.json();
    await fetch(`${API_URL}/orders/${data.orderId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'consigned' }) });
    resetConsignOrder(); setDefaultDate(); loadAllData(); switchPage('consignment', document.getElementById('nav-consignment')); showToast('สร้างบิลฝากขายสำเร็จ! 🚚');
  } catch(e) { showToast('เชื่อมต่อหลังบ้านไม่สำเร็จ!', 'error'); }
}
async function saveProduct() {
  const emoji = document.getElementById('newProdEmoji').value; const name = document.getElementById('newProdName').value; const price = document.getElementById('newProdPrice').value; const category = document.querySelector('input[name="newProdCategory"]:checked').value;
  if(!name || !price || !emoji) return showToast('กรุณากรอกข้อมูลให้ครบ', 'error');
  try {
    const res = await fetch(`${API_URL}/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price, emoji, category }) }); if(!res.ok) return showToast('ไม่สามารถเพิ่มสินค้าได้', 'error');
    document.getElementById('newProdEmoji').value = ''; document.getElementById('newProdName').value = ''; document.getElementById('newProdPrice').value = ''; setProductFilter(category); isProductsRendered = false; loadAllData(); showToast('เพิ่มสินค้าสำเร็จ!');
  } catch(e) { showToast('เชื่อมต่อหลังบ้านไม่สำเร็จ!', 'error'); }
}
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer'); const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${message}`;
  container.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3000);
}
function closeModal(modalId) { document.getElementById(modalId).classList.remove('open'); }
function formatThaiDate(dateString) { if(!dateString) return ''; const d = new Date(dateString); const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']; const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `วัน${days[d.getDay()]}ที่ ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`; }
function setDefaultDate() { const today = new Date(); const dStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; if(document.getElementById('ordDate')) document.getElementById('ordDate').value = dStr; if(document.getElementById('csnDate')) document.getElementById('csnDate').value = dStr; }

// 🌟 ระบบล็อกอิน และเซฟ Token
async function handleLogin() {
  const pin = document.getElementById('pinInput').value;
  try { 
      const res = await fetch(`${API_URL}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) }); 
      if (res.ok) { 
          const data = await res.json(); 
          localStorage.setItem('user', JSON.stringify(data.user)); 
          localStorage.setItem('token', data.token); // 🔑 บันทึกกุญแจไว้ใช้งานต่อ!
          notificationAudio.load(); notificationAudio.volume = 0; notificationAudio.play().then(() => { notificationAudio.pause(); notificationAudio.currentTime = 0; notificationAudio.volume = 1; }).catch(e => {}); 
          initApp(data.user); showToast(`ยินดีต้อนรับคุณ ${data.user.name}`); 
      } else { showToast('รหัส PIN ไม่ถูกต้อง!', 'error'); } 
  } catch(e) { showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error'); }
}

window.onload = () => { const user = JSON.parse(localStorage.getItem('user')); if(user) initApp(user); }
async function loadStoreStatus() { try { const res = await fetch(`${API_URL}/store-status`); if (res.ok) { const data = await res.json(); isStoreOpen = data.isOpen; updateStoreStatusUI(); } } catch(e) {} }
async function toggleStoreStatus() {
    if (!currentUser || currentUser.role !== 'admin') return; const originalStatus = isStoreOpen; isStoreOpen = !isStoreOpen; updateStoreStatusUI(); 
    try { const res = await fetch(`${API_URL}/store-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isOpen: isStoreOpen }) }); if (!res.ok) throw new Error('API NOT FOUND'); showToast(isStoreOpen ? 'ร้านเปิดรับออเดอร์แล้ว' : 'ปิดร้านชั่วคราวแล้ว'); } catch(e) { showToast('ระบบหลังบ้านยังไม่รองรับการปิดร้าน', 'error'); isStoreOpen = originalStatus; updateStoreStatusUI(); }
}
function updateStoreStatusUI() { const btn = document.getElementById('btnStoreStatus'); if (!btn) return; if (isStoreOpen) { btn.classList.remove('closed'); btn.innerText = '🟢 เปิดรับออเดอร์'; } else { btn.classList.add('closed'); btn.innerText = '🔴 ปิดรับออเดอร์'; } }
function initApp(user) {
  currentUser = user; document.getElementById('loginScreen').style.display = 'none'; document.getElementById('mainApp').style.display = 'block'; document.getElementById('userName').innerText = user.name; setDefaultDate(); 
  if(user.role === 'admin') { document.getElementById('btnTrash').style.display = 'block'; document.getElementById('btnStoreStatus').style.display = 'block'; } else if(user.role === 'staff') { document.getElementById('nav-finance').style.display = 'none'; document.getElementById('nav-dashboard').style.display = 'none'; document.getElementById('nav-products').style.display = 'none'; document.getElementById('btnStoreStatus').style.display = 'none'; switchPage('orders', document.getElementById('nav-orders')); }
  loadStoreStatus(); loadAllData(); setInterval(() => { loadAllData(); loadStoreStatus(); }, 10000); 
}
function logout() { localStorage.removeItem('user'); localStorage.removeItem('token'); location.reload(); }
function switchPage(pageId, btn) { document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); document.getElementById('page-' + pageId).classList.add('active'); if(btn) btn.classList.add('active'); if (pageId === 'consignment' || pageId === 'orders') renderOrderProductSelection(); }

function previewFile(event, previewId, base64Var) {
  const file = event.target.files[0]; if(!file) return; if(file.size > 5 * 1024 * 1024) { showToast('ไฟล์รูปใหญ่เกิน 5MB', 'error'); event.target.value = ''; return; }
  
  if(base64Var === 'finBase64') currentFinFile = file; // 🌟 เก็บไฟล์ตัวจริงเตรียมอัปโหลด
  if(base64Var === 'ordBase64') currentOrdFile = file;

  const reader = new FileReader(); reader.onload = e => { if(base64Var === 'finBase64') { tempFinBase64 = e.target.result; document.getElementById('finUploadPlaceholder').style.display = 'none'; document.getElementById('btnChangeFinSlip').style.display = 'flex'; document.getElementById('finUploadZone').style.padding = '5px'; document.getElementById('finUploadZone').style.borderStyle = 'solid'; } else if(base64Var === 'ordBase64') { tempOrdBase64 = e.target.result; extractAmountFromSlip(e.target.result); document.getElementById('ordUploadPlaceholder').style.display = 'none'; document.getElementById('btnChangeOrdSlip').style.display = 'flex'; document.getElementById('ordUploadZone').style.padding = '5px'; document.getElementById('ordUploadZone').style.borderStyle = 'solid'; } document.getElementById(previewId).src = e.target.result; document.getElementById(previewId).style.display = 'block'; }; reader.readAsDataURL(file);
}

async function extractAmountFromSlip(base64Image) {
  const inputAmt = document.getElementById('ordPaidAmount'); const aiStatus = document.getElementById('aiStatusText'); inputAmt.classList.add('scanning'); inputAmt.disabled = true; aiStatus.innerText = "🤖 กำลังให้ AI อ่านยอดเงินจากสลิป..."; aiStatus.style.color = "var(--primary)";
  try { const result = await Tesseract.recognize(base64Image, 'tha+eng'); const match = result.data.text.match(/([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/); if (match) { const amount = parseFloat(match[1].replace(/,/g, '')); inputAmt.value = amount; aiStatus.innerText = `✨ ดึงยอดเงินอัตโนมัติสำเร็จ!`; aiStatus.style.color = "var(--success)"; showToast(`ดึงยอดเงินสำเร็จ: ฿${amount}`); checkPaymentStatus(); } else { aiStatus.innerText = "⚠️ AI หาตัวเลขไม่เจอ รบกวนพิมพ์ยอดเงินเองครับ"; aiStatus.style.color = "var(--danger)"; } } catch (err) { aiStatus.innerText = "❌ ระบบอ่านสลิปขัดข้อง รบกวนพิมพ์ยอดเองครับ"; aiStatus.style.color = "var(--danger)"; } inputAmt.classList.remove('scanning'); inputAmt.disabled = false;
}
function viewImage(base64Str) { document.getElementById('modalImg').src = base64Str; document.getElementById('imageModal').classList.add('open'); }
function checkPaymentStatus() {
  const total = Number(document.getElementById('ordTotal').value) || 0; const paid = Number(document.getElementById('ordPaidAmount').value) || 0; const statusDiv = document.getElementById('paymentStatusText');
  if (total === 0) { statusDiv.innerHTML = ''; return; }
  if (paid === 0) statusDiv.innerHTML = `<span style="color: var(--danger);">🔴 รอจ่ายเงิน / เก็บปลายทาง (฿${total})</span>`; else if (paid === total) statusDiv.innerHTML = `<span style="color: var(--success);">🟢 จ่ายครบแล้ว พอดีเป๊ะ!</span>`; else if (paid < total) statusDiv.innerHTML = `<span style="color: #B8860B;">🟠 จ่ายขาด (ต้องเก็บเพิ่ม ฿${total - paid})</span>`; else statusDiv.innerHTML = `<span style="color: #0056b3;">🔵 จ่ายเกิน (ต้องทอน ฿${paid - total})</span>`;
}
async function updateOrderStatus(orderId, newStatus) { try { const res = await fetch(`${API_URL}/orders/${orderId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }); if(res.ok) { showToast('อัปเดตระบบเรียบร้อยแล้ว!'); loadAllData(); } } catch(e) { showToast('อัปเดตไม่สำเร็จ', 'error'); } }
function rejectOrder(id) { currentCancelOrderId = id; document.getElementById('cancelOrderModal').classList.add('open'); }
function submitRejectOrder() { if(!currentCancelOrderId) return; updateOrderStatus(currentCancelOrderId, 'cancelled'); closeModal('cancelOrderModal'); currentCancelOrderId = null; }
function openConsignClearModal(id, shopName, originalTotal) {
    currentConsignOrderId = id; document.getElementById('consignShopName').innerText = shopName.replace(/\[ฝากขาย\]/g, '').trim(); document.getElementById('consignOriginalTotal').innerText = originalTotal; consignReturnItems = {}; const order = allOrdersData.find(o => o.id === id); const container = document.getElementById('consignReturnItemsContainer');
    if (order && order.items) { try { const parsedItems = JSON.parse(order.items); container.innerHTML = parsedItems.map((item, index) => { const maxQty = item.qty || 0; if (maxQty === 0) return ''; return `<div class="return-item" style="background: #FFF0F0; border: 2px solid #FFBBBB; border-radius: 10px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 5px rgba(232, 66, 66, 0.1);"><div class="return-item-header" style="display: flex; justify-content: space-between; align-items: center; font-size: 15px; color: #C0392B; margin-bottom: 10px; font-weight: bold;"><span>${item.emoji || '📦'} ${item.name} <span style="font-size:13px; font-weight:normal; color:#E84242;">(ส่งไป ${maxQty} ถุง)</span></span><span style="background: #E84242; color: white; padding: 3px 8px; border-radius: 6px; font-size: 13px;" id="ret-val-${index}">คืน 0 ถุง (-฿0)</span></div><div class="return-item-controls" style="display: flex; gap: 8px;"><button class="btn-outline" style="flex:1; padding:8px; font-size:14px; font-family:'Prompt'; border-color:#FFBBBB; color:var(--danger); font-weight:bold; background:white;" onclick="addReturnQty(${index}, '${safeStr(item.name)}', ${item.price}, 1, ${maxQty})">+1 ถุง</button><button class="btn-outline" style="flex:1; padding:8px; font-size:14px; font-family:'Prompt'; border-color:#FFBBBB; color:var(--danger); font-weight:bold; background:white;" onclick="addReturnQty(${index}, '${safeStr(item.name)}', ${item.price}, 5, ${maxQty})">+5 ถุง</button><button class="btn-outline" style="padding:8px 12px; font-size:14px; color:#888; border-color:#ddd; background:#f5f5f5; font-weight:bold;" onclick="clearReturnQty(${index}, '${safeStr(item.name)}')">ล้าง</button></div></div>`; }).join(''); } catch(e) {} } else { container.innerHTML = '<div style="font-size:12px; color:red;">ไม่พบรายการสินค้า</div>'; }
    document.getElementById('consignFinalTotal').innerText = `฿${originalTotal}`; document.getElementById('consignClearModal').classList.add('open');
}
function addReturnQty(index, name, price, qtyToAdd, maxQty) { if (!consignReturnItems[name]) consignReturnItems[name] = { qty: 0, price: price, index: index }; let newQty = consignReturnItems[name].qty + qtyToAdd; if (newQty > maxQty) { newQty = maxQty; showToast('ยอดของคืนเกินกว่าที่ส่งไป!', 'error'); } consignReturnItems[name].qty = newQty; updateReturnUI(); }
function clearReturnQty(index, name) { if (consignReturnItems[name]) delete consignReturnItems[name]; const valSpan = document.getElementById(`ret-val-${index}`); if (valSpan) valSpan.innerText = `คืน 0 ถุง (-฿0)`; updateReturnUI(); }
function updateReturnUI() {
    let totalDeduction = 0; for (let name in consignReturnItems) { const item = consignReturnItems[name]; const deduction = item.qty * item.price; totalDeduction += deduction; const valSpan = document.getElementById(`ret-val-${item.index}`); if (valSpan) valSpan.innerText = `คืน ${item.qty} ถุง (-฿${deduction})`; }
    const ori = Number(document.getElementById('consignOriginalTotal').innerText); let finalAmount = ori - totalDeduction; if (finalAmount < 0) finalAmount = 0; document.getElementById('consignFinalTotal').innerText = `฿${finalAmount}`;
}
async function submitConsignClear() {
    if(!currentConsignOrderId) return; const finalAmountStr = document.getElementById('consignFinalTotal').innerText.replace('฿', ''); const finalAmount = Number(finalAmountStr); if (isNaN(finalAmount)) return showToast('คำนวณยอดเงินผิดพลาด', 'error');
    try {
        await fetch(`${API_URL}/orders/${currentConsignOrderId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) });
        const shopName = document.getElementById('consignShopName').innerText; let returnNote = ''; let hasReturn = false; const orderToUpdate = allOrdersData.find(o => o.id === currentConsignOrderId); let updatedItems = [];
        if(orderToUpdate) { try { let oldItems = JSON.parse(orderToUpdate.items || '[]'); updatedItems = oldItems.map(item => { if (consignReturnItems[item.name]) return { ...item, returnQty: consignReturnItems[item.name].qty }; return item; }); } catch(e) {} }
        for (let name in consignReturnItems) { if (consignReturnItems[name].qty > 0) { returnNote += `${name}=${consignReturnItems[name].qty}ถุง, `; hasReturn = true; } }
        let finalNote = `✅ รับเงินฝากขาย (${shopName})`; if (hasReturn) finalNote += ` [คืนของ: ${returnNote.slice(0, -2)}]`;
        await fetch(`${API_URL}/finance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'income', note: finalNote, amount: finalAmount, slip_image: null }) });
        if(orderToUpdate) { await fetch(`${API_URL}/orders/${currentConsignOrderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paid_amount: finalAmount, items: updatedItems }) }); }
        closeModal('consignClearModal'); showToast(`รับเงินฝากขาย ฿${finalAmount} เรียบร้อยแล้ว!`); loadAllData();
    } catch(e) { showToast('เกิดข้อผิดพลาดในการบันทึก', 'error'); }
}
function openEditOrderInfoModal(id, name) {
    currentEditOrderId = id; const order = allOrdersData.find(o => o.id === id); if (!order) return;
    let rawCustomerName = order.customer_name || ''; let phone = ''; const phoneMatch = rawCustomerName.match(/📞\s*([\d\-]+)/); if (phoneMatch) { phone = phoneMatch[1]; }
    let cleanName = rawCustomerName.replace(/📞\s*[\d\-]+/g, '').replace(/\[ฝากขาย\]|\(ออนไลน์\)|\[พร้อมเพย์\]|\[TrueWallet\]|\[เก็บปลายทาง\]|\[เก็บเงินปลายทาง\]/g, '').replace(/\[จัดเลี้ยง:.*?\]/g, '').trim();
    document.getElementById('editOrderName').value = cleanName; const phoneInput = document.getElementById('editOrderPhone'); if (phoneInput) { phoneInput.value = phone; }
    let dateStr = ""; if (order.order_date) dateStr = order.order_date.split('T')[0]; else if (order.created_at) dateStr = order.created_at.split('T')[0];
    const dateInput = document.getElementById('editOrderDate'); dateInput.value = dateStr; dateInput.readOnly = true; dateInput.onclick = null; dateInput.style.cursor = 'not-allowed'; dateInput.style.backgroundColor = '#F0F0F0'; dateInput.style.color = '#555';          
    const isConsign = order.customer_name.includes('[ฝากขาย]'); const isEvent = order.customer_name.includes('[จัดเลี้ยง'); 
    let items = []; try { items = JSON.parse(order.items || '[]'); } catch(e) {}
    window.currentEditItems = JSON.parse(JSON.stringify(items)); window.currentEditIsConsign = isConsign; window.currentEditIsEvent = isEvent; 
    renderEditOrderItems(); document.getElementById('editOrderInfoModal').classList.add('open');
}
function addEditItem() {
    const availableProducts = allProductsData.filter(p => {
        const cat = p.category || 'normal';
        if (window.currentEditIsConsign) return cat === 'consignment'; 
        if (window.currentEditIsEvent) return cat === 'event';         
        return cat === 'normal';                                       
    });
    
    if (availableProducts.length === 0) {
        return showToast('ไม่มีสินค้าในหมวดหมู่นี้ให้เลือก', 'error');
    }
    
    const firstProd = availableProducts[0];
    let newName = firstProd.name; 
    
    if (window.currentEditIsConsign) {
        window.currentEditItems.push({ name: newName, qty: 1, price: firstProd.price, isNew: true });
    } else {
        window.currentEditItems.push({ name: newName, price: firstProd.price, isNew: true });
    }
    renderEditOrderItems();
}
function updateNewItemProduct(idx, selectEl) { const selectedOption = selectEl.options[selectEl.selectedIndex]; window.currentEditItems[idx].name = selectedOption.value; window.currentEditItems[idx].price = Number(selectedOption.getAttribute('data-price')) || 0; renderEditOrderItems();  }
function renderEditOrderItems() {
    const container = document.getElementById('editOrderItemsContainer');
    
    const availableProducts = allProductsData.filter(p => {
        const cat = p.category || 'normal';
        if (window.currentEditIsConsign) return cat === 'consignment';
        if (window.currentEditIsEvent) return cat === 'event';
        return cat === 'normal';
    });

    container.innerHTML = window.currentEditItems.map((item, idx) => {
        const isDateItem = item.name.includes('📅');

        if (isDateItem) {
            let dtValue = "";
            const match = item.name.match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
            if (match) dtValue = `${match[1]}T${match[2]}`; 

            return `
            <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center; background:#FFF9E5; padding:10px; border-radius:8px; border:1.5px solid #FFE69C;">
                <div style="flex:2; display:flex; align-items:center; gap:8px;">
                    <span style="font-size:14px; font-weight:bold; color:#B8860B;">📅 เวลารับ:</span>
                    <input type="datetime-local" class="form-control" style="flex:1; font-size:14px; font-weight:bold; color:#B8860B; border:1px solid #D4AF37; background:#fff; padding:6px; font-family:'Prompt'; cursor:pointer;" 
                        value="${dtValue}" 
                        onclick="try { this.showPicker(); } catch(e) {}"
                        oninput="window.currentEditItems[${idx}].name = '📅 เวลารับ: ' + this.value.replace('T', ' ') + ' น.'" />
                </div>
                <div style="font-size:11px; color:#D4AF37; font-weight:bold; background:#FFF; padding:8px 10px; border-radius:6px; border:1px solid #FFE69C; text-align:center; pointer-events: none;">
                    จิ้มเลือกเวลา ⏳
                </div>
            </div>
            `;
        }

        let nameFieldHtml = '';
        if (item.isNew) {
            const optionsHtml = availableProducts.map(p => {
                const prodNameOnly = p.name;
                const isSelected = (item.name === prodNameOnly) ? 'selected' : '';
                return `<option value="${prodNameOnly}" data-price="${p.price}" ${isSelected}>${p.emoji} ${p.name}</option>`;
            }).join('');
            
            nameFieldHtml = `
                <select class="form-control" style="flex:2; padding:6px; font-size:13px; border-color:var(--primary); background:#FFF3E5; cursor:pointer;" onchange="updateNewItemProduct(${idx}, this)">
                    ${optionsHtml}
                </select>
            `;
        } else {
            nameFieldHtml = `<input type="text" class="form-control" style="flex:2; padding:6px; font-size:13px; background:#F0F0F0; color:#555; border-color:#ccc; cursor:not-allowed;" value="${safeStr(item.name)}" readonly />`;
        }

        const deleteBtnHtml = item.isNew 
            ? `<button class="btn-outline" style="padding:4px 8px; color:red; border:none; background:#FFF0F0;" onclick="removeEditItem(${idx})">ลบ</button>` 
            : ``;

        if (window.currentEditIsConsign) {
            return `
            <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center; background:#fff; padding:8px; border-radius:6px; border:1px solid #ddd;">
                ${nameFieldHtml}
                <div style="display:flex; align-items:center; gap:5px; flex:1;">
                    <input type="number" class="form-control" style="width:100%; padding:6px; font-size:13px; text-align:center;" value="${Number(item.qty || 0)}" oninput="window.currentEditItems[${idx}].qty = Number(this.value); updateEditTotal()" placeholder="ถุง" />
                    <span style="font-size:13px; color:#555;">ถุง</span>
                </div>
                ${deleteBtnHtml}
            </div>
            `;
        } else {
            return `
            <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center; background:#fff; padding:8px; border-radius:6px; border:1px solid #ddd;">
                ${nameFieldHtml}
                <input type="number" class="form-control" style="flex:1; padding:6px; font-size:13px;" value="${Number(item.price || 0)}" oninput="window.currentEditItems[${idx}].price = Number(this.value); updateEditTotal()" placeholder="ราคา" />
                ${deleteBtnHtml}
            </div>
            `;
        }
    }).join('');
    
    updateEditTotal();
}
function removeEditItem(idx) { window.currentEditItems.splice(idx, 1); renderEditOrderItems(); }
function updateEditTotal() {
    let total = 0; if (window.currentEditIsConsign) window.currentEditItems.forEach(i => { total += (Number(i.qty) || 0) * (Number(i.price) || 0); }); else window.currentEditItems.forEach(i => { total += Number(i.price) || 0; }); document.getElementById('editOrderTotal').innerText = `รวมยอดใหม่: ฿${total.toLocaleString()}`;
}
async function submitEditOrderInfo() {
    if(!currentEditOrderId) return;
    const newName = document.getElementById('editOrderName').value.trim(); const phoneInput = document.getElementById('editOrderPhone'); const newPhone = phoneInput ? phoneInput.value.trim() : ''; const newDate = document.getElementById('editOrderDate').value;
    const orderToEdit = allOrdersData.find(o => o.id === currentEditOrderId); if (!orderToEdit) return;
    let finalName = newName; if (newPhone) { finalName += ` 📞${newPhone}`; }
    if (orderToEdit.customer_name.includes('[ฝากขาย]')) finalName = `[ฝากขาย] ${finalName}`;
    if (orderToEdit.customer_name.includes('(ออนไลน์)')) finalName += ' (ออนไลน์)'; if (orderToEdit.customer_name.includes('[พร้อมเพย์]')) finalName += ' [พร้อมเพย์]'; if (orderToEdit.customer_name.includes('[TrueWallet]')) finalName += ' [TrueWallet]'; if (orderToEdit.customer_name.includes('[เก็บปลายทาง]')) finalName += ' [เก็บปลายทาง]';
    const eventMatch = orderToEdit.customer_name.match(/\[จัดเลี้ยง:.*?\]/); if(eventMatch) finalName += ` ${eventMatch[0]}`;
    let newTotal = 0; if (window.currentEditIsConsign) window.currentEditItems.forEach(i => { newTotal += (Number(i.qty) || 0) * (Number(i.price) || 0); }); else window.currentEditItems.forEach(i => { newTotal += Number(i.price) || 0; });
    let newPaidAmount = orderToEdit.paid_amount; if (!window.currentEditIsConsign && orderToEdit.paid_amount == orderToEdit.total_amount) newPaidAmount = newTotal; 
    try {
        const res = await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_name: finalName.trim(), total_amount: newTotal, paid_amount: newPaidAmount, slip_image: orderToEdit.slip_image, items: window.currentEditItems, order_date: newDate }) });
        const data = await res.json(); await fetch(`${API_URL}/orders/${data.orderId || data.id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: orderToEdit.status }) }); await fetch(`${API_URL}/orders/${currentEditOrderId}`, { method: 'DELETE' });
        closeModal('editOrderInfoModal'); showToast('แก้ไขข้อมูลออเดอร์สำเร็จ!'); loadAllData();
    } catch(e) { showToast('เกิดข้อผิดพลาดในการแก้ไข', 'error'); }
}
function openEditModal(id, oldName, oldPrice, oldEmoji, oldCategory) { currentEditId = id; document.getElementById('editProdEmoji').value = oldEmoji; document.getElementById('editProdName').value = oldName; document.getElementById('editProdPrice').value = oldPrice; document.getElementById('editProdCategory').value = oldCategory; document.getElementById('editModal').classList.add('open'); }
async function submitEditProduct() {
  if(!currentEditId) return; const newEmoji = document.getElementById('editProdEmoji').value; const newName = document.getElementById('editProdName').value; const newPrice = document.getElementById('editProdPrice').value; const newCategory = document.getElementById('editProdCategory').value;
  if(!newName || !newPrice || !newEmoji) return showToast('กรุณากรอกข้อมูลให้ครบ', 'error');
  try { const res = await fetch(`${API_URL}/products/${currentEditId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName, price: newPrice, emoji: newEmoji, category: newCategory }) }); if(!res.ok) return showToast('ไม่สามารถแก้ไขได้', 'error'); closeModal('editModal'); setProductFilter(newCategory); isProductsRendered = false; loadAllData(); showToast('แก้ไขข้อมูลสำเร็จ!'); } catch(e) { showToast('เชื่อมต่อหลังบ้านไม่สำเร็จ!', 'error'); }
}
function openDeleteModal(table, id) { currentDeleteTable = table; currentDeleteId = id; document.getElementById('deleteModal').classList.add('open'); }
async function submitDelete() {
  if(!currentDeleteId || !currentDeleteTable) return;
  try { const res = await fetch(`${API_URL}/${currentDeleteTable}/${currentDeleteId}`, { method: 'DELETE' }); if(!res.ok) return showToast('ไม่สามารถลบได้', 'error'); closeModal('deleteModal'); if(currentDeleteTable === 'products') isProductsRendered = false; loadAllData(); showToast('ย้ายข้อมูลลงถังขยะแล้ว'); } catch(e) { showToast('เชื่อมต่อหลังบ้านไม่สำเร็จ!', 'error'); }
}
async function openTrashModal() { document.getElementById('trashModal').classList.add('open'); loadTrashData(); }
async function loadTrashData() {
  try {
    const res = await fetch(`${API_URL}/trash`); const data = await res.json(); data.orders.sort((a,b) => b.id - a.id); data.finance.sort((a,b) => b.id - a.id); data.products.sort((a,b) => b.id - a.id);
    document.getElementById('trashOrders').innerHTML = data.orders.length ? data.orders.map(o => `<div class="trash-item"><div>👤 ${o.customer_name} (฿${o.total_amount})</div><button class="btn btn-outline" style="width:auto; padding:5px 10px; font-size:12px;" onclick="recoverItem('orders', ${o.id})">♻️ กู้คืน</button></div>`).join('') : '<div style="font-size:13px; color:var(--text3);">ไม่มีออเดอร์ที่ถูกลบ</div>';
    document.getElementById('trashFinance').innerHTML = data.finance.length ? data.finance.map(f => `<div class="trash-item"><div>${f.note} (${f.type==='income'?'+':'-'}฿${f.amount})</div><button class="btn btn-outline" style="width:auto; padding:5px 10px; font-size:12px;" onclick="recoverItem('finance', ${f.id})">♻️ กู้คืน</button></div>`).join('') : '<div style="font-size:13px; color:var(--text3);">ไม่มีการเงินที่ถูกลบ</div>';
    document.getElementById('trashProducts').innerHTML = data.products.length ? data.products.map(p => `<div class="trash-item"><div>${p.emoji} ${p.name} (฿${p.price})</div><button class="btn btn-outline" style="width:auto; padding:5px 10px; font-size:12px;" onclick="recoverItem('products', ${p.id})">♻️ กู้คืน</button></div>`).join('') : '<div style="font-size:13px; color:var(--text3);">ไม่มีสินค้าที่ถูกลบ</div>';
  } catch(e) { console.error('Error loading trash data'); }
}
async function recoverItem(table, id) { try { const res = await fetch(`${API_URL}/recover/${table}/${id}`, { method: 'PUT' }); if(!res.ok) return showToast('ไม่สามารถกู้คืนได้', 'error'); if(table === 'products') isProductsRendered = false; loadTrashData(); loadAllData(); showToast('กู้คืนข้อมูลสำเร็จ!'); } catch(e) { showToast('เชื่อมต่อหลังบ้านไม่สำเร็จ!', 'error'); } }
function setFinanceType(type) {
  finType = type; const btnExp = document.getElementById('btnExp'); const btnInc = document.getElementById('btnInc');
  if(type === 'expense') { btnExp.style.background = 'var(--danger)'; btnExp.style.borderColor = 'var(--danger)'; btnExp.style.color = '#fff'; btnInc.style.background = 'transparent'; btnInc.style.borderColor = 'var(--border)'; btnInc.style.color = 'var(--text2)'; } 
  else { btnInc.style.background = 'var(--success)'; btnInc.style.borderColor = 'var(--success)'; btnInc.style.color = '#fff'; btnExp.style.background = 'transparent'; btnExp.style.borderColor = 'var(--border)'; btnExp.style.color = 'var(--text2)'; }
  const tags = document.getElementById('quickExpenseTags'); const helper = document.getElementById('finHelperText');
  if (type === 'expense') { tags.style.display = 'flex'; helper.style.display = 'none'; document.getElementById('finNote').placeholder = "หรือ พิมพ์รายละเอียดเองตรงนี้..."; } 
  else { tags.style.display = 'none'; helper.style.display = 'block'; document.getElementById('finNote').placeholder = "รายละเอียดรายรับ (เช่น ขายของเก่า)..."; }
}
function setFinNote(text) { document.getElementById('finNote').value = text; }

// 🌟 ระบบเซฟบัญชี ให้รับไฟล์รูปแล้วส่งขึ้นไปเก็บได้
async function saveFinance() {
  const note = document.getElementById('finNote').value; const amount = document.getElementById('finAmount').value; if(!note || !amount) return showToast('กรอกข้อมูลให้ครบถ้วน', 'error');
  try { 
      let finalSlipUrl = tempFinBase64;
      if (currentFinFile) {
          showToast('กำลังอัปโหลดสลิป... ⏳', 'success');
          finalSlipUrl = await uploadImageToServer(currentFinFile) || tempFinBase64;
      }
      const res = await fetch(`${API_URL}/finance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: finType, note, amount, slip_image: finalSlipUrl }) }); 
      if(!res.ok) return showToast('ไม่สามารถบันทึกได้', 'error'); 
      
      document.getElementById('finNote').value = ''; document.getElementById('finAmount').value = ''; document.getElementById('finSlipInput').value = ''; document.getElementById('finSlipPreview').style.display = 'none'; tempFinBase64 = null; currentFinFile = null; document.getElementById('finUploadPlaceholder').style.display = 'block'; document.getElementById('btnChangeFinSlip').style.display = 'none'; document.getElementById('finUploadZone').style.padding = '25px 15px'; document.getElementById('finUploadZone').style.borderStyle = 'dashed'; loadAllData(); showToast('บันทึกสำเร็จ!'); 
  } catch(e) { showToast('เชื่อมต่อหลังบ้านไม่สำเร็จ!', 'error'); }
}

function renderOrderProductSelection() {
    const normalContainer = document.getElementById('orderProductSelection');
    const consignContainer = document.getElementById('consignProductSelection');
    const eventContainer = document.getElementById('eventProductSelection');

    if (normalContainer) {
        const normalProducts = allProductsData.filter(p => (p.category || 'normal') === 'normal');
        if (normalProducts.length === 0) { normalContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding:20px; color:var(--text3); background:var(--surface2); border-radius:12px;">📭 ไม่มีเมนูหน้าร้าน</div>'; } 
        else { normalContainer.innerHTML = normalProducts.map((p, index) => `<div class="menu-item" style="display:flex; flex-direction:column; align-items:flex-start; padding: 12px; margin-bottom:0; border: 1.5px solid var(--border); border-radius: 12px; background: #fff; cursor:default;"><div style="font-weight:bold; font-size: 16px; margin-bottom: 10px; display:flex; justify-content:space-between; width:100%;"><span>${p.emoji} ${p.name}</span><span id="qo-amt-${index}" style="color:var(--primary); font-size:15px; font-weight:bold; display:none; padding:2px 8px; border-radius:6px; background:#FFF3E5;"></span></div><div style="display:flex; gap: 6px; flex-wrap:wrap; width: 100%;"><button class="btn-outline" style="flex:1; padding:6px; font-size:14px; font-family:'Prompt';" onclick="addQuickItem('${safeStr(p.name)}', 10, '${p.emoji}', ${index})">+10฿</button><button class="btn-outline" style="flex:1; padding:6px; font-size:14px; font-family:'Prompt';" onclick="addQuickItem('${safeStr(p.name)}', 20, '${p.emoji}', ${index})">+20฿</button><button class="btn-outline" style="flex:1; padding:6px; font-size:14px; font-family:'Prompt';" onclick="addQuickItem('${safeStr(p.name)}', 30, '${p.emoji}', ${index})">+30฿</button><button class="btn-outline" style="padding:6px 10px; font-size:14px; color:var(--danger); border-color:#FFBBBB; background:#FFF0F0;" onclick="clearQuickItem('${safeStr(p.name)}', ${index})">ล้าง</button></div></div>`).join(''); }
    }

    if (consignContainer) {
        const consignProducts = allProductsData.filter(p => (p.category || 'normal') === 'consignment');
        if (consignProducts.length === 0) { consignContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding:20px; color:var(--text3); background:#F3E5F5; border-radius:12px;">📭 ไม่มีเมนูฝากขาย</div>'; } 
        else { consignContainer.innerHTML = consignProducts.map((p, index) => `<div class="menu-item" style="display:flex; flex-direction:column; align-items:flex-start; padding: 12px; margin-bottom:0; border: 1.5px solid #CE93D8; border-radius: 12px; background: #fff; cursor:default;"><div style="font-weight:bold; font-size: 16px; margin-bottom: 10px; display:flex; justify-content:space-between; width:100%;"><span>${p.emoji} ${p.name} <span style="font-size:12px; color:#888;">(฿${p.price})</span></span><span id="csn-amt-${index}" style="color:var(--consignment); font-size:15px; font-weight:bold; display:none; padding:2px 8px; border-radius:6px; background:#F3E5F5;"></span></div><div style="display:flex; gap: 6px; flex-wrap:wrap; width: 100%;"><button class="btn-outline" style="flex:1; padding:6px; font-size:14px; font-family:'Prompt'; border-color:#CE93D8; color:var(--consignment);" onclick="addConsignItem('${safeStr(p.name)}', 1, ${p.price}, '${p.emoji}', ${index})">+1 ถุง</button><button class="btn-outline" style="flex:1; padding:6px; font-size:14px; font-family:'Prompt'; border-color:#CE93D8; color:var(--consignment);" onclick="addConsignItem('${safeStr(p.name)}', 5, ${p.price}, '${p.emoji}', ${index})">+5 ถุง</button><button class="btn-outline" style="flex:1; padding:6px; font-size:14px; font-family:'Prompt'; border-color:#CE93D8; color:var(--consignment);" onclick="addConsignItem('${safeStr(p.name)}', 10, ${p.price}, '${p.emoji}', ${index})">+10 ถุง</button><button class="btn-outline" style="padding:6px 10px; font-size:14px; color:var(--danger); border-color:#FFBBBB; background:#FFF0F0;" onclick="clearConsignItem('${safeStr(p.name)}', ${index})">ล้าง</button></div></div>`).join(''); }
    }

    if (eventContainer) {
        let eventHtml = `
        <div class="menu-item" style="display:flex; flex-direction:column; align-items:flex-start; padding: 15px; border: 2px solid #D4AF37; border-radius: 12px; background: #FFFdfa; grid-column: 1 / -1; margin-bottom: 5px;">
            <div style="font-weight:bold; font-size: 16px; margin-bottom: 12px; display:flex; justify-content:space-between; width:100%; color:#B8860B;">
                <span>🎁 คละขนมรวมทุกอย่าง</span>
                <span id="ev-amt-mixed" style="color:#B8860B; font-size:15px; font-weight:bold; display:none; padding:2px 8px; border-radius:6px; background:#FFF9E5; border:1px solid #FFE69C;"></span>
            </div>
            
            <div style="display:flex; flex-direction:column; gap: 8px; width: 100%;">
                <input type="number" id="ev-custom-price-mixed" class="form-control" placeholder="ระบุยอดเงิน (บาท)" style="width:100%; font-size:15px; border-color:#D4AF37; text-align:center; padding:8px;" />
                <div style="display:flex; gap: 8px; width: 100%;">
                    <button class="btn-primary" style="flex:2; background:#D4AF37; border:none; padding:10px; font-size:15px; border-radius:8px; font-weight:bold;" onclick="addEventItemCustom('คละขนมรวมทุกอย่าง', '🎁', 'mixed')">➕ เพิ่มยอด</button>
                    <button class="btn-outline" style="flex:1; padding:10px; font-size:15px; color:var(--danger); border-color:#FFBBBB; background:#FFF0F0; border-radius:8px;" onclick="clearEventItem('คละขนมรวมทุกอย่าง', 'mixed')">ล้าง</button>
                </div>
            </div>
        </div>`;

        const eventProducts = allProductsData.filter(p => (p.category || 'normal') === 'event');
        eventHtml += eventProducts.map((p, index) => `
            <div class="menu-item" style="display:flex; flex-direction:column; align-items:flex-start; padding: 15px; border: 1.5px solid #FFE69C; border-radius: 12px; background: #fff;">
                <div style="font-weight:bold; font-size: 15px; margin-bottom: 12px; display:flex; justify-content:space-between; width:100%;">
                    <span>${p.emoji} ${p.name}</span>
                    <span id="ev-amt-${index}" style="color:#B8860B; font-size:14px; font-weight:bold; display:none; padding:2px 8px; border-radius:6px; background:#FFF9E5;"></span>
                </div>
                
                <div style="display:flex; flex-direction:column; gap: 8px; width: 100%;">
                    <input type="number" id="ev-custom-price-${index}" class="form-control" placeholder="ระบุยอดเงิน (บาท)" style="width:100%; font-size:14px; border-color:#FFE69C; text-align:center; padding:8px;" />
                    <div style="display:flex; gap: 6px; width: 100%;">
                        <button class="btn-primary" style="flex:2; background:#B8860B; border:none; padding:8px; font-size:14px; border-radius:6px; font-weight:bold;" onclick="addEventItemCustom('${safeStr(p.name)}', '${p.emoji}', '${index}')">➕ เพิ่มยอด</button>
                        <button class="btn-outline" style="flex:1; padding:8px; font-size:14px; color:var(--danger); border-color:#FFBBBB; background:#FFF0F0; border-radius:6px;" onclick="clearEventItem('${safeStr(p.name)}', '${index}')">ล้าง</button>
                    </div>
                </div>
            </div>
        `).join('');
        eventContainer.innerHTML = eventHtml;
    }
}
function addEventItemCustom(name, emoji, index) {
    const inputEl = document.getElementById(`ev-custom-price-${index}`);
    if (!inputEl) return;
    
    const amount = Number(inputEl.value);
    if (amount <= 0) return showToast('กรุณาพิมพ์ยอดเงินก่อนกดเพิ่มครับ', 'error');
    
    if (!eventItems[name]) { eventItems[name] = { amount: 0, emoji: emoji, index: index }; }
    eventItems[name].amount += amount;
    
    inputEl.value = ''; 
    updateEventUI();
}

function addEventItem(name, amount, emoji, index) {
    if (!eventItems[name]) { eventItems[name] = { amount: 0, emoji: emoji, index: index }; }
    eventItems[name].amount += Number(amount) || 0;
    updateEventUI();
}

function updateEventUI() {
    let total = 0;
    let summaryHtml = '';
    
    document.querySelectorAll('[id^="ev-amt-"]').forEach(el => { 
        el.style.display = 'none'; 
        el.innerText = ''; 
    });

    for (let name in eventItems) {
        const item = eventItems[name];
        const displayAmt = Number(item.amount) || 0;
        total += displayAmt;

        summaryHtml += `
        <div style="display:flex; justify-content:space-between; font-size:15px; color:var(--text); margin-bottom:6px; border-bottom:1px dashed #FFE69C; padding-bottom:4px;">
            <span style="font-weight:bold;">${item.emoji} ${name}</span>
            <span style="font-weight:bold; color:#B8860B;">฿${displayAmt.toLocaleString()}</span>
        </div>`;
        
        const lbl = document.getElementById(`ev-amt-${item.index}`);
        if (lbl) {
            lbl.style.display = 'inline-block';
            lbl.innerText = `฿${displayAmt.toLocaleString()}`; 
        }
    }
    
    const summaryContainer = document.getElementById('eventSummaryList');
    if (summaryContainer) {
        summaryContainer.innerHTML = summaryHtml || '<div style="color:var(--text3); font-size:13px; text-align:center; padding:10px 0;">ยังไม่ได้เลือกรายการ</div>';
    }
    
    const totalInput = document.getElementById('evTotal');
    if (totalInput) {
        totalInput.value = total > 0 ? total : '';
    }
}

function setProductFilter(type) { currentProdFilter = type; document.getElementById('tabProdNormal').classList.toggle('active', type === 'normal'); document.getElementById('tabProdEvent').classList.toggle('active', type === 'event'); const tabConsign = document.getElementById('tabProdConsign'); if(tabConsign) tabConsign.classList.toggle('active', type === 'consignment'); renderProducts(); }
function renderProducts() {
  const filtered = allProductsData.filter(p => (p.category || 'normal') === currentProdFilter);
  if(filtered.length === 0) { document.getElementById('productList').innerHTML = '<div style="grid-column: span 3; text-align:center; padding:30px; color:var(--text3); background:var(--surface2); border-radius:12px;">📭 ยังไม่มีเมนูในหมวดหมู่นี้</div>'; return; }
  document.getElementById('productList').innerHTML = filtered.map(p => `<div class="stat-box"><div style="position:absolute; top:10px; right:10px; display:flex; gap:8px;"><button style="background:none; border:none; cursor:pointer; font-size:16px;" onclick="openEditModal(${p.id}, '${safeStr(p.name)}', ${p.price}, '${p.emoji}', '${p.category || 'normal'}')" title="แก้ไข">✏️</button><button style="background:none; border:none; cursor:pointer; font-size:16px;" onclick="openDeleteModal('products', ${p.id})" title="ลบ">🗑️</button></div><div style="font-size:40px; margin-bottom:10px;">${p.emoji}</div><div style="font-weight:bold; font-size:16px">${p.name}</div><div style="color:var(--text2); font-size:14px; margin-top:5px;">฿${p.price}</div></div>`).join('');
}
function setFinanceHistoryFilter(filter, btnElement) { currentFinanceFilter = filter; document.querySelectorAll('.fin-tab').forEach(t => t.classList.remove('active')); btnElement.classList.add('active'); filterFinance(); }
function filterFinance() {
    const searchTerm = document.getElementById('searchFinanceInput').value.toLowerCase().trim();
    const filtered = combinedFinanceData.filter(f => { if (currentFinanceFilter === 'income' && f.type !== 'income') return false; if (currentFinanceFilter === 'expense' && f.type !== 'expense') return false; if (!searchTerm) return true; const thaiDate = formatThaiDate(getLocalDateString(f.created_at)); const typeThai = f.type === 'income' ? 'รายรับ' : 'รายจ่าย'; const searchableString = `${f.note} ${f.amount} ${thaiDate} ${typeThai}`.toLowerCase(); return searchTerm.split(' ').filter(term => term.trim() !== '').every(term => searchableString.includes(term)); });
    renderFinance(filtered);
}
function renderFinance(data) {
    const isAdmin = currentUser && currentUser.role === 'admin'; const listContainer = document.getElementById('financeList'); const summaryContainer = document.getElementById('financeFilterSummary'); let sumInc = 0, sumExp = 0;
    if (data.length === 0) { listContainer.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text3); font-weight:bold; background:var(--surface2); border-radius:12px;">📭 ไม่พบประวัติการเงินตามที่ค้นหา</div>'; summaryContainer.innerHTML = `<span style="color:var(--success)">รายรับ: ฿0</span> | <span style="color:var(--danger)">รายจ่าย: ฿0</span> | <span style="color:var(--primary-dark)">สุทธิ: ฿0</span>`; return; }
    listContainer.innerHTML = data.map(f => {
        if (f.type === 'income') sumInc += f.amount; else sumExp += f.amount;
        const thaiDate = formatThaiDate(getLocalDateString(f.created_at)); const delBtn = (isAdmin && f.is_manual) ? `<button style="background:none; border:none; cursor:pointer; font-size:16px;" onclick="openDeleteModal('finance', ${f.id})" title="ลบ">🗑️</button>` : '';
        let cardStyle = f.is_manual ? 'border: 1px solid var(--border);' : 'border: 1px solid var(--border); border-left: 4px solid var(--primary); background: #FFFdfa;'; let autoNote = f.is_manual ? '' : `<span style="color:var(--primary); font-weight:bold; font-size:11px; margin-left:8px; padding:2px 6px; background:#FFE8D6; border-radius:4px;">*รายรับอัตโนมัติ</span>`;
        return `<div class="card" style="padding:15px; margin-bottom:12px; ${cardStyle}"><div style="display:flex; justify-content:space-between; margin-bottom: 8px;"><span style="font-weight:bold; font-size:15px;">${f.note}</span><div style="display:flex; align-items:center; gap:10px;"><span style="font-weight:bold; font-size:15px; color:var(--${f.type==='income'?'success':'danger'})">${f.type==='income'?'+':'-'}฿${f.amount.toLocaleString()}</span>${delBtn}</div></div><div style="font-size:12px; color:var(--text3); margin-bottom: ${f.slip_image ? '10px' : '0'};">📅 ${thaiDate} ${autoNote}</div>${f.slip_image ? `<div style="border-top: 1px dashed var(--border); padding-top: 10px; display:flex; align-items:center; gap:10px;"><img src="${f.slip_image}" style="width:40px; height:40px; object-fit:cover; border-radius:6px; cursor:pointer; border:1px solid #ddd;" onclick="viewImage('${f.slip_image}')" /><button style="background:#fff; color:var(--primary); border:1px solid var(--primary); border-radius:6px; padding:5px 10px; font-size:13px; font-family:'Sarabun'; cursor:pointer;" onclick="viewImage('${f.slip_image}')">🔍 กดดูสลิป</button></div>` : ''}</div>`;
    }).join('');
    summaryContainer.innerHTML = `<span style="color:var(--success)">รายรับ: ฿${sumInc.toLocaleString()}</span> | <span style="color:var(--danger)">รายจ่าย: ฿${sumExp.toLocaleString()}</span> | <span style="color:var(--primary-dark)">สุทธิ: ฿${(sumInc - sumExp).toLocaleString()}</span>`;
}
function filterConsignOrders() {
  const searchTerm = document.getElementById('searchConsignInput').value.toLowerCase().trim(); const todayStr = getLocalDateString(new Date());
  const filtered = allOrdersData.filter(o => {
    const isConsign = o.customer_name.includes('[ฝากขาย]'); if (!isConsign) return false;
    let currentStatus = ['pending', 'consigned', 'completed', 'cancelled'].includes(o.status) ? o.status : 'consigned'; if (currentStatus === 'pending') currentStatus = 'consigned';
    let matchesTab = true; if (currentConsignFilter === 'pending') matchesTab = (currentStatus === 'consigned'); else if (currentConsignFilter === 'completed') matchesTab = (currentStatus === 'completed'); else if (currentConsignFilter === 'cancelled') matchesTab = (currentStatus === 'cancelled'); else if (currentConsignFilter === 'today') matchesTab = (getValidOrderDate(o) === todayStr);
    if (!matchesTab) return false; if (!searchTerm) return true;
    const thaiDate = formatThaiDate(getValidOrderDate(o)); let itemsText = ''; if (o.items) { try { itemsText = JSON.parse(o.items).map(i => i.name).join(' '); } catch(e) {} }
    const orderIdStr = o.id.toString().padStart(5, '0'); const searchableString = `#${orderIdStr} ${orderIdStr} ${o.customer_name} ${thaiDate} ${itemsText}`.toLowerCase(); return searchTerm.split(' ').every(term => searchableString.includes(term));
  });
  renderConsignOrders(filtered);
}
function setOrderTypeFilter(type) {
  currentOrderTypeFilter = type; document.getElementById('tabOrderTypeAll').classList.toggle('active', type === 'all'); document.getElementById('tabOrderTypeNormal').classList.toggle('active', type === 'normal'); document.getElementById('tabOrderTypeEvent').classList.toggle('active', type === 'event');
  if(type === 'event') { document.getElementById('tabOrderTypeEvent').style.background = '#D4AF37'; document.getElementById('tabOrderTypeEvent').style.color = '#FFF'; } else { document.getElementById('tabOrderTypeEvent').style.background = 'none'; document.getElementById('tabOrderTypeEvent').style.color = '#B8860B'; } filterOrders();
}
function setOrderFilter(filterType, btnElement) { currentOrderFilter = filterType; document.querySelectorAll('#page-orders .order-tab').forEach(t => t.classList.remove('active')); btnElement.classList.add('active'); filterOrders(); }
function generatePaginationHTML(currentPage, totalPages, prefix, colorVar) {
    if (totalPages <= 1) return '';
    const btnStyle = `padding:6px 12px; border:1px solid var(--border); border-radius:8px; background:#fff; color:var(--text2); font-weight:bold; cursor:pointer; font-family:'Prompt'; transition:0.2s;`;
    const disabledStyle = `opacity:0.4; cursor:not-allowed;`; const activeStyle = `background:var(${colorVar}); color:#fff; border-color:var(${colorVar});`;
    return `<div style="display:flex; flex-direction:column; align-items:center; gap:15px; margin-top:20px; padding-bottom:20px; border-top: 1px dashed var(--border); padding-top: 20px;"><div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:center;"><button style="${btnStyle} ${currentPage === 1 ? disabledStyle : ''}" onclick="if(${currentPage} > 1) change${prefix}Page(1)" ${currentPage === 1 ? 'disabled' : ''}>« หน้าแรก</button><button style="${btnStyle} ${currentPage === 1 ? disabledStyle : ''}" onclick="if(${currentPage} > 1) change${prefix}Page(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹ ก่อนหน้า</button><div style="padding:6px 15px; border-radius:8px; font-family:'Prompt'; font-weight:bold; ${activeStyle}">หน้า ${currentPage} / ${totalPages}</div><button style="${btnStyle} ${currentPage === totalPages ? disabledStyle : ''}" onclick="if(${currentPage} < ${totalPages}) change${prefix}Page(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>ถัดไป ›</button><button style="${btnStyle} ${currentPage === totalPages ? disabledStyle : ''}" onclick="if(${currentPage} < ${totalPages}) change${prefix}Page(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>สุดท้าย »</button></div><div style="display:flex; align-items:center; gap:8px; font-family:'Prompt'; font-size:14px; color:var(--text2);">ไปที่หน้า: <input type="number" id="jump${prefix}Input" style="width:60px; padding:6px; border:1.5px solid var(--border); border-radius:8px; text-align:center; font-family:'Prompt';" min="1" max="${totalPages}" value="${currentPage}" onkeypress="if(event.key === 'Enter') jumpTo${prefix}Page()"><button style="padding:6px 12px; background:#fff; border:1.5px solid var(${colorVar}); color:var(${colorVar}); border-radius:8px; font-weight:bold; font-family:'Prompt'; cursor:pointer;" onclick="jumpTo${prefix}Page()">ไป 🚀</button></div></div>`;
}
function jumpToOrderPage() { const input = document.getElementById('jumpOrderInput'); if (!input) return; let page = parseInt(input.value); const totalPages = Math.ceil(savedOrdersToRender.length / ORDERS_PER_PAGE); if (isNaN(page) || page < 1) page = 1; if (page > totalPages) page = totalPages; changeOrderPage(page); }
function jumpToConsignPage() { const input = document.getElementById('jumpConsignInput'); if (!input) return; let page = parseInt(input.value); const totalPages = Math.ceil(savedConsignToRender.length / ORDERS_PER_PAGE); if (isNaN(page) || page < 1) page = 1; if (page > totalPages) page = totalPages; changeConsignPage(page); }
function renderOrders(ordersToRender) { savedOrdersToRender = ordersToRender; const maxPage = Math.ceil(savedOrdersToRender.length / ORDERS_PER_PAGE) || 1; if (currentOrderPage > maxPage) currentOrderPage = maxPage; renderOrderPageHTML(); }
function changeOrderPage(page) { currentOrderPage = page; renderOrderPageHTML(); const pg = document.getElementById('page-orders'); if (pg) pg.scrollIntoView({ behavior: 'smooth' }); }
function renderOrderPageHTML() {
  const isAdmin = currentUser && currentUser.role === 'admin'; const orderContainer = document.getElementById('orderList'); if (!orderContainer) return;
  if (savedOrdersToRender.length === 0) { orderContainer.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text3); font-weight:bold; background:var(--surface2); border-radius:12px;">📭 ไม่มีออเดอร์ในหมวดหมู่นี้ หรือไม่พบคำค้นหา</div>'; return; }
  const startIndex = (currentOrderPage - 1) * ORDERS_PER_PAGE; const endIndex = startIndex + ORDERS_PER_PAGE; const paginatedOrders = savedOrdersToRender.slice(startIndex, endIndex);
  let html = paginatedOrders.map(o => {
    const thaiDate = formatThaiDate(getValidOrderDate(o));
    const delBtn = isAdmin ? `<button style="background:none; border:none; cursor:pointer; font-size:16px;" onclick="openDeleteModal('orders', ${o.id})" title="ลบ">🗑️</button>` : '';
    let rawName = o.customer_name || ''; let isOnline = rawName.includes('(ออนไลน์)'); let isEvent = rawName.includes('[จัดเลี้ยง'); let payMethodTag = '';
    if (rawName.includes('[พร้อมเพย์]')) { payMethodTag = '🏦 พร้อมเพย์'; rawName = rawName.replace(/\[พร้อมเพย์\]/g, ''); } else if (rawName.includes('[TrueWallet]')) { payMethodTag = '📱 TrueWallet'; rawName = rawName.replace(/\[TrueWallet\]/g, ''); } else if (rawName.includes('ปลายทาง')) { payMethodTag = '💵 เก็บเงินปลายทาง'; rawName = rawName.replace(/\[เก็บปลายทาง\]|\[เก็บเงินปลายทาง\]|\(เก็บเงินปลายทาง\)|เก็บเงินปลายทาง|เก็บปลายทาง/g, ''); }
    rawName = rawName.replace('(ออนไลน์)', '').trim(); if(isEvent) rawName = rawName.replace(/\[จัดเลี้ยง:.*?\]/g, '').trim();
    let processBadge = ''; let actionButtons = ''; let currentStatus = 'completed';
    if(isOnline || isEvent) {
      currentStatus = ['pending', 'cooking', 'completed', 'cancelled'].includes(o.status) ? o.status : 'pending';
      if(currentStatus === 'pending') { processBadge = `<span style="background:#FFF0F0; color:var(--danger); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #FFBBBB;">🟡 รอยืนยัน</span>`; actionButtons = `<div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px; display: flex; gap: 10px;"><button class="btn-status btn-confirm" style="flex: 2;" onclick="updateOrderStatus(${o.id}, 'cooking')">✅ ยืนยันสลิป & กำลังทำ</button><button class="btn-status" style="background: #FFF0F0; color: var(--danger); border: 1px solid #FFBBBB; flex: 1;" onclick="rejectOrder(${o.id})">❌ ยกเลิก</button></div>`; } 
      else if (currentStatus === 'cooking') { processBadge = `<span style="background:#FFF8E8; color:#B8860B; padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #FFCF60;">🍳 กำลังทำ</span>`; actionButtons = `<div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px;"><button class="btn-status btn-cook" onclick="updateOrderStatus(${o.id}, 'completed')">🛎️ เสร็จแล้ว / เรียกรับของ</button></div>`; } 
      else if (currentStatus === 'completed') { processBadge = `<span style="background:#E8F5EE; color:var(--success); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #A8DDB8;">✅ เสร็จแล้ว</span>`; actionButtons = `<div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px; text-align:center; color: var(--success); font-weight: bold; font-size: 14px;">🎉 ออเดอร์เสร็จสมบูรณ์</div>`; } 
      else if (currentStatus === 'cancelled') { processBadge = `<span style="background:#f8f9fa; color:var(--text3); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #ccc;">❌ ยกเลิกแล้ว</span>`; actionButtons = `<div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px; text-align:center; color: var(--danger); font-weight: bold; font-size: 14px;">❌ ออเดอร์นี้ถูกยกเลิกแล้ว</div>`; }
    } else { processBadge = `<span style="background:#E8F5EE; color:var(--success); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #A8DDB8;">✅ เสร็จแล้ว</span>`; }
    const total = Number(o.total_amount); const paid = Number(o.paid_amount || 0); let typeBadge = ''; let calendarBtn = ''; let cardStyle = 'padding:15px; margin-bottom:12px; border: 1px solid var(--border);';
    if (isEvent) { typeBadge = `<span style="background:#FFF3CD; color:#B8860B; padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #FFE69C; font-weight:bold;">🎁 จัดเลี้ยง</span>`; cardStyle = 'padding:15px; margin-bottom:12px; border: 2px solid #D4AF37; background: #FFFAF0;'; let eventDateForCal = o.order_date ? o.order_date.split('T')[0] : ''; if(o.items) { try { let pItems = JSON.parse(o.items); let dItem = pItems.find(i => i.name.includes('เวลารับ')); if(dItem) eventDateForCal = dItem.name.replace('📅 เวลารับ:', '').trim(); } catch(e) {} } calendarBtn = `<button style="background:#FFFDF0; border:1px solid #D4AF37; color:#B8860B; padding:3px 8px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;" onclick="addToCalendar('${safeStr(rawName)}', ${total}, ${paid}, '${eventDateForCal}')">📅 ลงปฏิทิน</button>`; } 
    else if (isOnline) { typeBadge = `<span style="background:#E5F0FF; color:#0056b3; padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #B8D4FF; font-weight:bold;">📱 ออนไลน์</span>`; } 
    else { typeBadge = `<span style="background:#F5F5F5; color:#666; padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #ddd; font-weight:bold;">🏪 หน้าร้าน</span>`; }
    let moneyBadge = ''; let remainingText = '';
    if (paid === 0) { if (payMethodTag === '💵 เก็บเงินปลายทาง') { moneyBadge = `<span style="background:#FFF0F0; color:var(--danger); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #FFBBBB;">🔴 เก็บเงินปลายทาง</span>`; remainingText = `<div style="color: var(--danger); font-size: 13px; font-weight: bold; margin-top: 4px;">⚠️ รอเก็บเงินสด: ฿${total.toLocaleString()}</div>`; } else { moneyBadge = `<span style="background:#FFF0F0; color:var(--danger); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #FFBBBB;">🔴 รอจ่ายเงิน</span>`; remainingText = `<div style="color: var(--danger); font-size: 13px; font-weight: bold; margin-top: 4px;">⚠️ เหลือต้องจ่ายอีก: ฿${total.toLocaleString()}</div>`; } } 
    else if (paid === total) { moneyBadge = `<span style="background:#E8F5EE; color:var(--success); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #A8DDB8;">🟢 จ่ายครบแล้ว</span>`; remainingText = `<div style="color: var(--success); font-size: 13px; font-weight: bold; margin-top: 4px;">✅ จ่ายครบแล้วพอดี</div>`; } 
    else if (paid < total) { moneyBadge = `<span style="background:#FFF8E8; color:#B8860B; padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #FFCF60;">🟠 จ่ายขาด</span>`; remainingText = `<div style="color: #B8860B; font-size: 13px; font-weight: bold; margin-top: 4px;">⚠️ เหลือต้องจ่ายอีก: ฿${(total - paid).toLocaleString()}</div>`; } 
    else { moneyBadge = `<span style="background:#E5F0FF; color:#0056b3; padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #B8D4FF;">🔵 จ่ายเกิน</span>`; remainingText = `<div style="color: #0056b3; font-size: 13px; font-weight: bold; margin-top: 4px;">💸 ต้องทอนเงิน: ฿${(paid - total).toLocaleString()}</div>`; }
    let itemsHtml = ''; if(o.items) { try { const parsedItems = JSON.parse(o.items); if(parsedItems.length > 0) { itemsHtml = `<div style="background:var(--surface); padding:10px; border-radius:8px; margin-bottom:10px; border: 1px solid var(--border);"><div style="font-size:12px; color:var(--text3); margin-bottom:5px;">รายการที่สั่ง:</div>${parsedItems.map(i => `<div style="font-size:14px; color:var(--text2); display:flex; justify-content:space-between; margin-bottom:3px;"><span>- ${i.name}</span><span>฿${Number(i.price || 0).toLocaleString()}</span></div>`).join('')}</div>`; } } catch(e) {} }
    let displayTotalHtml = `฿${Number(o.total_amount).toLocaleString()}<div style="font-size:11px; font-weight:normal; color:var(--text2);">โอนมา: ฿${Number(o.paid_amount || 0).toLocaleString()}</div>`; const orderIdStr = `#${o.id.toString().padStart(5, '0')}`;
    return `<div class="card" style="${cardStyle}"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><div style="font-size:13px; color:var(--primary); font-weight:bold;">📅 ${thaiDate}</div><div style="display:flex; gap:8px;"><button style="background:#fff; border:1px solid var(--text2); color:var(--text2); cursor:pointer; font-size:13px; padding:3px 8px; border-radius:6px; font-weight:bold; font-family:'Prompt';" onclick="openEditOrderInfoModal(${o.id}, '${safeStr(rawName)}')">✏️ แก้ไข</button><button style="background:#fff; border:1px solid var(--primary); color:var(--primary); cursor:pointer; font-size:13px; padding:3px 8px; border-radius:6px; font-weight:bold; font-family:'Prompt';" onclick="openReceiptModal(${o.id})">📄 ดูบิล</button>${delBtn}</div></div><div style="margin-bottom: 12px;"><div style="font-weight:bold; font-size:16px; color:var(--text); margin-bottom:6px; word-break: break-word;"><span style="color:var(--primary); font-size:14px; margin-right:5px;">${orderIdStr}</span>👤 ${rawName}</div><div style="display:flex; flex-wrap: wrap; gap: 6px; align-items: center;">${typeBadge} ${calendarBtn} ${processBadge} ${payMethodTag ? `<span style="background:#F0F0F0; color:var(--text2); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #DDD;">${payMethodTag}</span>` : ''} ${moneyBadge}</div></div>${itemsHtml}<div style="border-top: 1px dashed var(--border); padding-top: 10px; display:flex; justify-content:space-between; align-items:flex-start;"><div><div style="font-weight:bold; font-size: 14px; color:var(--text);">ยอดบิล: ฿${total.toLocaleString()} <span style="color:var(--text3); font-weight:normal; font-size:12px;">(โอนมา ฿${paid.toLocaleString()})</span></div>${remainingText}</div><div style="text-align:right;">${displayTotalHtml} ${o.slip_image ? `<button style="background:#fff; color:var(--primary); border:1px solid var(--primary); border-radius:6px; padding:6px 12px; font-size:13px; font-family:'Sarabun'; font-weight:bold; cursor:pointer; height:fit-content; margin-top:5px;" onclick="viewImage('${o.slip_image}')">🔍 ดูสลิป</button>` : ``}</div></div>${actionButtons}</div>`;
  }).join('');
  const totalPages = Math.ceil(savedOrdersToRender.length / ORDERS_PER_PAGE); html += generatePaginationHTML(currentOrderPage, totalPages, 'Order', '--primary');
  orderContainer.innerHTML = html;
}
function renderConsignOrders(ordersToRender) { savedConsignToRender = ordersToRender; const maxPage = Math.ceil(savedConsignToRender.length / ORDERS_PER_PAGE) || 1; if (currentConsignPage > maxPage) currentConsignPage = maxPage; renderConsignPageHTML(); }
function changeConsignPage(page) { currentConsignPage = page; renderConsignPageHTML(); const pg = document.getElementById('page-consignment'); if (pg) pg.scrollIntoView({ behavior: 'smooth' }); }
function renderConsignPageHTML() {
  const isAdmin = currentUser && currentUser.role === 'admin'; const orderContainer = document.getElementById('consignList'); if (!orderContainer) return;
  if (savedConsignToRender.length === 0) { orderContainer.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text3); font-weight:bold; background:var(--surface2); border-radius:12px;">📭 ไม่พบประวัติฝากขายในหมวดหมู่นี้</div>'; return; }
  const startIndex = (currentConsignPage - 1) * ORDERS_PER_PAGE; const endIndex = startIndex + ORDERS_PER_PAGE; const paginatedOrders = savedConsignToRender.slice(startIndex, endIndex);
  let html = paginatedOrders.map(o => {
    const thaiDate = formatThaiDate(getValidOrderDate(o)); const delBtn = isAdmin ? `<button style="background:none; border:none; cursor:pointer; font-size:16px;" onclick="openDeleteModal('orders', ${o.id})" title="ลบ">🗑️</button>` : '';
    let rawName = o.customer_name.replace(/\[ฝากขาย\]/g, '').trim(); let currentStatus = ['pending', 'consigned', 'completed', 'cancelled'].includes(o.status) ? o.status : 'consigned'; if (currentStatus === 'pending') currentStatus = 'consigned';
    let processBadge = ''; let actionButtons = '';
    if(currentStatus === 'consigned') { processBadge = `<span style="background:#F3E5F5; color:var(--consignment); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #CE93D8;">📦 รอเก็บเงินเย็น</span>`; actionButtons = `<div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px; display: flex; gap: 10px;"><button class="btn-status btn-consignment" style="flex: 2;" onclick="openConsignClearModal(${o.id}, '${safeStr(rawName)}', ${o.total_amount})">📦 เช็คยอด & เก็บเงิน</button><button class="btn-status" style="background: #FFF0F0; color: var(--danger); border: 1px solid #FFBBBB; flex: 1;" onclick="rejectOrder(${o.id})">❌ ยกเลิก</button></div>`; } 
    else if (currentStatus === 'completed') { processBadge = `<span style="background:#E8F5EE; color:var(--success); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #A8DDB8;">✅ เก็บเงินแล้ว</span>`; actionButtons = `<div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px; text-align:center; color: var(--success); font-weight: bold; font-size: 14px;">🎉 เคลียร์บิลร้านค้าเรียบร้อย</div>`; } 
    else if (currentStatus === 'cancelled') { processBadge = `<span style="background:#f8f9fa; color:var(--text3); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #ccc;">❌ ยกเลิกแล้ว</span>`; actionButtons = `<div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px; text-align:center; color: var(--danger); font-weight: bold; font-size: 14px;">❌ บิลถูกยกเลิกแล้ว</div>`; }
    let itemsHtml = ''; if(o.items) { try { const parsedItems = JSON.parse(o.items); if(parsedItems.length > 0) { itemsHtml = `<div style="background:#FAFAFA; padding:10px; border-radius:8px; margin-bottom:10px; border: 1px solid var(--border);"><div style="font-size:12px; color:var(--text3); margin-bottom:5px;">รายการของที่ไปส่ง:</div>${parsedItems.map(i => { let qtyText = i.qty ? `${i.name} (${i.qty} ถุง)` : i.name; let returnText = ''; if (i.returnQty && i.returnQty > 0) { returnText = `<br><span style="color:var(--danger); font-size:12px; padding-left:10px;">↳ หักคืน: ${i.returnQty} ถุง (-฿${(Number(i.returnQty) * Number(i.price)).toLocaleString()})</span>`; } return `<div style="font-size:14px; color:var(--text2); display:flex; flex-direction:column; margin-bottom:3px;"><div style="display:flex; justify-content:space-between;"><span>- ${qtyText}</span><span>฿${(Number(i.qty || 0) * Number(i.price || 0)).toLocaleString()}</span></div>${returnText}</div>`; }).join('')}</div>`; } } catch(e) {} }
    let displayTotalHtml = ''; if (currentStatus === 'completed') { displayTotalHtml = `<div style="color:var(--text2); font-size:12px; margin-bottom:2px;">ยอดเก็บได้จริง:</div><div style="color:var(--success); font-weight:bold; font-size:20px;">฿${Number(o.paid_amount || 0).toLocaleString()}</div><div style="font-size:11px; color:var(--text3);">(เช็คยอดเงินที่หน้าการเงิน)</div>`; } else { displayTotalHtml = `<div style="color:var(--consignment); font-weight:bold; font-size:14px;">⏳ รอสรุปยอดเงิน</div>`; }
    const orderIdStr = `#${o.id.toString().padStart(5, '0')}`;
    return `<div class="card" style="padding:15px; margin-bottom:12px; border: 2px solid var(--consignment); background: #fff;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><div style="font-size:13px; color:var(--primary); font-weight:bold;">📅 ${thaiDate}</div><div style="display:flex; gap:8px;"><button style="background:#fff; border:1px solid var(--text2); color:var(--text2); cursor:pointer; font-size:13px; padding:3px 8px; border-radius:6px; font-weight:bold; font-family:'Prompt';" onclick="openEditOrderInfoModal(${o.id}, '${safeStr(rawName)}')">✏️ แก้ไข</button><button style="background:#fff; border:1px solid var(--consignment); color:var(--consignment); cursor:pointer; font-size:13px; padding:3px 8px; border-radius:6px; font-weight:bold; font-family:'Prompt';" onclick="openReceiptModal(${o.id})">📄 ดูบิล</button>${delBtn}</div></div><div style="margin-bottom: 12px;"><div style="font-weight:bold; font-size:16px; color:var(--consignment); margin-bottom:6px; word-break: break-word;"><span style="color:var(--consignment); font-size:14px; margin-right:5px;">${orderIdStr}</span>🏬 ${rawName}</div><div style="display:flex; flex-wrap: wrap; gap: 6px; align-items: center;">${processBadge}</div></div>${itemsHtml}<div style="border-top: 1px dashed var(--consignment); padding-top: 10px; display:flex; justify-content:space-between; align-items:flex-end;"><div style="font-weight:bold; font-size: 14px; color:var(--text);">ยอดที่ส่งไป (มูลค่า): ฿${Number(o.total_amount).toLocaleString()}</div><div style="text-align:right;">${displayTotalHtml}</div></div>${actionButtons}</div>`;
  }).join('');
  const totalPages = Math.ceil(savedConsignToRender.length / ORDERS_PER_PAGE); html += generatePaginationHTML(currentConsignPage, totalPages, 'Consign', '--consignment');
  orderContainer.innerHTML = html;
}
async function loadAllData() {
  try {
    const isAdmin = currentUser && currentUser.role === 'admin'; const [finRes, prodRes, ordRes] = await Promise.all([ fetch(`${API_URL}/finance`, { cache: 'no-store' }), fetch(`${API_URL}/products`, { cache: 'no-store' }), fetch(`${API_URL}/orders`, { cache: 'no-store' }) ]);
    let finances = await finRes.json(); let products = await prodRes.json(); allOrdersData = await ordRes.json();
    finances.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    allOrdersData.sort((a, b) => { let dateA = new Date(getValidOrderDate(a)).getTime(); let dateB = new Date(getValidOrderDate(b)).getTime(); if (dateA !== dateB) return dateB - dateA; let timeA = new Date(a.created_at || 0).getTime(); let timeB = new Date(b.created_at || 0).getTime(); if (timeA !== timeB) return timeB - timeA; return b.id - a.id; });
    allProductsData = products; if (!isProductsRendered) { renderOrderProductSelection(); renderProducts(); isProductsRendered = true; }
    let orderInc = 0; allOrdersData.forEach(o => { if (Number(o.paid_amount) > 0 && o.status !== 'cancelled' && !o.customer_name.includes('[ฝากขาย]')) orderInc += Number(o.paid_amount); });
    let manualInc = 0, exp = 0; finances.forEach(f => { if(f.type === 'income') manualInc += Number(f.amount); else exp += Number(f.amount); });
    const totalInc = manualInc + orderInc; combinedFinanceData = [];
    finances.forEach(f => { combinedFinanceData.push({ id: f.id, type: f.type, note: f.note, amount: Number(f.amount), slip_image: f.slip_image, created_at: f.created_at, is_manual: true }); });
    allOrdersData.forEach(o => { if (Number(o.paid_amount) > 0 && o.status !== 'cancelled' && !o.customer_name.includes('[ฝากขาย]')) { combinedFinanceData.push({ id: o.id, type: 'income', note: `🛒 ขายสินค้า (ลูกค้า: ${o.customer_name})`, amount: Number(o.paid_amount), slip_image: o.slip_image, created_at: o.order_date || o.created_at, is_manual: false }); } });
    combinedFinanceData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); filterFinance(); 
    const todayObj = new Date(); const todayStr = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0');
    const thirtyDaysAgoObj = new Date(); thirtyDaysAgoObj.setDate(thirtyDaysAgoObj.getDate() - 30); const thirtyDaysAgoStr = thirtyDaysAgoObj.getFullYear() + '-' + String(thirtyDaysAgoObj.getMonth() + 1).padStart(2, '0') + '-' + String(thirtyDaysAgoObj.getDate()).padStart(2, '0');
    let incToday = 0, expToday = 0; let incMonth = 0, expMonth = 0; pendingCount = 0;
    finances.forEach(f => { let fDate = getLocalDateString(f.created_at); if(fDate === todayStr) { if(f.type === 'expense') expToday += Number(f.amount); else if(f.type === 'income') incToday += Number(f.amount); } if (fDate >= thirtyDaysAgoStr && fDate <= todayStr) { if(f.type === 'expense') expMonth += Number(f.amount); else if(f.type === 'income') incMonth += Number(f.amount); } });
    let last7DaysSales = {}; let itemSalesCount = {};
    allOrdersData.forEach(o => {
      const isOnline = o.customer_name.includes('(ออนไลน์)'); const isEvent = o.customer_name.includes('[จัดเลี้ยง'); const isConsign = o.customer_name.includes('[ฝากขาย]');
      if((isOnline || isEvent) && o.status === 'pending') pendingCount++; let canCountAsSales = false;
      if (o.status !== 'cancelled' && Number(o.paid_amount) > 0) { if (isConsign) { if (o.status === 'completed') canCountAsSales = true; } else { canCountAsSales = true; } }
      if(canCountAsSales) {
        let oDate = getValidOrderDate(o); if(oDate === todayStr) incToday += Number(o.paid_amount); if(oDate >= thirtyDaysAgoStr && oDate <= todayStr) incMonth += Number(o.paid_amount); if(oDate) last7DaysSales[oDate] = (last7DaysSales[oDate] || 0) + Number(o.paid_amount);
        if(o.items) { try { let items = JSON.parse(o.items); items.forEach(item => { let cleanName = item.name.replace(/🎁 \[จัดเลี้ยง\] |🍌 |🍠 |🥚 /g, '').trim(); if(!cleanName.includes('เวลารับ') && !cleanName.includes('ชุดละ') && !cleanName.includes('คละขนม')) { itemSalesCount[cleanName] = (itemSalesCount[cleanName] || 0) + Number(item.price); } }); } catch(e) {} }
      }
    });
    document.getElementById('dashIncToday').innerText = `฿${incToday.toLocaleString()}`; document.getElementById('dashExpToday').innerText = `฿${expToday.toLocaleString()}`; document.getElementById('dashProfitToday').innerText = `฿${(incToday - expToday).toLocaleString()}`; document.getElementById('dashIncMonth').innerText = `฿${incMonth.toLocaleString()}`; document.getElementById('dashExpMonth').innerText = `฿${expMonth.toLocaleString()}`; document.getElementById('dashProfitMonth').innerText = `฿${(incMonth - expMonth).toLocaleString()}`; document.getElementById('sumInc').innerText = `฿${totalInc.toLocaleString()}`; document.getElementById('sumExp').innerText = `฿${exp.toLocaleString()}`; document.getElementById('sumProfit').innerText = `฿${(totalInc - exp).toLocaleString()}`;
    let todayOrdersHtml = ''; let todayOrdersList = allOrdersData.filter(o => { let oDate = getValidOrderDate(o); return oDate === todayStr && !o.customer_name.includes('[ฝากขาย]'); });
    if(todayOrdersList.length === 0) { todayOrdersHtml = '<div style="text-align:center; color:var(--text3); padding: 20px;">ยังไม่มีออเดอร์วันนี้</div>'; } else {
        const top5Orders = todayOrdersList.slice(0, 5); 
        top5Orders.forEach(o => {
            let currentStatus = ['pending', 'cooking', 'completed', 'cancelled', 'consigned'].includes(o.status) ? o.status : 'pending'; let statusBadge = '';
            if(currentStatus === 'pending') statusBadge = '🟡 รอยืนยัน'; else if(currentStatus === 'cooking') statusBadge = '🍳 กำลังทำ'; else if(currentStatus === 'completed') statusBadge = '✅ เสร็จแล้ว'; else if(currentStatus === 'cancelled') statusBadge = '❌ ยกเลิก';
            let rawName = o.customer_name || ''; rawName = rawName.replace(/\[พร้อมเพย์\]|\[TrueWallet\]|\[เก็บปลายทาง\]|\(ออนไลน์\)/g, '').trim(); rawName = rawName.replace(/\[จัดเลี้ยง:.*?\]/g, '').trim(); const orderIdStr = `#${o.id.toString().padStart(5, '0')}`;
            todayOrdersHtml += `<div style="display:flex; justify-content:space-between; align-items:center; background: var(--surface2); padding: 10px 15px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 8px;"><div><div style="font-weight:bold; font-size:14px;"><span style="color:var(--primary); font-size:12px; margin-right:3px;">${orderIdStr}</span>👤 ${rawName}</div><div style="font-size:12px; color:var(--text3);">${statusBadge}</div></div><div style="color:var(--primary); font-weight:bold; text-align:right;">฿${Number(o.total_amount).toLocaleString()}<div style="font-size:11px; font-weight:normal; color:var(--text2);">โอนมา: ฿${Number(o.paid_amount || 0).toLocaleString()}</div></div></div>`;
        });
        if (todayOrdersList.length > 5) { todayOrdersHtml += `<div style="text-align:center; margin-top: 10px;"><button class="btn-outline" style="padding:5px 15px; font-size:12px;" onclick="switchPage('orders', document.getElementById('nav-orders')); setOrderFilter('today', document.querySelector('.tab-today'))">ดูออเดอร์วันนี้ทั้งหมด (${todayOrdersList.length})</button></div>`; }
    }
    document.getElementById('dashTodayOrdersList').innerHTML = todayOrdersHtml;
    const alertBox = document.getElementById('dashAlertPending');
    if(pendingCount > 0) { alertBox.style.display = 'flex'; document.getElementById('dashPendingCount').innerText = `${pendingCount} คิว`; if (!isFirstLoad && pendingCount > previousPendingCount) playNotificationSound(); } else { alertBox.style.display = 'none'; }
    previousPendingCount = pendingCount; isFirstLoad = false;
    let sortableItems = []; for (let name in itemSalesCount) sortableItems.push({ name: name, total: itemSalesCount[name] }); sortableItems.sort((a, b) => b.total - a.total);
    let topSellersHtml = ''; const medals = ['🥇', '🥈', '🥉'];
    for(let i=0; i<3 && i<sortableItems.length; i++) { topSellersHtml += `<div style="display:flex; justify-content:space-between; align-items:center; background: var(--surface2); padding: 10px 15px; border-radius: 8px;"><div style="font-weight:bold;">${medals[i]} ${sortableItems[i].name}</div><div style="color:var(--primary); font-weight:bold;">฿${sortableItems[i].total.toLocaleString()}</div></div>`; }
    document.getElementById('topSellersList').innerHTML = topSellersHtml || '<div style="text-align:center; color:var(--text3);">ยังไม่มีข้อมูลการขาย</div>';
    const ctx = document.getElementById('salesChart');
    if(ctx) {
      let labels = []; let dataPoints = []; for(let i=6; i>=0; i--) { let d = new Date(); d.setDate(d.getDate() - i); let dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); labels.push(`${d.getDate()}/${d.getMonth()+1}`); dataPoints.push(last7DaysSales[dStr] || 0); }
      if(mySalesChart) mySalesChart.destroy(); mySalesChart = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'ยอดขาย (บาท)', data: dataPoints, backgroundColor: '#E8600A', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { maxTicksLimit: 5 } } } } });
    }
    filterOrders(); filterConsignOrders(); 
  } catch(e) { console.error('Error loading data:', e); }
}
function openReceiptModal(id) {
    const order = allOrdersData.find(o => o.id === id); if(!order) return; const orderIdStr = `#${order.id.toString().padStart(5, '0')}`;
    document.getElementById('receiptId').innerText = `บิลที่: ${orderIdStr}`; document.getElementById('receiptDate').innerText = formatThaiDate(getValidOrderDate(order));
    let rawName = order.customer_name || 'ลูกค้าหน้าร้าน'; let isConsign = rawName.includes('[ฝากขาย]');
    if (isConsign) { document.getElementById('receiptCustomer').innerHTML = `ร้านค้า: <span style="color:var(--primary-dark)">${rawName.replace(/\[ฝากขาย\]/g, '').trim()}</span>`; } else { document.getElementById('receiptCustomer').innerHTML = `ลูกค้า: <span style="color:var(--primary-dark)">${rawName.replace(/\[.*?\]/g, '').replace(/\(ออนไลน์\)/g, '').trim()}</span>`; }
    let itemsHtml = '';
    if(order.items) {
        try { const parsedItems = JSON.parse(order.items);
            if (isConsign) { itemsHtml = parsedItems.map(i => { let text = `<span>${i.name} (${i.qty} ถุง)</span><span>฿${(Number(i.qty || 0) * Number(i.price || 0)).toLocaleString()}</span>`; if (i.returnQty && i.returnQty > 0) { text += `<div style="font-size:12px; color:#E84242; padding-left:10px;">↳ หักคืน: ${i.returnQty} ถุง (-฿${(Number(i.returnQty) * Number(i.price)).toLocaleString()})</div>`; } return `<div class="receipt-item" style="flex-direction: column; align-items: stretch;">${text}</div>`; }).join(''); } 
            else { itemsHtml = parsedItems.map(i => `<div class="receipt-item"><span>${i.name}</span><span>฿${Number(i.price || 0).toLocaleString()}</span></div>`).join(''); }
        } catch(e) {}
    }
    document.getElementById('receiptItemsContainer').innerHTML = itemsHtml; document.getElementById('receiptTotalAmount').innerText = `฿${Number(order.total_amount).toLocaleString()}`; document.getElementById('receiptPaidAmount').innerText = `(รับเงินมา: ฿${Number(order.paid_amount || 0).toLocaleString()})`;
    const now = new Date(); document.getElementById('receiptPrintTime').innerText = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} น.`; document.getElementById('receiptModal').classList.add('open');
}
function downloadReceipt() {
    const receiptEl = document.getElementById('receiptContent'); const originalBoxShadow = receiptEl.style.boxShadow; receiptEl.style.boxShadow = 'none'; 
    document.fonts.ready.then(() => { html2canvas(receiptEl, { scale: 3, backgroundColor: '#ffffff', useCORS: true, allowTaint: true, logging: false, onclone: function(clonedDoc) { const clonedEl = clonedDoc.getElementById('receiptContent'); clonedEl.style.fontFamily = "'Prompt', 'Sarabun', sans-serif"; clonedEl.style.letterSpacing = "normal"; clonedEl.style.textRendering = "optimizeLegibility"; } }).then(canvas => { receiptEl.style.boxShadow = originalBoxShadow; const link = document.createElement('a'); link.download = `receipt_${document.getElementById('receiptId').innerText.replace('บิลที่: #', '')}.png`; link.href = canvas.toDataURL('image/png', 1.0); link.click(); showToast('ดาวน์โหลดใบเสร็จเรียบร้อยแล้ว! 📥'); }).catch(err => { receiptEl.style.boxShadow = originalBoxShadow; showToast('ไม่สามารถดาวน์โหลดใบเสร็จได้', 'error'); }); });
}

// ==========================================
// 🌟 ส่วนระบบจัดเลี้ยง (Event System)
// ==========================================
let currentEventPage = 1; let savedEventToRender = []; let currentEventFilter = 'all'; let eventItems = {};
function filterOrders() {
    const searchTerm = document.getElementById('searchOrderInput').value.toLowerCase().trim(); const todayObj = new Date(); const todayStr = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0');
    const filtered = allOrdersData.filter(o => {
        const isOnline = o.customer_name.includes('(ออนไลน์)'); const isEvent = o.customer_name.includes('[จัดเลี้ยง'); const isConsign = o.customer_name.includes('[ฝากขาย]');
        if (isConsign || isEvent) return false; 
        let currentStatus = 'completed'; if (isOnline) { if (['pending', 'cooking', 'completed', 'cancelled'].includes(o.status)) currentStatus = o.status; else currentStatus = 'pending'; }
        let matchesTab = true; if (currentOrderFilter === 'pending') matchesTab = (currentStatus === 'pending'); else if (currentOrderFilter === 'cooking') matchesTab = (currentStatus === 'cooking'); else if (currentOrderFilter === 'completed') matchesTab = (currentStatus === 'completed'); else if (currentOrderFilter === 'cancelled') matchesTab = (currentStatus === 'cancelled'); else if (currentOrderFilter === 'today') matchesTab = (getValidOrderDate(o) === todayStr);
        if (!matchesTab) return false; if (!searchTerm) return true;
        const thaiDate = formatThaiDate(getValidOrderDate(o)); let itemsText = ''; if (o.items) { try { const parsedItems = JSON.parse(o.items); itemsText = parsedItems.map(i => `${i.name} ${i.price}`).join(' '); } catch(e) {} }
        let statusThai = ''; if (isOnline) { if (currentStatus === 'pending') statusThai = 'รอยืนยัน ออนไลน์'; else if (currentStatus === 'cooking') statusThai = 'กำลังทำ ออนไลน์'; else if (currentStatus === 'completed') statusThai = 'เสร็จแล้ว ออนไลน์'; else if (currentStatus === 'cancelled') statusThai = 'ยกเลิกแล้ว ยกเลิก ออนไลน์'; } else { statusThai = 'เสร็จแล้ว หน้าร้าน'; }
        const total = Number(o.total_amount); const paid = Number(o.paid_amount || 0); let payStatusThai = ''; if (paid === 0) payStatusThai = 'ยังไม่ได้จ่าย รอจ่ายเงิน เก็บปลายทาง เงินสด'; else if (paid === total) payStatusThai = 'จ่ายครบแล้ว พอดี'; else if (paid < total) payStatusThai = 'จ่ายขาด ค้างจ่าย'; else payStatusThai = 'จ่ายเกิน ทอนเงิน';
        const orderIdStr = o.id.toString().padStart(5, '0'); const searchableString = `#${orderIdStr} ${orderIdStr} ${o.customer_name} ${thaiDate} ${total} ${paid} ${itemsText} ${statusThai} ${payStatusThai}`.toLowerCase(); return searchTerm.split(' ').filter(term => term.trim() !== '').every(term => searchableString.includes(term));
    });
    renderOrders(filtered); filterEventOrders(); 
}

function filterEventOrders() {
    const searchTerm = document.getElementById('searchEventInput').value.toLowerCase().trim();
    const filtered = allOrdersData.filter(o => {
        const isEvent = o.customer_name.includes('[จัดเลี้ยง'); if (!isEvent) return false;
        let currentStatus = ['pending', 'cooking', 'completed', 'cancelled'].includes(o.status) ? o.status : 'pending';
        let matchesTab = true; if (currentEventFilter === 'pending') matchesTab = (currentStatus === 'pending'); else if (currentEventFilter === 'cooking') matchesTab = (currentStatus === 'cooking'); else if (currentEventFilter === 'completed') matchesTab = (currentStatus === 'completed'); else if (currentEventFilter === 'cancelled') matchesTab = (currentStatus === 'cancelled');
        if (!matchesTab) return false; if (!searchTerm) return true;
        const thaiDate = formatThaiDate(getValidOrderDate(o)); let itemsText = ''; if (o.items) { try { itemsText = JSON.parse(o.items).map(i => i.name).join(' '); } catch(e) {} }
        const orderIdStr = o.id.toString().padStart(5, '0'); const searchableString = `#${orderIdStr} ${orderIdStr} ${o.customer_name} ${thaiDate} ${itemsText}`.toLowerCase(); return searchTerm.split(' ').every(term => searchableString.includes(term));
    });
    renderEventOrders(filtered);
}
function setEventFilter(filterType, btnElement) { currentEventFilter = filterType; document.querySelectorAll('#page-event .order-tab').forEach(t => t.classList.remove('active')); btnElement.classList.add('active'); filterEventOrders(); }
function renderEventOrders(ordersToRender) { savedEventToRender = ordersToRender; const maxPage = Math.ceil(savedEventToRender.length / ORDERS_PER_PAGE) || 1; if (currentEventPage > maxPage) currentEventPage = maxPage; renderEventPageHTML(); }
function changeEventPage(page) { currentEventPage = page; renderEventPageHTML(); const pg = document.getElementById('page-event'); if (pg) pg.scrollIntoView({ behavior: 'smooth' }); }
function jumpToEventPage() { const input = document.getElementById('jumpEventInput'); if (!input) return; let page = parseInt(input.value); const totalPages = Math.ceil(savedEventToRender.length / ORDERS_PER_PAGE); if (isNaN(page) || page < 1) page = 1; if (page > totalPages) page = totalPages; changeEventPage(page); }
function renderEventPageHTML() {
    const isAdmin = currentUser && currentUser.role === 'admin'; const orderContainer = document.getElementById('eventList'); if (!orderContainer) return;
    if (savedEventToRender.length === 0) { orderContainer.innerHTML = '<div style="text-align:center; padding:30px; color:#B8860B; font-weight:bold; background:#FFF9E5; border-radius:12px;">📭 ไม่พบประวัติงานจัดเลี้ยง</div>'; return; }
    const startIndex = (currentEventPage - 1) * ORDERS_PER_PAGE; const endIndex = startIndex + ORDERS_PER_PAGE; const paginatedOrders = savedEventToRender.slice(startIndex, endIndex);
    let html = paginatedOrders.map(o => {
        const thaiDate = formatThaiDate(getValidOrderDate(o)); const delBtn = isAdmin ? `<button style="background:none; border:none; cursor:pointer; font-size:16px;" onclick="openDeleteModal('orders', ${o.id})" title="ลบ">🗑️</button>` : '';
        let rawName = o.customer_name.replace(/\[จัดเลี้ยง:.*?\]|\[จัดเลี้ยง\]/g, '').trim(); 
        let currentStatus = ['pending', 'cooking', 'completed', 'cancelled'].includes(o.status) ? o.status : 'pending';
        let processBadge = ''; let actionButtons = '';
        if(currentStatus === 'pending') { processBadge = `<span style="background:#FFF0F0; color:var(--danger); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #FFBBBB;">🟡 รอยืนยัน</span>`; actionButtons = `<div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px; display: flex; gap: 10px;"><button class="btn-status btn-confirm" style="flex: 2;" onclick="updateOrderStatus(${o.id}, 'cooking')">✅ ยืนยัน & กำลังทำ</button><button class="btn-status" style="background: #FFF0F0; color: var(--danger); border: 1px solid #FFBBBB; flex: 1;" onclick="rejectOrder(${o.id})">❌ ยกเลิก</button></div>`; } 
        else if (currentStatus === 'cooking') { processBadge = `<span style="background:#FFF8E8; color:#B8860B; padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #FFCF60;">🍳 กำลังทำ</span>`; actionButtons = `<div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px;"><button class="btn-status btn-cook" onclick="updateOrderStatus(${o.id}, 'completed')">🛎️ เสร็จแล้ว / เรียกรับของ</button></div>`; } 
        else if (currentStatus === 'completed') { processBadge = `<span style="background:#E8F5EE; color:var(--success); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #A8DDB8;">✅ ส่งมอบแล้ว</span>`; actionButtons = `<div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px; text-align:center; color: var(--success); font-weight: bold; font-size: 14px;">🎉 ส่งมอบเรียบร้อย</div>`; } 
        else if (currentStatus === 'cancelled') { processBadge = `<span style="background:#f8f9fa; color:var(--text3); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #ccc;">❌ ยกเลิกแล้ว</span>`; actionButtons = `<div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px; text-align:center; color: var(--danger); font-weight: bold; font-size: 14px;">❌ บิลถูกยกเลิกแล้ว</div>`; }
        const total = Number(o.total_amount); const paid = Number(o.paid_amount || 0);
        let moneyBadge = ''; let remainingText = '';
        if (paid === 0) { moneyBadge = `<span style="background:#FFF0F0; color:var(--danger); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #FFBBBB;">🔴 รอเก็บเงิน</span>`; remainingText = `<div style="color: var(--danger); font-size: 13px; font-weight: bold; margin-top: 4px;">⚠️ เหลือต้องเก็บ: ฿${total.toLocaleString()}</div>`; } else if (paid === total) { moneyBadge = `<span style="background:#E8F5EE; color:var(--success); padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #A8DDB8;">🟢 จ่ายครบแล้ว</span>`; remainingText = `<div style="color: var(--success); font-size: 13px; font-weight: bold; margin-top: 4px;">✅ จ่ายครบพอดี</div>`; } else if (paid < total) { moneyBadge = `<span style="background:#FFF8E8; color:#B8860B; padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #FFCF60;">🟠 มัดจำแล้ว</span>`; remainingText = `<div style="color: #B8860B; font-size: 13px; font-weight: bold; margin-top: 4px;">⚠️ เหลือต้องเก็บอีก: ฿${(total - paid).toLocaleString()}</div>`; } else { moneyBadge = `<span style="background:#E5F0FF; color:#0056b3; padding:3px 8px; border-radius:6px; font-size:12px; border: 1px solid #B8D4FF;">🔵 จ่ายเกิน</span>`; remainingText = `<div style="color: #0056b3; font-size: 13px; font-weight: bold; margin-top: 4px;">💸 ต้องทอนเงิน: ฿${(paid - total).toLocaleString()}</div>`; }
        let itemsHtml = ''; let eventDateForCal = '';
        if(o.items) { 
            try { const parsedItems = JSON.parse(o.items); if(parsedItems.length > 0) { itemsHtml = `<div style="background:#FFF9E5; padding:10px; border-radius:8px; margin-bottom:10px; border: 1px solid #FFE69C;"><div style="font-size:12px; color:#B8860B; margin-bottom:5px; font-weight:bold;">รายการจัดเลี้ยง:</div>${parsedItems.map(i => { if (i.name.includes('เวลารับ:')) { eventDateForCal = i.name.replace('📅 เวลารับ:', '').trim(); return `<div style="font-size:14px; color:#B8860B; font-weight:bold; margin-bottom:3px;">${i.name}</div>`; } return `<div style="font-size:14px; color:var(--text2); display:flex; justify-content:space-between; margin-bottom:3px;"><span>- ${i.name} ${i.qty ? `(${i.qty} ชุด)` : ''}</span><span>฿${(Number(i.qty||1) * Number(i.price)).toLocaleString()}</span></div>`; }).join('')}</div>`; } } catch(e) {} 
        }
        let calendarBtn = `<button style="background:#FFFDF0; border:1px solid #D4AF37; color:#B8860B; padding:3px 8px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;" onclick="addToCalendar('${safeStr(rawName)}', ${total}, ${paid}, '${eventDateForCal}')">📅 ลงปฏิทิน</button>`;
        let displayTotalHtml = `฿${total.toLocaleString()}<div style="font-size:11px; font-weight:normal; color:var(--text2);">โอน/มัดจำมา: ฿${paid.toLocaleString()}</div>`; const orderIdStr = `#${o.id.toString().padStart(5, '0')}`;
        return `<div class="card" style="padding:15px; margin-bottom:12px; border: 2px solid #D4AF37; background: #FFFAF0;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><div style="font-size:13px; color:#B8860B; font-weight:bold;">📅 ${thaiDate}</div><div style="display:flex; gap:8px;"><button style="background:#fff; border:1px solid #B8860B; color:#B8860B; cursor:pointer; font-size:13px; padding:3px 8px; border-radius:6px; font-weight:bold; font-family:'Prompt';" onclick="openEditOrderInfoModal(${o.id}, '${safeStr(rawName)}')">✏️ แก้ไข</button><button style="background:#fff; border:1px solid #B8860B; color:#B8860B; cursor:pointer; font-size:13px; padding:3px 8px; border-radius:6px; font-weight:bold; font-family:'Prompt';" onclick="openReceiptModal(${o.id})">📄 ดูบิล</button>${delBtn}</div></div><div style="margin-bottom: 12px;"><div style="font-weight:bold; font-size:16px; color:#B8860B; margin-bottom:6px; word-break: break-word;"><span style="color:#D4AF37; font-size:14px; margin-right:5px;">${orderIdStr}</span>🎁 ${rawName}</div><div style="display:flex; flex-wrap: wrap; gap: 6px; align-items: center;">${calendarBtn} ${processBadge} ${moneyBadge}</div></div>${itemsHtml}<div style="border-top: 1px dashed #D4AF37; padding-top: 10px; display:flex; justify-content:space-between; align-items:flex-start;"><div><div style="font-weight:bold; font-size: 14px; color:var(--text);">ยอดบิล: ฿${total.toLocaleString()}</div>${remainingText}</div><div style="text-align:right;">${displayTotalHtml}</div></div>${actionButtons}</div>`;
    }).join('');
    const totalPages = Math.ceil(savedEventToRender.length / ORDERS_PER_PAGE); html += generatePaginationHTML(currentEventPage, totalPages, 'Event', '--event-color, #D4AF37'); orderContainer.innerHTML = html;
}

// ==========================================
// 📑 ระบบศูนย์ออกรายงาน (Report Center)
// ==========================================

function generateReportPreview() {
    const category = document.getElementById('rptCategory').value;
    const startDate = document.getElementById('rptStart').value;
    const endDate = document.getElementById('rptEnd').value;

    if (!startDate || !endDate) return showToast('กรุณาระบุช่วงวันที่ครับ', 'error');
    if (startDate > endDate) return showToast('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุดครับ', 'error');

    let filteredData = [];
    let topItems = {};
    let totalSales = 0;
    let totalOrders = 0;

    if (category === 'finance') {
        filteredData = combinedFinanceData.filter(f => {
            const d = getLocalDateString(f.created_at);
            return d >= startDate && d <= endDate;
        });
    } else {
        filteredData = allOrdersData.filter(o => {
            const d = getValidOrderDate(o);
            const isOnline = o.customer_name.includes('(ออนไลน์)');
            const isEvent = o.customer_name.includes('[จัดเลี้ยง');
            const isConsign = o.customer_name.includes('[ฝากขาย]');
            const isNormal = !isOnline && !isEvent && !isConsign;

            let matchCat = false;
            if (category === 'all') matchCat = true;
            else if (category === 'normal') matchCat = isNormal;
            else if (category === 'online') matchCat = isOnline;
            else if (category === 'event') matchCat = isEvent;
            else if (category === 'consignment') matchCat = isConsign;

            return d >= startDate && d <= endDate && matchCat;
        });
    }

    if (filteredData.length === 0) {
        document.getElementById('rptPreviewContainer').style.display = 'none';
        document.getElementById('rptAction').style.display = 'none';
        document.getElementById('rptInsight').innerHTML = '<div style="text-align: center; color: var(--danger); padding: 30px;">❌ ไม่พบข้อมูลในช่วงเวลาที่เลือก</div>';
        return;
    }

    filteredData.forEach(item => {
        totalSales += Number(item.total_amount || item.amount || 0);
        totalOrders++;
        if (item.items) {
            try {
                const parsed = JSON.parse(item.items);
                parsed.forEach(p => {
                    if (!p.name.includes('📅')) {
                        topItems[p.name] = (topItems[p.name] || 0) + (Number(p.qty) || 1);
                    }
                });
            } catch (e) {}
        }
    });

    let dateStats = {};
    filteredData.forEach(item => {
        const d = formatThaiDate(getLocalDateString(item.created_at || item.order_date));
        dateStats[d] = (dateStats[d] || 0) + Number(item.total_amount || item.amount || 0);
    });
    const bestDay = Object.keys(dateStats).reduce((a, b) => dateStats[a] > dateStats[b] ? a : b);

    let topItemsHtml = Object.entries(topItems)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, qty]) => `<li>${name} (${qty} รายการ)</li>`).join('');

    document.getElementById('rptInsight').innerHTML = `
        <div style="background:#E8F5EE; padding:15px; border-radius:10px; border-left:5px solid #2E7D32;">
            <div style="font-size:13px; color:#2E7D4F;">💰 ยอดขายรวม</div>
            <div style="font-size:24px; font-weight:bold; color:#1B5E20;">฿${totalSales.toLocaleString()}</div>
        </div>
        <div style="background:#FFF8E8; padding:15px; border-radius:10px; border-left:5px solid #D4AF37;">
            <div style="font-size:13px; color:#B8860B;">⭐ วันที่ขายดีที่สุด</div>
            <div style="font-size:15px; font-weight:bold;">${bestDay}</div>
        </div>
        <div style="background:#f9f9f9; padding:15px; border-radius:10px; border:1px solid #ddd;">
            <div style="font-size:13px; color:var(--text2); font-weight:bold; margin-bottom:5px;">🏆 3 อันดับสินค้าขายดี (ตามจำนวนครั้ง):</div>
            <ul style="margin:0; padding-left:20px; font-size:14px;">${topItemsHtml || 'ไม่มีข้อมูลสินค้า'}</ul>
        </div>
    `;

    document.getElementById('rptPreviewContainer').style.display = 'block';
    document.getElementById('rptAction').style.display = 'block';
    document.getElementById('rptTableBody').innerHTML = filteredData.slice(0, 10).map(item => `
        <tr>
            <td style="padding:10px; border:1px solid #ddd;">${getLocalDateString(item.created_at || item.order_date)}</td>
            <td style="padding:10px; border:1px solid #ddd;">${item.customer_name || item.note}</td>
            <td style="padding:10px; border:1px solid #ddd;">฿${Number(item.total_amount || item.amount).toLocaleString()}</td>
            <td style="padding:10px; border:1px solid #ddd;">${item.status || 'ปกติ'}</td>
        </tr>
    `).join('') + (filteredData.length > 10 ? `<tr><td colspan="4" style="text-align:center; padding:10px; color:#888;">... และข้อมูลอื่นอีก ${(filteredData.length - 10)} รายการ ...</td></tr>` : '');

    window.lastFilteredData = filteredData; 
}

function exportToExcel() {
    if (!window.lastFilteredData || window.lastFilteredData.length === 0) return;
    
    const category = document.getElementById('rptCategory').value;
    const excelData = window.lastFilteredData.map(o => {
        if (category === 'finance') {
            return {
                "วันที่": getLocalDateString(o.created_at),
                "ประเภท": o.type === 'income' ? 'รายรับ' : 'รายจ่าย',
                "รายละเอียด": o.note,
                "จำนวนเงิน (บาท)": Number(o.amount),
                "ที่มา": o.is_manual ? "จดเอง" : "ออเดอร์"
            };
        } else {
            return {
                "เลขออเดอร์": o.id,
                "วันที่": getLocalDateString(o.created_at || o.order_date),
                "ชื่อลูกค้า": o.customer_name,
                "ยอดรวมบิล": Number(o.total_amount),
                "ยอดรับเงินจริง": Number(o.paid_amount || 0),
                "สถานะ": o.status
            };
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `Banana_Report_${category}_${getLocalDateString(new Date())}.xlsx`);
    showToast('ดาวน์โหลดเรียบร้อยแล้วครับ! 🚀');
}
