CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    pin_code VARCHAR(10) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    emoji VARCHAR(10),
    category VARCHAR(20) DEFAULT 'normal', -- 📍 คอลัมน์หมวดหมู่
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE finance (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL,
    note TEXT,
    amount DECIMAL(10,2) NOT NULL,
    slip_image TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    slip_image TEXT,
    items TEXT,
    order_date DATE DEFAULT CURRENT_DATE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 👥 ข้อมูลผู้ใช้งานระบบ
-- ==========================================
INSERT INTO users (name, pin_code, role) VALUES 
('วงศกร (Admin)', '9999', 'admin'),
('แม่', '1111', 'admin'),
('พ่อ', '2222', 'manager'),
('พี่ชาย', '3333', 'staff');

-- ==========================================
-- 🍌 ข้อมูลจำลอง เมนูสินค้า (รวม 20 รายการ)
-- ==========================================
INSERT INTO products (name, price, emoji, category) VALUES 
-- 🏪 หมวดหมู่: สินค้าหน้าร้าน (normal)
('กล้วยทอด', 20, '🍌', 'normal'),
('มันทอด', 20, '🍠', 'normal'),
('เผือกทอด', 20, '🥔', 'normal'),
('ฟักทองทอด', 20, '🎃', 'normal'),
('ข้าวเม่าทอด', 20, '🍘', 'normal'),
('ไข่นกกระทา (เหลือง)', 20, '🥚', 'normal'),
('ไข่นกกระทา (มันม่วง)', 20, '🟣', 'normal'),
('กล้วยตากทอด', 30, '🍌', 'normal'),
('มันรังนกทอด', 30, '🍠', 'normal'),
('ข้าวโพดทอด', 20, '🌽', 'normal'),

-- 🎁 หมวดหมู่: เมนูจัดเลี้ยง (event)
('กล้วยทอด', 50, '🍌', 'event'),
('มันทอด', 50, '🍠', 'event'),
('เผือกทอด', 50, '🥔', 'event'),
('ฟักทองทอด', 50, '🎃', 'event'),
('ข้าวเม่าทอด', 50, '🍘', 'event'),
('ไข่นกกระทา (เหลือง)', 50, '🥚', 'event'),
('ไข่นกกระทา (มันม่วง)', 50, '🟣', 'event'),
('กล้วยตากทอด', 50, '🍌', 'event'),
('มันรังนกทอด', 50, '🍠', 'event'),
('ข้าวโพดทอด', 50, '🌽', 'event');

-- ==========================================
-- 💸 ข้อมูลจำลอง รายจ่าย (20 รายการ สุ่มย้อนหลัง 7 วัน)
-- ==========================================
INSERT INTO finance (type, note, amount, created_at)
SELECT 
    'expense',
    (ARRAY['🛢️ ค่าแก๊ส', '🍌 วัตถุดิบ (กล้วย/มัน)', '🌾 เครื่องปรุง (แป้ง/น้ำตาล/น้ำมัน)', '🛍️ ถุง/แพ็กเกจ', '🛵 ค่าเดินทาง'])[floor(random() * 5 + 1)::INT],
    (floor(random() * 5 + 2)::INT) * 100, 
    CURRENT_TIMESTAMP - (floor(random() * 7)::INT || ' days')::INTERVAL
FROM generate_series(1, 20);

-- ==========================================
-- 🛒 ข้อมูลจำลอง ออเดอร์หน้าร้าน (50 รายการ)
-- ==========================================
INSERT INTO orders (customer_name, total_amount, paid_amount, status, items, order_date, created_at)
SELECT 
    (ARRAY['ลูกค้าหน้าร้าน', 'พี่สมชาย', 'ป้าน้อย', 'ลุงชัย', 'ลูกค้าหน้าร้าน'])[floor(random() * 5 + 1)::INT],
    amt,
    amt, 
    'completed',
    '[{"name": "กล้วยทอด", "price": ' || (amt / 2) || '}, {"name": "มันทอด", "price": ' || (amt / 2) || '}]',
    CURRENT_DATE - floor(random() * 7)::INT,
    CURRENT_TIMESTAMP - (floor(random() * 7)::INT || ' days')::INTERVAL
FROM (
    SELECT (floor(random() * 4 + 2)::INT) * 20 AS amt 
    FROM generate_series(1, 50)
) as sub;

-- ==========================================
-- 📱 ข้อมูลจำลอง ออเดอร์ออนไลน์ (50 รายการ)
-- ==========================================
INSERT INTO orders (customer_name, total_amount, paid_amount, status, items, order_date, created_at)
SELECT 
    (ARRAY['คุณเอก', 'คุณบี', 'คุณนัท', 'คุณจอย', 'คุณฟ้า'])[floor(random() * 5 + 1)::INT] || ' 📞08' || floor(random() * 8999999 + 10000000)::INT::TEXT || ' (ออนไลน์) ' || pay_type,
    amt,
    CASE WHEN pay_type = '[เก็บปลายทาง]' THEN 0 ELSE amt END, 
    (ARRAY['pending', 'cooking', 'completed', 'completed', 'completed', 'cancelled'])[floor(random() * 6 + 1)::INT],
    '[{"name": "ข้าวเม่าทอด", "price": ' || (amt - 20) || '}, {"name": "ไข่นกกระทา (เหลือง)", "price": 20}]',
    CURRENT_DATE - floor(random() * 7)::INT,
    CURRENT_TIMESTAMP - (floor(random() * 7)::INT || ' days')::INTERVAL
FROM (
    SELECT 
        (floor(random() * 5 + 3)::INT) * 20 AS amt, 
        (ARRAY['[พร้อมเพย์]', '[TrueWallet]', '[เก็บปลายทาง]'])[floor(random() * 3 + 1)::INT] AS pay_type
    FROM generate_series(1, 50)
) as sub;

-- ==========================================
-- 🎁 ข้อมูลจำลอง ออเดอร์จัดเลี้ยง (50 รายการ)
-- ==========================================
INSERT INTO orders (customer_name, total_amount, paid_amount, status, items, order_date, created_at)
SELECT 
    (ARRAY['บจก. ก้าวหน้า', 'คุณหญิง', 'โรงเรียนวัด', 'เทศบาล', 'กลุ่มแม่บ้าน'])[floor(random() * 5 + 1)::INT] || ' 📞09' || floor(random() * 8999999 + 10000000)::INT::TEXT || ' [จัดเลี้ยง: ' || (ARRAY['งานทำบุญ/งานบวช', 'ประชุม/สัมมนา', 'อื่นๆ'])[floor(random() * 3 + 1)::INT] || ']',
    amt,
    CASE WHEN floor(random() * 2)::INT = 0 THEN amt ELSE amt / 2 END, 
    (ARRAY['pending', 'cooking', 'completed', 'completed'])[floor(random() * 4 + 1)::INT],
    '[{"name": "🎁 [จัดเลี้ยง] ให้ร้านคละขนมรวมทุกอย่าง", "price": ' || amt || '}, {"name": "📅 เวลารับ: ' || to_char(CURRENT_DATE + floor(random() * 10)::INT, 'YYYY-MM-DD') || ' 10:00", "price": 0}]',
    CURRENT_DATE - floor(random() * 7)::INT,
    CURRENT_TIMESTAMP - (floor(random() * 7)::INT || ' days')::INTERVAL
FROM (
    SELECT (floor(random() * 10 + 5)::INT) * 100 AS amt 
    FROM generate_series(1, 50)
) as sub;
-- ==========================================
-- 📦 ข้อมูลจำลอง เมนูสินค้าฝากขาย (20 รายการ)
-- ==========================================
INSERT INTO products (name, price, emoji, category) VALUES 
('ถั่วต้ม', 20, '🥜', 'consignment'),
('พริกทอด', 40, '🌶️', 'consignment'),
('แคบหมู', 20, '🥓', 'consignment'),
('กล้วยฉาบ', 20, '🍌', 'consignment'),
('กล้วยเบรคแตก', 20, '🍌', 'consignment'),
('เผือกเส้นทอด', 20, '🥔', 'consignment'),
('ฟักทองเส้นทอด', 20, '🎃', 'consignment'),
('มันแครอททอด', 20, '🍠', 'consignment'),
('ขนมผิง', 20, '🍘', 'consignment'),
('มะขามคลุก', 30, '🫘', 'consignment'),
('หมูยอทอด', 30, '🐷', 'consignment'),
('ปลาหมึกกรอบ', 40, '🦑', 'consignment'),
('ทาโร่', 20, '🐟', 'consignment'),
('หนังปลากรอบ', 30, '🐟', 'consignment'),
('ขนมปังกระเทียม', 20, '🍞', 'consignment'),
('ป๊อปคอร์นคาราเมล', 30, '🍿', 'consignment'),
('มันฝรั่งทอด', 20, '🍟', 'consignment'),
('ข้าวเกรียบปลา', 20, '🍘', 'consignment'),
('ถั่วปากอ้า', 20, '🥜', 'consignment'),
('ลูกเกดทอด', 30, '🍇', 'consignment');

-- ==========================================
-- 🏬 ข้อมูลจำลอง ออเดอร์ฝากขาย (50 รายการ)
-- ==========================================
INSERT INTO orders (customer_name, total_amount, paid_amount, status, items, order_date, created_at)
SELECT 
    -- 1. สุ่มชื่อร้านค้า
    '[ฝากขาย] ' || (ARRAY['ร้านป้าน้อย', 'ร้านลุงชัย', 'ร้านกาแฟปากซอย', 'ร้านเจ๊จู', 'สหกรณ์หมู่บ้าน', 'มินิมาร์ทหน้าปากซอย'])[floor(random() * 6 + 1)::INT],
    
    -- 2. คำนวณมูลค่ารวม (จำนวนที่ส่งไป * ราคา)
    (qty1 * price1) + (qty2 * price2) AS total_amount,
    
    -- 3. คำนวณยอดเงินที่เก็บได้จริง (หักของคืนเฉพาะบิลที่ completed)
    CASE WHEN order_status = 'completed' 
         THEN ((qty1 - ret1) * price1) + ((qty2 - ret2) * price2) 
         ELSE 0 
    END AS paid_amount,
    
    -- 4. สถานะบิล (pending = รอเก็บเงิน, completed = เก็บเงินแล้ว, cancelled = ยกเลิก)
    order_status AS status,
    
    -- 5. สร้าง JSON เก็บรายละเอียดสินค้า (ถ้า completed ให้ยัด returnQty เข้าไปยอดของที่คืนด้วย)
    '[' || 
        '{"name": "' || item1_name || '", "qty": ' || qty1 || ', "price": ' || price1 || ', "emoji": "📦"' ||
        CASE WHEN order_status = 'completed' THEN ', "returnQty": ' || ret1 ELSE '' END || '}, ' ||
        '{"name": "' || item2_name || '", "qty": ' || qty2 || ', "price": ' || price2 || ', "emoji": "📦"' ||
        CASE WHEN order_status = 'completed' THEN ', "returnQty": ' || ret2 ELSE '' END || '}' ||
    ']' AS items,
    
    -- 6. สุ่มวันที่ย้อนหลัง (0-14 วัน)
    CURRENT_DATE - floor(random() * 14)::INT,
    CURRENT_TIMESTAMP - (floor(random() * 14)::INT || ' days')::INTERVAL
FROM (
    -- Subquery สำหรับสุ่มตัวแปรต่างๆ ให้แต่ละบิล
    SELECT 
        (ARRAY['pending', 'pending', 'pending', 'completed', 'completed', 'cancelled'])[floor(random() * 6 + 1)::INT] AS order_status,
        (ARRAY['ถั่วต้ม', 'พริกทอด', 'แคบหมู', 'กล้วยฉาบ', 'ทาโร่'])[floor(random() * 5 + 1)::INT] AS item1_name,
        (ARRAY['เผือกเส้นทอด', 'ฟักทองเส้นทอด', 'ขนมผิง', 'มะขามคลุก', 'ป๊อปคอร์นคาราเมล'])[floor(random() * 5 + 1)::INT] AS item2_name,
        (floor(random() * 4 + 1)::INT) * 5 AS qty1, -- สุ่มจำนวน 5, 10, 15, 20 ถุง
        (floor(random() * 4 + 1)::INT) * 5 AS qty2, -- สุ่มจำนวน 5, 10, 15, 20 ถุง
        20 AS price1,
        30 AS price2,
        floor(random() * 3)::INT AS ret1, -- สุ่มของคืน 0, 1, 2 ถุง
        floor(random() * 4)::INT AS ret2  -- สุ่มของคืน 0, 1, 2, 3 ถุง
    FROM generate_series(1, 50)
) as sub;