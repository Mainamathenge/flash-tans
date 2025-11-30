const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const { initDatabase } = require('./config/database');
const Product = require('./models/product');
const Customer = require('./models/customer');
const Order = require('./models/order');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static('public'));

initDatabase();

// Prometheus Metrics
const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 5, 15, 50, 100, 500]
});

// ================= API: GET PRODUCTS =================
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ created_at: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ================= API: CREATE PRODUCT ===============
app.post('/api/products', async (req, res) => {
  try {
    const { name, price, description, stock } = req.body;

    if (!name || !price || !description || stock === undefined) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const newProduct = await Product.create({ name, price, description, stock });
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// ================= API: DELETE PRODUCT ===============
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);

    if (!deleted) {
      const deletedByCustomId = await Product.findOneAndDelete({ id: id });
      if (!deletedByCustomId) {
        return res.status(404).json({ error: 'Product not found' });
      }
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ================= API: CREATE ORDER =================
app.post('/api/orders', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, customerInfo } = req.body;

    if (!items || !items.length || !customerInfo) {
      return res.status(400).json({ error: 'Items and customer info are required' });
    }

    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: `Product ${item.productId} not found` });
      }

      if (product.stock < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }

      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      orderItems.push({
        product_id: product._id,
        product_name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: itemTotal
      });

      product.stock -= item.quantity;
      await product.save({ session });
    }

    const customer = new Customer(customerInfo);
    await customer.save({ session });

    const order = new Order({
      customer_id: customer._id,
      total,
      items: orderItems
    });
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json(order);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ================= API: GET ORDERS ===================
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().populate('customer_id').sort({ created_at: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ================== ERROR HANDLING ===================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: 'Something went wrong!' });
});

// ================== 404 HANDLER =====================
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
});

// ================= START SERVER =====================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Flash Tans server running on 0.0.0.0:${PORT}`);
});