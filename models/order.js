const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const orderItemSchema = new mongoose.Schema({
  product_id: { type: String, ref: 'Product', required: true },
  product_name: String,
  price: Number,
  quantity: Number,
  subtotal: Number
});

const orderSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  customer_id: { type: String, ref: 'Customer', required: true },
  total: { type: Number, required: true },
  status: { type: String, default: 'pending' },
  items: [orderItemSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

orderSchema.virtual('id').get(function () {
  return this._id;
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;