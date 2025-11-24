const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./config/database');
const Product = require('./models/product');
const Customer = require('./models/customer');
const Order = require('./models/order');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');


// Initialize database
initDatabase();

// Routes
app.get('/', async (req, res) => {
  try {
    const products = await Product.getAll();
    res.render('index', { products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).render('error', { message: 'Failed to load products' });
  }
});

app.get('/admin', async (req, res) => {
  try {
    const products = await Product.getAll();
    const orders = await Order.getAll();
    res.render('admin', { products, orders });
  } catch (error) {
    console.error('Error loading admin data:', error);
    res.status(500).render('error', { message: 'Failed to load admin data' });
  }
});

app.get('/cart', (req, res) => {
  res.render('cart');
});

// API Routes
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.getAll();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

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

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.delete(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { items, customerInfo } = req.body;
    
    if (!items || !items.length || !customerInfo) {
      return res.status(400).json({ error: 'Items and customer info are required' });
    }

    // Verify products and calculate total
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.getById(item.productId);
      if (!product) {
        return res.status(404).json({ error: `Product ${item.productId} not found` });
      }
      
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }

      const itemTotal = product.price * item.quantity;
      total += itemTotal;
      
      orderItems.push({
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: itemTotal
      });
    }

    // Create customer
    const customerId = await Customer.create(customerInfo);

    // Create order
    const newOrder = await Order.create({
      customerId,
      total,
      items: orderItems
    });

    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.getAll();
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
});

app.listen(PORT, () => {
  console.log(`Flash Tans server running on port ${PORT}`);
});