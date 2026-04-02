// 🌟 เปลี่ยน API ให้ชี้ไปที่หลังบ้านบน Render (อย่าลืมเปลี่ยนชื่อ banana-backend ให้ตรงกับของคุณวงศกรนะครับ)
const API_URL = 'https://banana-backend.onrender.com/api';

const PROMPTPAY_ID = "0968585135"; 
const TRUE_WALLET_NUMBER = "0968585135";

// ... (โค้ดด้านล่างปล่อยไว้เหมือนเดิมทั้งหมดเลยครับ)
let slipBase64 = null;
let currentSlipFile = null; // 🌟 เพิ่มตัวแปรเก็บไฟล์รูปจริงสำหรับส่งให้หลังบ้าน (Multer)
let currentTotal = 0;
let currentEventTotal = 0;
let slipScannedAmount = 0; 
let eventMode = 'custom';
let eventProductsData = [];

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

window.onload = async () => {
  const savedOrderId = localStorage.getItem('myBananaOrderId');
  if (savedOrderId) {
    try {
      const res = await fetch(`${API_URL}/orders/${savedOrderId}/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.status) {
          startTracking(savedOrderId);
          return; 
        }
      }
    } catch(e) {}
  }
  
  checkStoreStatus(); 
  setInterval(checkStoreStatus, 10000); 
  loadProducts();
};

async function checkStoreStatus() {
  try {
      const res = await fetch(`${API_URL}/store-status`);
      if (res.ok) {
          const data = await res.json();
          const overlay = document.getElementById('closedOverlay');
          const btnSubmit = document.getElementById('mainSubmitBtn');
          
          if (!data.isOpen) {
              overlay.style.display = 'flex';
              document.body.style.overflow = 'hidden'; 
              if(btnSubmit) btnSubmit.disabled = true; 
          } else {
              overlay.style.display = 'none';
              document.body.style.overflow = '';
              updateCartTotal(); 
          }
      }
  } catch (e) {
      console.error("Could not fetch store status");
  }
}

function toggleScreen(screenId) {
  document.getElementById('mainOrderScreen').style.display = 'none';
  document.getElementById('eventOrderScreen').style.display = 'none';
  document.getElementById(screenId).style.display = 'block';
  window.scrollTo(0,0);
}

function setEventMode(mode) {
  eventMode = mode;
  document.getElementById('eventCustomContainer').style.display = mode === 'custom' ? 'block' : 'none';
  document.getElementById('eventMixedContainer').style.display = mode === 'mixed' ? 'block' : 'none';
  document.getElementById('modeBtnCustom').classList.toggle('active', mode === 'custom');
  document.getElementById('modeBtnMixed').classList.toggle('active', mode === 'mixed');
  calcEventTotal();
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3000);
}

function copyWalletNumber() {
  navigator.clipboard.writeText(TRUE_WALLET_NUMBER).then(() => { showToast('คัดลอกเบอร์สำเร็จ!'); }).catch(err => { showToast('คัดลอกไม่สำเร็จ', 'error'); });
}

function generatePromptPayPayload(id, amount) {
  let formattedId = id.replace(/[^0-9]/g, ''); let idTag = "";
  if (formattedId.length === 10) { formattedId = "0066" + formattedId.substring(1); idTag = "0113" + formattedId; } else if (formattedId.length === 13) { idTag = "0213" + formattedId; } else { idTag = "0315" + formattedId; }
  const merchantInfo = "0016A000000677010111" + idTag; const merchantAccountInfo = "29" + merchantInfo.length.toString().padStart(2, '0') + merchantInfo;
  const formatInfo = "000201"; const pointOfInitiation = amount > 0 ? "010212" : "010211"; const countryCode = "5802TH"; const currencyCode = "5303764";
  let amountStr = ""; if (amount > 0) { const amt = amount.toFixed(2); amountStr = "54" + amt.length.toString().padStart(2, '0') + amt; }
  let payload = formatInfo + pointOfInitiation + merchantAccountInfo + countryCode + currencyCode + amountStr + "6304";
  let crc = 0xFFFF; for (let i = 0; i < payload.length; i++) { crc ^= (payload.charCodeAt(i) << 8); for (let j = 0; j < 8; j++) { if ((crc & 0x8000) !== 0) { crc = ((crc << 1) ^ 0x1021) & 0xFFFF; } else { crc = (crc << 1) & 0xFFFF; } } }
  let hex = crc.toString(16).toUpperCase().padStart(4, '0'); return payload + hex;
}

async function downloadQR(imgId) {
  const qrUrl = document.getElementById(imgId).src;
  if (!qrUrl || !qrUrl.startsWith('data:')) return;
  try {
    const fetchRes = await fetch(qrUrl); const blob = await fetchRes.blob(); const file = new File([blob], 'QR_Payment.png', { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'QR Code โอนเงิน' }); } 
    else {
      const downloadUrl = window.URL.createObjectURL(blob); const link = document.createElement('a'); link.href = downloadUrl; link.download = 'QR_Payment.png';
      document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(downloadUrl); showToast('บันทึกรูปแล้ว!');
    }
  } catch (error) { console.error(error); }
}

async function loadProducts() {
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    
    const normalProducts = products.filter(p => !p.category || p.category === 'normal');
    document.getElementById('menuList').innerHTML = normalProducts.map((p, index) => `
      <label class="menu-item" id="item-box-${index}">
        <div style="display:flex; align-items:center; gap:15px;">
          <input type="checkbox" id="chk-${index}" value="${p.name}" class="checkbox-custom" onchange="toggleItem(${index})">
          <div><div style="font-weight:bold; font-size: 16px;">${p.emoji} ${p.name}</div><div style="font-size: 13px; color: var(--text3);">ราคาเริ่มต้น ฿${p.price}</div></div>
        </div>
        <input type="number" id="amt-${index}" class="form-control" placeholder="ระบุราคา" style="width: 90px; display: none;" oninput="calcTotal()">
      </label>
    `).join('');

    eventProductsData = products.filter(p => p.category === 'event');
    if (eventProductsData.length > 0) {
      document.getElementById('eventMenuList').innerHTML = eventProductsData.map((p, index) => `
        <label class="menu-item" id="ev-item-box-${index}">
          <div style="display:flex; align-items:center; gap:15px; flex:1;">
            <input type="checkbox" id="ev-chk-${index}" value="${p.name}" class="checkbox-custom" onchange="toggleEvItem(${index})">
            <div style="font-weight:bold; font-size: 16px;">${p.emoji} ${p.name}</div>
          </div>
          <input type="number" id="ev-amt-${index}" class="form-control ev-custom-amt" placeholder="งบ (บาท)" style="width: 100px; display: none; text-align: right;" oninput="calcEventTotal()" data-name="${p.name}">
        </label>
      `).join('');
    } else {
      document.getElementById('eventMenuList').innerHTML = '<div style="color:var(--text3); text-align:center; padding:10px;">ยังไม่มีเมนูจัดเลี้ยงในระบบ</div>';
    }
  } catch(e) { console.error(e); }
}

function toggleItem(index) {
  const chk = document.getElementById(`chk-${index}`); const amtInput = document.getElementById(`amt-${index}`); const box = document.getElementById(`item-box-${index}`);
  if(chk.checked) { amtInput.style.display = 'block'; box.classList.add('selected'); amtInput.focus(); } else { amtInput.style.display = 'none'; amtInput.value = ''; box.classList.remove('selected'); }
  calcTotal();
}

function toggleEvItem(index) {
  const chk = document.getElementById(`ev-chk-${index}`); const amtInput = document.getElementById(`ev-amt-${index}`); const box = document.getElementById(`ev-item-box-${index}`);
  if(chk.checked) { amtInput.style.display = 'block'; box.classList.add('selected'); amtInput.focus(); } else { amtInput.style.display = 'none'; amtInput.value = ''; box.classList.remove('selected'); }
  calcEventTotal();
}

function calcTotal() {
  currentTotal = 0; document.querySelectorAll('input[type="number"]').forEach(input => { if(input.id.startsWith('amt-') && input.style.display === 'block' && input.value) { currentTotal += Number(input.value); } });
  document.getElementById('totalAmountDisplay').innerText = `฿${currentTotal}`; updateQRCode();
  updateCartTotal();
}

function updateQRCode() {
  const qrImg = document.getElementById('qrImage'); const qrTextContainer = document.getElementById('qrTextContainer'); const qrTextAmount = document.getElementById('qrTextAmount'); const qrTextPlaceholder = document.getElementById('qrTextPlaceholder'); const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
  if (paymentMethod === 'transfer' && currentTotal > 0) {
    const payload = generatePromptPayPayload(PROMPTPAY_ID, currentTotal); const qr = new QRious({ value: payload, size: 300, level: 'M' });
    qrImg.src = qr.toDataURL('image/png'); qrImg.style.display = 'block'; qrTextAmount.innerText = `📲 สแกนจ่ายยอด ฿${currentTotal}`; qrTextContainer.style.display = 'block'; qrTextPlaceholder.style.display = 'none';
  } else { qrImg.style.display = 'none'; qrTextContainer.style.display = 'none'; if (currentTotal === 0) { qrTextPlaceholder.style.display = 'block'; } }
}

function selectPayment(type) {
  const detailsBox = document.getElementById('payDetails'); const codBox = document.getElementById('codDetails'); const bankInfo = document.getElementById('bankInfo'); const walletInfo = document.getElementById('walletInfo');
  if (type === 'transfer') { detailsBox.style.display = 'block'; codBox.style.display = 'none'; bankInfo.style.display = 'block'; walletInfo.style.display = 'none'; } 
  else if (type === 'wallet') { detailsBox.style.display = 'block'; codBox.style.display = 'none'; bankInfo.style.display = 'none'; walletInfo.style.display = 'block'; } 
  else if (type === 'cod') { detailsBox.style.display = 'none'; codBox.style.display = 'block'; resetSlipUI('normal'); }
  updateQRCode();
}

function calcEventTotal() {
  currentEventTotal = 0;
  if (eventMode === 'custom') {
    eventProductsData.forEach((p, index) => { 
      const chk = document.getElementById(`ev-chk-${index}`);
      const amt = document.getElementById(`ev-amt-${index}`);
      if(chk && chk.checked && amt.value) currentEventTotal += Number(amt.value); 
    });
  } else {
    currentEventTotal = Number(document.getElementById('evMixedBudget').value) || 0;
  }
  document.getElementById('evTotalDisplay').innerText = `฿${currentEventTotal}`;
  document.getElementById('evBtnTotal').innerText = `฿${currentEventTotal}`;
  
  if (currentEventTotal > 0) {
    const payload = generatePromptPayPayload(PROMPTPAY_ID, currentEventTotal);
    const qr = new QRious({ value: payload, size: 300, level: 'M' });
    document.getElementById('evQrImage').src = qr.toDataURL('image/png');
    document.getElementById('evQrImage').style.display = 'block';
    document.getElementById('evQrTextAmount').innerText = `📲 สแกนจ่ายยอด ฿${currentEventTotal}`;
  } else {
    document.getElementById('evQrImage').style.display = 'none';
    document.getElementById('evQrTextAmount').innerText = "ระบุยอดเงินเพื่อสร้าง QR Code";
  }
}

function updateCartTotal() {
    const btnSubmit = document.getElementById('mainSubmitBtn');
    const overlayHidden = document.getElementById('closedOverlay').style.display === 'none';
    
    if (currentTotal > 0 && overlayHidden) {
        btnSubmit.disabled = false;
    } else {
        btnSubmit.disabled = true;
    }
}

// 🌟 ปรับระบบให้รับไฟล์รูปภาพจริง (File) เก็บไว้เตรียมอัปโหลด
async function previewSlip(event, orderType) {
  const file = event.target.files[0]; if(!file) return;
  
  if(file.size > 5 * 1024 * 1024) { 
      showToast('ไฟล์รูปใหญ่เกิน 5MB กรุณาเลือกรูปใหม่', 'error'); 
      event.target.value = ''; 
      return; 
  }

  currentSlipFile = file; // 🌟 เก็บไฟล์ตัวจริงไว้ส่งให้ Server

  const reader = new FileReader();
  reader.onload = async e => {
    slipBase64 = e.target.result; // เก็บ Base64 ไว้ใช้โชว์รูปตัวอย่างหน้าเว็บ และให้ AI อ่าน
    let isEvent = orderType === 'event';
    let targetTotal = isEvent ? currentEventTotal : currentTotal;
    let submitBtnId = isEvent ? 'evSubmitBtn' : 'mainSubmitBtn';

    let previewId = isEvent ? 'evSlipPreview' : 'slipPreview';
    let placeholderId = isEvent ? 'evUploadPlaceholder' : 'uploadPlaceholder';
    let zoneId = isEvent ? 'evUploadZone' : 'uploadZone';
    let btnId = isEvent ? 'btnChangeEvSlip' : 'btnChangeSlip';
    let statusId = isEvent ? 'evSlipAiStatus' : 'slipAiStatus';

    document.getElementById(previewId).src = e.target.result;
    document.getElementById(previewId).style.display = 'block';
    document.getElementById(placeholderId).style.display = 'none';
    document.getElementById(btnId).style.display = 'flex';
    document.getElementById(zoneId).style.borderStyle = 'solid';

    const aiStatus = document.getElementById(statusId);
    const submitBtn = document.getElementById(submitBtnId);
    aiStatus.innerHTML = '<span style="color: var(--primary);">🤖 AI กำลังอ่านยอดเงิน...</span>';
    submitBtn.disabled = true;

    try {
      const result = await Tesseract.recognize(slipBase64, 'tha+eng');
      const match = result.data.text.match(/([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/);
      if (match) {
        slipScannedAmount = parseFloat(match[1].replace(/,/g, ''));
        aiStatus.innerHTML = (slipScannedAmount === targetTotal) 
          ? `<span style="color: var(--success);">✨ ยอดเงินตรงเป๊ะ! (฿${slipScannedAmount})</span>` 
          : `<span style="color: var(--danger);">⚠️ ยอดในสลิป (฿${slipScannedAmount}) ไม่ตรงกับค่าออเดอร์</span>`;
      } else {
        slipScannedAmount = 0; aiStatus.innerHTML = `<span style="color: #B8860B;">⚠️ AI อ่านยอดไม่ได้ (รอร้านตรวจสอบ)</span>`;
      }
    } catch(err) { aiStatus.innerHTML = `<span>❌ ระบบอ่านสลิปขัดข้อง</span>`; }
    submitBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

function resetSlipUI(orderType) {
  let isEvent = orderType === 'event';
  slipBase64 = null; 
  currentSlipFile = null; // 🌟 ล้างไฟล์ตัวจริงทิ้งด้วย
  slipScannedAmount = 0;
  
  let previewId = isEvent ? 'evSlipPreview' : 'slipPreview';
  let placeholderId = isEvent ? 'evUploadPlaceholder' : 'uploadPlaceholder';
  let zoneId = isEvent ? 'evUploadZone' : 'uploadZone';
  let btnId = isEvent ? 'btnChangeEvSlip' : 'btnChangeSlip';
  let statusId = isEvent ? 'evSlipAiStatus' : 'slipAiStatus';
  let inputId = isEvent ? 'evSlipInput' : 'slipInput';

  document.getElementById(statusId).innerHTML = '';
  document.getElementById(inputId).value = ''; 
  document.getElementById(previewId).style.display = 'none';
  document.getElementById(placeholderId).style.display = 'block';
  document.getElementById(btnId).style.display = 'none';
  document.getElementById(zoneId).style.borderStyle = 'dashed';
}

async function startTracking(orderId) {
  document.getElementById('mainOrderScreen').style.display = 'none';
  document.getElementById('eventOrderScreen').style.display = 'none';
  document.getElementById('trackingScreen').style.display = 'block';
  let trackingInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/status`);
      const data = await res.json();
      if (data.status === 'cooking') {
        document.getElementById('trackMainIcon').innerText = '🍳'; document.getElementById('trackTitle').innerText = 'กำลังลงกระทะร้อนๆ!'; document.getElementById('step-cooking').classList.add('active');
      } else if (data.status === 'completed') {
        document.getElementById('trackMainIcon').innerText = '🎉'; document.getElementById('trackTitle').innerText = 'เสร็จแล้ว! มารับได้เลย'; document.getElementById('step-cooking').classList.add('active'); document.getElementById('step-completed').classList.add('active'); document.getElementById('btnNewOrder').style.display = 'block'; clearInterval(trackingInterval);
      } else if (data.status === 'cancelled') {
        document.getElementById('trackMainIcon').innerText = '❌'; document.getElementById('trackTitle').innerText = 'ออเดอร์ถูกยกเลิก'; document.getElementById('btnNewOrder').style.display = 'block'; clearInterval(trackingInterval);
      }
    } catch(e) {}
  }, 3000);
}

function clearSessionAndReload() { localStorage.removeItem('myBananaOrderId'); location.reload(); }

async function submitOrder(orderType) {
  let finalCustomerName = '';
  let finalTotalAmount = 0;
  let finalOrderItems = [];
  let paymentMethodStr = '';

  const now = new Date();
  const thTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
  const localDateStr = thTime.toISOString().split('T')[0];

  if (orderType === 'normal') {
    let rawName = document.getElementById('custName').value.trim();
    let rawPhone = document.getElementById('custPhone').value.trim();
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    
    if(!rawName) return showToast('กรุณาระบุชื่อผู้สั่งซื้อ', 'error');
    if(currentTotal === 0) return showToast('กรุณาเลือกเมนูอย่างน้อย 1 รายการ', 'error');
    if(paymentMethod !== 'cod' && !currentSlipFile) return showToast('กรุณาแนบสลิปโอนเงิน', 'error'); // 🌟 เช็กไฟล์สลิป

    let payTagText = '';
    if (paymentMethod === 'cod') {
        payTagText = '[เก็บเงินปลายทาง]';
    } else if (paymentMethod === 'transfer') {
        payTagText = '[พร้อมเพย์]';
    } else if (paymentMethod === 'wallet') {
        payTagText = '[TrueWallet]';
    }

    finalCustomerName = `${rawName} ${rawPhone ? '📞'+rawPhone : ''} (ออนไลน์) ${payTagText}`;
    finalTotalAmount = currentTotal;
    paymentMethodStr = paymentMethod;
    
    document.querySelectorAll('.checkbox-custom').forEach((chk) => {
      if(chk.id.startsWith('chk-') && chk.checked) {
        const idx = chk.id.split('-')[1];
        finalOrderItems.push({ name: chk.value, price: Number(document.getElementById(`amt-${idx}`).value) || 0 });
      }
    });
  } else {
    let rawName = document.getElementById('evName').value.trim();
    let rawPhone = document.getElementById('evPhone').value.trim();
    let eventType = document.getElementById('evType').value;
    let dateTime = document.getElementById('evDateTime').value;
    
    if(!rawName || !rawPhone || !dateTime) return showToast('กรุณากรอกข้อมูลผู้ติดต่อและเวลาให้ครบ', 'error');
    if(currentEventTotal <= 0) return showToast('กรุณาระบุงบประมาณ', 'error');
    if(!currentSlipFile) return showToast('รบกวนแนบสลิปมัดจำด้วยครับ', 'error'); // 🌟 เช็กไฟล์สลิป

    finalCustomerName = `${rawName} 📞${rawPhone} [จัดเลี้ยง: ${eventType}]`;
    finalTotalAmount = currentEventTotal;
    paymentMethodStr = 'transfer';

    if (eventMode === 'custom') {
      eventProductsData.forEach((p, index) => {
        const chk = document.getElementById(`ev-chk-${index}`);
        const amt = document.getElementById(`ev-amt-${index}`);
        if (chk && chk.checked && Number(amt.value) > 0) {
          finalOrderItems.push({ name: `🎁 [จัดเลี้ยง] ${p.name}`, price: Number(amt.value) });
        }
      });
    } else {
      finalOrderItems.push({ name: `🎁 [จัดเลี้ยง] ให้ร้านคละขนมรวมทุกอย่าง`, price: currentEventTotal });
    }
    finalOrderItems.push({ name: `📅 เวลารับ: ${dateTime.replace('T', ' ')} น.`, price: 0 });
  }

  try {
    let submitBtnId = orderType === 'event' ? 'evSubmitBtn' : 'mainSubmitBtn';
    document.getElementById(submitBtnId).disabled = true;
    document.getElementById(submitBtnId).innerText = "กำลังส่งรูปสลิป... ⏳";

    // 🌟 ระบบอัปโหลดไฟล์สลิปของจริง (ส่งเข้าเซิร์ฟเวอร์ก่อน แล้วเอา URL มาใช้)
    let finalSlipUrl = null;
    if (paymentMethodStr !== 'cod' && currentSlipFile) {
        finalSlipUrl = await uploadImageToServer(currentSlipFile);
        if (!finalSlipUrl) {
            document.getElementById(submitBtnId).disabled = false;
            document.getElementById(submitBtnId).innerText = "ยืนยันการสั่งซื้อ";
            return showToast('อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้งครับ', 'error');
        }
    }

    document.getElementById(submitBtnId).innerText = "กำลังสร้างออเดอร์...";

    const res = await fetch(`${API_URL}/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        customer_name: finalCustomerName, 
        total_amount: finalTotalAmount, 
        paid_amount: (paymentMethodStr === 'cod' ? 0 : slipScannedAmount),
        slip_image: finalSlipUrl, // 🌟 ส่งเป็น URL รูปแทนข้อความยาวๆ แล้ว
        items: finalOrderItems, 
        order_date: localDateStr 
      })
    });
    if(!res.ok) throw new Error();
    const data = await res.json();
    localStorage.setItem('myBananaOrderId', data.orderId || data.id);
    startTracking(data.orderId || data.id);
  } catch(e) { 
      let submitBtnId = orderType === 'event' ? 'evSubmitBtn' : 'mainSubmitBtn';
      document.getElementById(submitBtnId).disabled = false;
      document.getElementById(submitBtnId).innerText = "ยืนยันการสั่งซื้อ";
      showToast('เชื่อมต่อร้านไม่สำเร็จ', 'error'); 
  }
}