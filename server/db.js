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
        location_code VARCHAR(100) NULL,
        purchase_unit VARCHAR(50) DEFAULT 'Box',
        unit_multiplier INT DEFAULT 1,
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
    try {
      await connection.query(`ALTER TABLE products ADD COLUMN location_code VARCHAR(100) NULL`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE products ADD COLUMN purchase_unit VARCHAR(50) DEFAULT 'Box'`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE products ADD COLUMN unit_multiplier INT DEFAULT 1`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE batches MODIFY COLUMN stock_type VARCHAR(50) DEFAULT 'belum_bayar'`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE batches ADD COLUMN dp_amount DECIMAL(10, 2) NULL`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE batches ADD COLUMN due_date DATE NULL`);
    } catch (e) {}

    await connection.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        total_amount DECIMAL(10, 2) NOT NULL,
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_method VARCHAR(50) DEFAULT 'cash',
        midtrans_order_id VARCHAR(255) NULL,
        payment_status VARCHAR(50) DEFAULT 'pending',
        user_id INT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        type ENUM('aktiva', 'pasiva', 'modal', 'pendapatan', 'beban') NOT NULL,
        normal_balance ENUM('debit', 'kredit') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NULL,
        date DATE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS journal_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        journal_entry_id INT NOT NULL,
        account_id INT NOT NULL,
        debit DECIMAL(15, 2) DEFAULT 0,
        credit DECIMAL(15, 2) DEFAULT 0,
        FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
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

    // Batches table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS batches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        supplier_id INT NULL,
        batch_number VARCHAR(100) NULL,
        stock_type VARCHAR(50) DEFAULT 'belum_bayar',
        purchase_date DATE NULL,
        initial_quantity INT NOT NULL DEFAULT 0,
        remaining_quantity INT NOT NULL DEFAULT 0,
        cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        expired_date DATE NULL,
        dp_amount DECIMAL(10, 2) NULL,
        due_date DATE NULL,
        image_url VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
      )
    `);
    
    try {
      await connection.query(`ALTER TABLE batches ADD COLUMN image_url VARCHAR(255) NULL`);
    } catch (e) {}


    // Prescriptions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        prescription_code VARCHAR(100) NULL,
        image_url VARCHAR(255) NULL,
        prescription_date DATE NULL,
        entered_by INT NULL,
        transaction_id INT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entered_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
      )
    `);

    // Purchases table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        supplier_id INT NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        down_payment DECIMAL(10, 2) DEFAULT 0,
        remaining_debt DECIMAL(10, 2) DEFAULT 0,
        payment_status ENUM('dp', 'hutang', 'cicilan', 'lunas') DEFAULT 'hutang',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
      )
    `);

    // Purchase items table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_id INT NOT NULL,
        product_id INT NOT NULL,
        batch_id INT NULL,
        quantity INT NOT NULL,
        cost_price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL
      )
    `);

    // Purchase payments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchase_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_method VARCHAR(50) DEFAULT 'cash',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
      )
    `);

    // Queues table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS queues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NOT NULL,
        queue_number INT NOT NULL,
        status ENUM('menunggu', 'diproses', 'siap', 'selesai') DEFAULT 'menunggu',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value VARCHAR(255)
      )
    `);

    // Audit trails table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_trails (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        username VARCHAR(255) NULL,
        role VARCHAR(50) NULL,
        module VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        description TEXT,
        ip_address VARCHAR(50) NULL,
        user_agent TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_user (user_id),
        INDEX idx_audit_created_at (created_at),
        INDEX idx_audit_module (module),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
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
    try {
      await connection.query(`ALTER TABLE transactions ADD COLUMN user_id INT NULL`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE transactions ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL`);
    } catch (e) {}

    // Seed Chart of Accounts
    const [accountCount] = await connection.query('SELECT COUNT(*) as count FROM accounts');
    if (accountCount[0].count === 0) {
      const accounts = [
        { code: '101', name: 'Kas', type: 'aktiva', normal_balance: 'debit' },
        { code: '102', name: 'Bank', type: 'aktiva', normal_balance: 'debit' },
        { code: '110', name: 'Persediaan Barang', type: 'aktiva', normal_balance: 'debit' },
        { code: '120', name: 'Piutang Usaha', type: 'aktiva', normal_balance: 'debit' },
        { code: '201', name: 'Hutang Usaha', type: 'pasiva', normal_balance: 'kredit' },
        { code: '301', name: 'Modal Awal', type: 'modal', normal_balance: 'kredit' },
        { code: '310', name: 'Laba Ditahan', type: 'modal', normal_balance: 'kredit' },
        { code: '311', name: 'Laba Tahun Berjalan', type: 'modal', normal_balance: 'kredit' },
        { code: '401', name: 'Penjualan', type: 'pendapatan', normal_balance: 'kredit' },
        { code: '402', name: 'Diskon Penjualan', type: 'pendapatan', normal_balance: 'debit' },
        { code: '410', name: 'Pendapatan Selisih Stok', type: 'pendapatan', normal_balance: 'kredit' },
        { code: '501', name: 'Harga Pokok Penjualan', type: 'beban', normal_balance: 'debit' },
        { code: '510', name: 'Beban Gaji', type: 'beban', normal_balance: 'debit' },
        { code: '520', name: 'Beban Sewa', type: 'beban', normal_balance: 'debit' },
        { code: '530', name: 'Beban Listrik', type: 'beban', normal_balance: 'debit' },
        { code: '540', name: 'Beban Selisih Stok', type: 'beban', normal_balance: 'debit' },
        { code: '590', name: 'Beban Lain-lain', type: 'beban', normal_balance: 'debit' },
      ];
      for (const acc of accounts) {
        await connection.query('INSERT INTO accounts (code, name, type, normal_balance) VALUES (?, ?, ?, ?)',
          [acc.code, acc.name, acc.type, acc.normal_balance]);
      }
      console.log('Chart of accounts seeded');
    } else {
      // Add missing accounts if they don't exist
      const missingAccounts = [
        { code: '311', name: 'Laba Tahun Berjalan', type: 'modal', normal_balance: 'kredit' },
        { code: '410', name: 'Pendapatan Selisih Stok', type: 'pendapatan', normal_balance: 'kredit' },
        { code: '540', name: 'Beban Selisih Stok', type: 'beban', normal_balance: 'debit' },
      ];
      for (const acc of missingAccounts) {
        const [existing] = await connection.query('SELECT id FROM accounts WHERE code = ?', [acc.code]);
        if (existing.length === 0) {
          await connection.query('INSERT INTO accounts (code, name, type, normal_balance) VALUES (?, ?, ?, ?)',
            [acc.code, acc.name, acc.type, acc.normal_balance]);
          console.log(`Added missing account: ${acc.code} - ${acc.name}`);
        }
      }
    }

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
          'INSERT INTO products (name, stock, cost_price, selling_price, unit, expired_date, category, purchase_unit, unit_multiplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [p.name, p.stock, p.cost, selling, p.unit, p.expired, 'Medicine', 'Box', 1]
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
