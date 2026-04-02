const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // 🔒 เข้ารหัส PIN
const rateLimit = require('express-rate-limit'); // 🛡️ ป้องกันยิง API
const multer = require('multer'); // 📁 อัปโหลดไฟล์
const path = require('path');
const fs = require('fs');
const helmet = require('helmet'); // 🛡️ เพิ่ม Helmet ป้องกัน XSS, Clickjacking

const app = express();

// 🛡️ 1. ใส่ Helmet ป้องกันช่องโหว่ Header (ตั้งค่าให้แสดงรูปข้ามโดเมนได้)
app.use(helmet({ crossOriginResourcePolicy: false }));

// 🌐 2. อนุญาตให้หน้าเว็บจาก Vercel ยิง API เข้ามาได้
// 📍 แก้ให้เปิดรับแบบอิสระชั่วคราว เพื่อไม่ให้ Vercel โดนบล็อกตอนเทส
app.use(cors());

app.use(express.json({ limit: '10mb' }));

// 📁 3. ตั้งค่า Multer พร้อมระบบกรองไฟล์ (Validate Upload)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'slip-' + uniqueSuffix + path.extname(file.originalname));
  }
});
// 🛡️ กรองให้รับเฉพาะไฟล์รูปภาพ ป้องกันคนอัปโหลดไฟล์ไวรัส/สคริปต์
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('อัปโหลดได้เฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP) เท่านั้น ❌'));
};
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: fileFilter });
app.use('/uploads', express.static(uploadDir));

// 🛡️ 4. Rate Limit ป้องกันการสแปม
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: { error: 'รีเควสเยอะเกินไป กรุณารอสักครู่' } });
const loginLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 10, message: { error: 'ล็อกอินผิดหลายครั้ง ระงับการใช้งาน 5 นาที' } });
app.use('/api/', globalLimiter);

// 🗄️ 5. DB Connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
  // 📍 ต้องเพิ่ม ssl ชุดนี้ เพื่อให้สามารถเชื่อมต่อกับฐานข้อมูลฟรี Neon.tech ได้!
  ssl: { require: true, rejectUnauthorized: false }
});

let globalStoreStatus = true;

// ==========================================
// 🛠️ ตรวจสอบและอัปเดตโครงสร้างฐานข้อมูล
// ==========================================
pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';`)
  .then(() => console.log('✅ ตรวจสอบ/อัปเดตฐานข้อมูลสำเร็จ (สถานะออเดอร์)'))
  .catch(err => console.error('🔥 DB Error:', err.message));

pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'normal';`)
  .then(() => console.log('✅ ตรวจสอบ/อัปเดตฐานข้อมูลสำเร็จ (หมวดหมู่สินค้า)'))
  .catch(err => console.error('🔥 DB Error:', err.message));

pool.query(`ALTER TABLE users ALTER COLUMN pin_code TYPE VARCHAR(255);`)
  .then(() => console.log('✅ ตรวจสอบ/อัปเดตฐานข้อมูลสำเร็จ (ขยายช่องรหัสผ่านเรียบร้อย)'))
  .catch(err => console.error('🔥 DB Error (users table):', err.message));

// 🔒 Auth Middleware (เช็ค Token)
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'ไม่พบ Token' });
  const token = authHeader.split(' ')[1];
  
  // 🔐 ดึงรหัสลับจาก .env ป้องกันการถูกขโมยรหัส 
  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key', (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token หมดอายุ หรือ ไม่ถูกต้อง' });
    req.user = decoded;
    next();
  });
};

// 🔒 Role Middleware (เช็คแอดมิน)
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง (เฉพาะแอดมิน)' });
  next();
};

// ==========================================
// 🚀 API Routes
// ==========================================

// 🔐 Login + Auto Hash PIN 
app.post('/api/login', loginLimiter, async (req, res) => {
  const { pin } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users');
    let matchedUser = null;
    
    for (let user of result.rows) {
      const dbPin = String(user.pin_code || ''); 
      
      if (dbPin.startsWith('$2b$')) {
        const match = await bcrypt.compare(String(pin), dbPin);
        if (match) { matchedUser = user; break; }
      } else {
        if (dbPin === String(pin)) {
          matchedUser = user;
          const hashedPin = await bcrypt.hash(String(pin), 10);
          await pool.query('UPDATE users SET pin_code=$1 WHERE id=$2', [hashedPin, user.id]);
          console.log(`✨ อัปเกรดรหัสผ่านของ ${user.name} เป็นระบบความปลอดภัยสูง (Hash) อัตโนมัติ!`);
          break;
        }
      }
    }

    if (!matchedUser) return res.status(401).json({ error: 'รหัสไม่ถูกต้อง' });
    
    // 🔐 ดึงรหัสลับจาก .env มาสร้าง Token
    const token = jwt.sign({ id: matchedUser.id, role: matchedUser.role, name: matchedUser.name }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '1d' });
    res.json({ token, user: { name: matchedUser.name, role: matchedUser.role } });
  } catch (err) { 
    console.error("🔥 Login Error:", err);
    res.status(500).json({ error: err.message }); 
  }
});

// 📁 อัปโหลดสลิป (ดักจับ Error กรณีอัปโหลดไฟล์ที่ไม่ใช่รูปภาพ)
app.post('/api/upload', (req, res) => {
  upload.single('slip')(req, res, function (err) {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'ไม่มีไฟล์ถูกส่งมา' });
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
  });
});

// 🟢 API สาธารณะ (เปิด public ให้หน้าลูกค้า)
app.get('/api/store-status', (req, res) => {
  try { res.json({ isOpen: globalStoreStatus }); } 
  catch (error) { res.status(500).json({ error: "Cannot get store status" }); }
});

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE is_deleted = false ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orders', async (req, res) => {
  const { customer_name, total_amount, paid_amount, slip_image, items, order_date } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO orders (customer_name, total_amount, paid_amount, slip_image, items, order_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', 
      [customer_name, total_amount, paid_amount, slip_image, JSON.stringify(items), order_date]
    );
    res.json({ message: 'บันทึกออเดอร์สำเร็จ', orderId: result.rows[0].id });
  } catch (err) { 
    console.error('🔥 DATABASE ERROR:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// 🔴 API ป้องกันด้วย Token (ดึงออเดอร์ / อัปเดตออเดอร์)
app.get('/api/orders', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE is_deleted = false ORDER BY order_date DESC, created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders/:id/status', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT status FROM orders WHERE id=$1', [req.params.id]);
    res.json(result.rows[0] || { status: 'unknown' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/orders/:id/status', verifyToken, async (req, res) => {
  try {
    await pool.query('UPDATE orders SET status=$1 WHERE id=$2', [req.body.status, req.params.id]);
    res.json({ message: 'อัปเดตสถานะสำเร็จ' });
  } catch (err) { 
    console.error('🔥 STATUS UPDATE ERROR:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

app.put('/api/orders/:id', verifyToken, async (req, res) => {
  const { paid_amount, items } = req.body;
  try {
    await pool.query('UPDATE orders SET paid_amount=$1, items=$2 WHERE id=$3', [paid_amount, JSON.stringify(items), req.params.id]);
    res.json({ message: 'อัปเดตออเดอร์สำเร็จ' });
  } catch (err) { 
    console.error('🔥 ORDER UPDATE ERROR:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// 🔴 API ป้องกันด้วย Token + Admin (ตั้งค่าร้าน / การเงิน / ลบข้อมูล)
app.post('/api/store-status', verifyToken, requireAdmin, (req, res) => {
  try {
    const { isOpen } = req.body;
    if (isOpen === true || isOpen === false) {
      globalStoreStatus = isOpen;
      console.log(`🛎️ สถานะร้านเปลี่ยนเป็น: ${globalStoreStatus ? 'เปิด' : 'ปิด'}`);
      res.json({ message: 'อัปเดตสถานะร้านเรียบร้อย', isOpen: globalStoreStatus });
    } else { res.status(400).json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }); }
  } catch (error) { res.status(500).json({ error: "Cannot update store status" }); }
});

app.get('/api/finance', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM finance WHERE is_deleted = false ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/finance', verifyToken, requireAdmin, async (req, res) => {
  const { type, note, amount, slip_image } = req.body;
  try {
    await pool.query('INSERT INTO finance (type, note, amount, slip_image) VALUES ($1, $2, $3, $4)', [type, note, amount, slip_image]);
    res.json({ message: 'บันทึกสำเร็จ' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', verifyToken, requireAdmin, async (req, res) => {
  const { name, price, emoji, category } = req.body;
  const prodCategory = category || 'normal'; 
  try {
    await pool.query('INSERT INTO products (name, price, emoji, category) VALUES ($1, $2, $3, $4)', [name, price, emoji, prodCategory]);
    res.json({ message: 'เพิ่มสินค้าสำเร็จ' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params; 
  const { name, price, emoji, category } = req.body;
  const prodCategory = category || 'normal';
  try {
    await pool.query('UPDATE products SET name=$1, price=$2, emoji=$3, category=$4 WHERE id=$5', [name, price, emoji, prodCategory, id]);
    res.json({ message: 'แก้ไขสินค้าสำเร็จ' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', verifyToken, requireAdmin, async (req, res) => {
  try { await pool.query('UPDATE products SET is_deleted = true WHERE id=$1', [req.params.id]); res.json({ message: 'ย้ายลงถังขยะแล้ว' }); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/finance/:id', verifyToken, requireAdmin, async (req, res) => {
  try { await pool.query('UPDATE finance SET is_deleted = true WHERE id=$1', [req.params.id]); res.json({ message: 'ย้ายลงถังขยะแล้ว' }); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/orders/:id', verifyToken, requireAdmin, async (req, res) => {
  try { await pool.query('UPDATE orders SET is_deleted = true WHERE id=$1', [req.params.id]); res.json({ message: 'ย้ายลงถังขยะแล้ว' }); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/trash', verifyToken, requireAdmin, async (req, res) => {
  try {
    const products = await pool.query('SELECT id, name, price, emoji FROM products WHERE is_deleted = true');
    const finance = await pool.query("SELECT id, type, note, amount, TO_CHAR(created_at, 'DD/MM/YYYY') as date FROM finance WHERE is_deleted = true");
    const orders = await pool.query('SELECT id, customer_name, total_amount, paid_amount, order_date FROM orders WHERE is_deleted = true');
    res.json({ products: products.rows, finance: finance.rows, orders: orders.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/recover/:table/:id', verifyToken, requireAdmin, async (req, res) => {
  const { table, id } = req.params;
  const validTables = ['products', 'finance', 'orders'];
  if (!validTables.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  
  try {
    await pool.query(`UPDATE ${table} SET is_deleted = false WHERE id=$1`, [id]);
    res.json({ message: 'กู้คืนข้อมูลสำเร็จ' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 📍 แก้พอร์ต ให้ Render เป็นคนกำหนดให้ (ถ้าเทสในคอมจะเป็น 3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend ระดับ Production รันแล้วที่พอร์ต ${PORT}!`));