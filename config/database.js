const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

// Use a temporary database file (or :memory: for in-memory)
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'flash_tans.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Helper function to execute queries (for compatibility with existing code)
const execute = async (query, params = []) => {
  const stmt = db.prepare(query);
  
  // Check if it's a SELECT query
  if (query.trim().toUpperCase().startsWith('SELECT')) {
    return [stmt.all(params)];
  } else {
    // For INSERT, UPDATE, DELETE
    const result = stmt.run(params);
    return [{ affectedRows: result.changes, insertId: result.lastInsertRowid }];
  }
};

// Helper for getting a single row
const getOne = async (query, params = []) => {
  const stmt = db.prepare(query);
  return stmt.get(params);
};

// Helper for getting all rows
const getAll = async (query, params = []) => {
  const stmt = db.prepare(query);
  return stmt.all(params);
};

// Helper for running queries (INSERT, UPDATE, DELETE)
const run = async (query, params = []) => {
  const stmt = db.prepare(query);
  return stmt.run(params);
};

// Create a pool-like object for compatibility
const pool = {
  execute,
  getConnection: async () => {
    return {
      execute,
      beginTransaction: async () => {
        db.exec('BEGIN TRANSACTION');
      },
      commit: async () => {
        db.exec('COMMIT');
      },
      rollback: async () => {
        db.exec('ROLLBACK');
      },
      release: () => {}
    };
  }
};

// Initialize database and tables
const initDatabase = async () => {
  try {
    // Create products table
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT,
        image TEXT DEFAULT '/images/placeholder.jpg',
        stock INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create customers table
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create orders table
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        total REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `);

    // Create order_items table
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        product_id TEXT,
        product_name TEXT,
        price REAL,
        quantity INTEGER,
        subtotal REAL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    // Create trigger to update updated_at timestamp
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
      AFTER UPDATE ON products
      BEGIN
        UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);

    // Insert sample products if table is empty
    const countResult = db.prepare('SELECT COUNT(*) as count FROM products').get();
    if (countResult.count === 0) {
      const sampleProducts = [
        {
          id: '1',
          name: 'Buckets',
          price: 29.99,
          description: 'Amazon S3 Buckets for scalable storage',
          stock: 50
        },
        {
          id: '2',
          name: 'Load Balancers',
          price: 34.99,
          description: 'Customizable load balancers for your applications',
          stock: 30
        },
        {
          id: '3',
          name: 'Microsoft Azure',
          price: 24.99,
          description: 'Cloud computing services for building, testing, and deploying applications',
          stock: 25
        }
      ];

      const insertStmt = db.prepare(
        'INSERT INTO products (id, name, price, description, stock) VALUES (?, ?, ?, ?, ?)'
      );

      for (const product of sampleProducts) {
        insertStmt.run(product.id, product.name, product.price, product.description, product.stock);
      }
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

module.exports = { pool, db, initDatabase, execute, getOne, getAll, run };
