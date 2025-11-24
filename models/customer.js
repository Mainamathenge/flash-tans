const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Customer {
  static async create(customerData) {
    try {
      const id = uuidv4();
      const { name, email, address } = customerData;
      
      await pool.execute(
        'INSERT INTO customers (id, name, email, address) VALUES (?, ?, ?, ?)',
        [id, name, email, address]
      );
      
      return id;
    } catch (error) {
      throw error;
    }
  }

  static async getById(id) {
    try {
      const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [id]);
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Customer;