const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'skripsi',
  ...(process.env.DB_SOCKET_PATH && { socketPath: process.env.DB_SOCKET_PATH }),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const initDB = async () => {
  try {
    const connection = await pool.getConnection();
    


    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        code_expires_at TIMESTAMP NOT NULL,
        verified_at TIMESTAMP NULL,
        reset_token_hash VARCHAR(255) NULL,
        reset_token_expires_at TIMESTAMP NULL,
        used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_password_reset_email (email),
        INDEX idx_password_reset_code_expires (code_expires_at),
        INDEX idx_password_reset_token_expires (reset_token_expires_at)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_id INT NOT NULL,
        module VARCHAR(100) NOT NULL,
        action ENUM('create','edit','delete','show') NOT NULL,
        allowed TINYINT(1) DEFAULT 0,
        UNIQUE KEY unique_role_perm (role_id, module, action),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        stock INT DEFAULT 0,
        price DECIMAL(10, 2) DEFAULT 0,
        unit VARCHAR(50),
        expired_date DATE,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      const [emailCols] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email'`
      );
      if (Array.isArray(emailCols) && emailCols.length === 0) {
        await connection.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL`);
      }

      await connection.query(
        `UPDATE users SET email = CONCAT('user', id, '@example.com')
         WHERE email IS NULL OR email = ''`
      );

      try {
        await connection.query(`ALTER TABLE users MODIFY email VARCHAR(255) NOT NULL`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE users ADD UNIQUE KEY unique_users_email (email)`);
      } catch (e) {}
    } catch (e) {}

    try {
      await connection.query(`ALTER TABLE products CHANGE price cost_price DECIMAL(10, 2) DEFAULT 0`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE products ADD COLUMN selling_price DECIMAL(10, 2) DEFAULT 0`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE products ADD COLUMN unit VARCHAR(50)`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE products ADD COLUMN expired_date DATE`);
    } catch (e) {}

    await connection.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        total_amount DECIMAL(10, 2) NOT NULL,
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_method VARCHAR(50) DEFAULT 'cash',
        midtrans_order_id VARCHAR(255) NULL,
        payment_status VARCHAR(50) DEFAULT 'pending'
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS stock_forecasts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        source VARCHAR(50) NOT NULL DEFAULT 'db',
        source_end_date DATE NULL,
        lead_time INT NOT NULL,
        window_size INT NOT NULL,
        metode VARCHAR(20) NOT NULL,
        alasan_fallback VARCHAR(100) NULL,
        kebutuhan_7_hari INT NOT NULL,
        perkiraan_penjualan_per_hari DECIMAL(12, 6) NOT NULL,
        tambahan_stok INT NOT NULL,
        satuan VARCHAR(50) NULL,
        debug_prompt TEXT NULL,
        debug_response TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_stock_forecasts_product_created (product_id, created_at),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    
    try {
      await connection.query(`ALTER TABLE stock_forecasts ADD COLUMN debug_prompt TEXT NULL`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE stock_forecasts ADD COLUMN debug_response TEXT NULL`);
    } catch (e) {}

    await connection.query(`
      CREATE TABLE IF NOT EXISTS forecast_jobs (
        job_key VARCHAR(50) PRIMARY KEY,
        last_run_at TIMESTAMP NULL,
        last_status VARCHAR(20) NULL,
        last_error VARCHAR(255) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        type ENUM('sale', 'restock', 'opname', 'adjustment') NOT NULL,
        quantity_change INT NOT NULL,
        previous_stock INT NOT NULL,
        new_stock INT NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value VARCHAR(255)
      )
    `);

    const [settings] = await connection.query('SELECT * FROM system_settings');
    if (settings.length === 0) {
      await connection.query(`
        INSERT INTO system_settings (setting_key, setting_value) VALUES 
        ('ppn_rate', '0'),
        ('discount_rate', '0')
      `);
      console.log('Seeded system settings');
    }

    try {
      await connection.query(`ALTER TABLE transactions ADD COLUMN tax_amount DECIMAL(10, 2) DEFAULT 0`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE transactions ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE transactions ADD COLUMN subtotal DECIMAL(10, 2) DEFAULT 0`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE transactions ADD COLUMN payment_method VARCHAR(50) DEFAULT 'cash'`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE transactions ADD COLUMN midtrans_order_id VARCHAR(255) NULL`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE transactions ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending'`);
    } catch (e) {}

    try {
      await connection.query(`ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'`);
    } catch (e) {}

    const [suppliers] = await connection.query('SELECT * FROM suppliers');
    if (suppliers.length === 0) {
      const supplierNames = [
        'PT. Intan Surya Prima Abadi',
        'PT. Buana Saraswati',
        'PT. Budhi Kurniawan Sejati',
        'PT. JAVAS BALI LESTARI',
        'PT. SAKAJAJA MAKMUR ABADI',
        'PT. Mulia Abdi Sentosa',
        'PT. SEHAT INTI PERMATA',
        'PT. SAPTA SARI TAMA',
        'PT. Marga Nusantara Jaya',
        'PT. AMARA PERKASA MEDIKA'
      ];

      for (const name of supplierNames) {
        await connection.query(
          'INSERT INTO suppliers (name, contact_person, phone, address) VALUES (?, ?, ?, ?)',
          [name, 'John Doe', '08123456789', 'Jl. Supplier No. 1']
        );
      }
      console.log('Seeded suppliers');
    }

    const [validProducts] = await connection.query('SELECT * FROM products WHERE BINARY name = ? AND expired_date IS NOT NULL', ['Sanmol Tab']);
    if (validProducts.length === 0) {
      console.log('Seeding new medicine products and transactions...');
      
      await connection.query('DELETE FROM products');
      await connection.query('DELETE FROM transactions');
      
      const newProducts = [
        { name: 'Sanmol Tab', stock: 28, expired: '2027-05-01', cost: 2008, unit: 'STRIP' },
        { name: 'Paracetamol Tab', stock: 35, expired: '2029-05-01', cost: 1859, unit: 'STRIP' },
        { name: 'Imboost Force Kaplet', stock: 22, expired: '2028-02-01', cost: 6238, unit: 'KAPLET' },
        { name: 'Vicee Orange', stock: 48, expired: '2027-03-01', cost: 646, unit: 'TABLET' },
        { name: 'Amlodipine 5mg Tab', stock: 18, expired: '2027-01-06', cost: 2558, unit: 'STRIP' },
        { name: 'Cetirizine 10 mg Tab', stock: 20, expired: '2027-04-01', cost: 2470, unit: 'STRIP' },
        { name: 'Paramex Tab', stock: 15, expired: '2027-01-04', cost: 2344, unit: 'STRIP' },
        { name: 'Enervon C', stock: 14, expired: '2027-03-30', cost: 4609, unit: 'STRIP' },
        { name: 'Ambroxol Tab', stock: 24, expired: '2028-06-01', cost: 1207, unit: 'STRIP' },
        { name: 'Metformin Tab', stock: 19, expired: '2027-04-01', cost: 2173, unit: 'STRIP' },
        { name: 'Demacolin Tab', stock: 32, expired: '2028-11-01', cost: 5200, unit: 'STRIP' },
        { name: 'Tera-F Tab', stock: 12, expired: '2028-03-01', cost: 4520, unit: 'STRIP' },
        { name: 'Fasidol Tab', stock: 18, expired: '2029-06-01', cost: 2890, unit: 'STRIP' },
        { name: 'Hufagripp Flu', stock: 5, expired: '2028-04-01', cost: 21770, unit: 'BOTOL' },
        { name: 'Kool Fever Anak', stock: 9, expired: '2027-12-01', cost: 5947, unit: 'SACHET' },
        { name: 'Test Pack One Med', stock: 11, expired: '2028-01-01', cost: 1520, unit: 'STRIP' },
        { name: 'Caviplex Tab', stock: 16, expired: '2027-01-08', cost: 6934, unit: 'STRIP' },
        { name: 'Micoral Cr', stock: 13, expired: '2028-05-01', cost: 4460, unit: 'TUBE' },
        { name: 'Ketokonazole Cr', stock: 7, expired: '2027-06-01', cost: 5100, unit: 'TUBE' },
        { name: 'Sutra Ok 3 S', stock: 21, expired: '2029-10-01', cost: 7414, unit: 'STRIP' }
      ];

      for (const p of newProducts) {
        const margin = 1.25;
        let selling = Math.ceil((p.cost * margin) / 100) * 100;
        
        await connection.query(
          'INSERT INTO products (name, stock, cost_price, selling_price, unit, expired_date, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [p.name, p.stock, p.cost, selling, p.unit, p.expired, 'Medicine']
        );
      }
      console.log('Seeded new medicine products');

      console.log('Seeding December 2025 transactions...');
       
      for (let day = 1; day <= 31; day++) {
        const numTrans = Math.floor(Math.random() * 5) + 1;
         
        for (let i = 0; i < numTrans; i++) {
          const amount = Math.floor(Math.random() * (500000 - 50000 + 1)) + 50000;
           
          const date = new Date(2025, 11, day, Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60), 0);
           
          await connection.query(
            'INSERT INTO transactions (total_amount, transaction_date) VALUES (?, ?)',
            [amount, date]
          );
        }
      }
      console.log('Seeded transactions for Dec 2025');
    }

    const [cashiers] = await connection.query('SELECT * FROM users WHERE role = ?', ['cashier']);
    if (cashiers.length === 0) {
      const pwd = await bcrypt.hash('123456', 10);
      await connection.query(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        ['kasir1', 'kasir1@example.com', pwd, 'cashier']
      );
      await connection.query(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        ['kasir2', 'kasir2@example.com', pwd, 'cashier']
      );
      await connection.query(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        ['kasir3', 'kasir3@example.com', pwd, 'cashier']
      );
      console.log('Seeded cashiers');
    }

    const [users] = await connection.query('SELECT * FROM users WHERE username = ?', ['superadmin']);
    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      try {
        await connection.query(
          'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
          ['superadmin', 'superadmin@example.com', hashedPassword, 'superadmin']
        );
        console.log('Superadmin created: superadmin / password123');
      } catch (insertError) {
        if (insertError.code === 'ER_DUP_ENTRY') {
          console.log('Superadmin already exists (handled race condition)');
        } else {
          throw insertError;
        }
      }
    }

    try {
      await connection.query("UPDATE role_permissions SET module = 'Peramalan Stok' WHERE module = 'Recommendations Stock'");
      await connection.query("UPDATE role_permissions SET module = 'Management Pengguna' WHERE module = 'Management Cashier'");
    } catch (e) {
      console.log('Migration of module names skipped or failed:', e.message);
    }

    console.log('Database initialized: tables ready');
    connection.release();
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
};

module.exports = {
  pool,
  initDB
};
