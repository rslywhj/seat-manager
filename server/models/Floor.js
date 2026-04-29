const mongoose = require('mongoose');

const floorSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: /^floor_[a-zA-Z0-9]+$/
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  canvasWidth: {
    type: Number,
    required: true,
    default: 1200,
    min: 100
  },
  canvasHeight: {
    type: Number,
    required: true,
    default: 800,
    min: 100
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'floors'
});

// 自动更新 updatedAt
floorSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Floor', floorSchema);
