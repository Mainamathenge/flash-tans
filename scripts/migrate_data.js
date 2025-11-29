const sqlite3 = require('better-sqlite3');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const Product = require('../models/product');
const Customer = require('../models/customer');
const Order = require('../models/order');

const sqlitePath = process.env.DB_PATH || path.join(__dirname, '..', 'flash_tans.db');
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/flash_tans';

const migrate = async () => {
    console.log('Starting migration...');

    // Connect to SQLite
    const sqlite = new sqlite3(sqlitePath);
    console.log('Connected to SQLite');

    // Connect to MongoDB
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    try {
        // Clear existing data in MongoDB (optional, for safety in dev)
        // await Product.deleteMany({});
        // await Customer.deleteMany({});
        // await Order.deleteMany({});

        // Migrate Products
        const products = sqlite.prepare('SELECT * FROM products').all();
        console.log(`Found ${products.length} products in SQLite`);

        for (const p of products) {
            await Product.findOneAndUpdate(
                { _id: p.id },
                {
                    _id: p.id,
                    name: p.name,
                    price: p.price,
                    description: p.description,
                    image: p.image,
                    stock: p.stock,
                    created_at: p.created_at,
                    updated_at: p.updated_at
                },
                { upsert: true, new: true }
            );
        }
        console.log('Products migrated');

        // Migrate Customers
        const customers = sqlite.prepare('SELECT * FROM customers').all();
        console.log(`Found ${customers.length} customers in SQLite`);

        for (const c of customers) {
            await Customer.findOneAndUpdate(
                { _id: c.id },
                {
                    _id: c.id,
                    name: c.name,
                    email: c.email,
                    address: c.address,
                    created_at: c.created_at
                },
                { upsert: true, new: true }
            );
        }
        console.log('Customers migrated');

        // Migrate Orders
        const orders = sqlite.prepare('SELECT * FROM orders').all();
        console.log(`Found ${orders.length} orders in SQLite`);

        for (const o of orders) {
            // Get items for this order
            const items = sqlite.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);

            const orderItems = items.map(item => ({
                product_id: item.product_id,
                product_name: item.product_name,
                price: item.price,
                quantity: item.quantity,
                subtotal: item.subtotal
            }));

            await Order.findOneAndUpdate(
                { _id: o.id },
                {
                    _id: o.id,
                    customer_id: o.customer_id,
                    total: o.total,
                    status: o.status,
                    items: orderItems,
                    created_at: o.created_at
                },
                { upsert: true, new: true }
            );
        }
        console.log('Orders migrated');

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        sqlite.close();
        await mongoose.disconnect();
        process.exit(0);
    }
};

migrate();
