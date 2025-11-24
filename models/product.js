const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Product {
  static async getAll() {
    try {
      const [rows] = await pool.execute('SELECT * FROM products ORDER BY created_at DESC');
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async getById(id) {
    try {
      const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [id]);
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async create(productData) {
    try {
      const id = uuidv4();
      const { name, price, description, stock } = productData;
      
      await pool.execute(
        'INSERT INTO products (id, name, price, description, stock) VALUES (?, ?, ?, ?, ?)',
        [id, name, parseFloat(price), description, parseInt(stock)]
      );
      
      return await this.getById(id);
    } catch (error) {
      throw error;
    }
  }

  static async update(id, productData) {
    try {
      const { name, price, description, stock } = productData;
      
      await pool.execute(
        'UPDATE products SET name = ?, price = ?, description = ?, stock = ? WHERE id = ?',
        [name, parseFloat(price), description, parseInt(stock), id]
      );
      
      return await this.getById(id);
    } catch (error) {
      throw error;
    }
  }

  static async delete(id) {
    try {
      const [result] = await pool.execute('DELETE FROM products WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  static async updateStock(id, quantity) {
    try {
      await pool.execute(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [quantity, id]
      );
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Product;