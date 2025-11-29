const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const productSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  image: { type: String, default: '/images/placeholder.jpg' },
  stock: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for id to match existing API expectations if needed
productSchema.virtual('id').get(function () {
  return this._id;
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;