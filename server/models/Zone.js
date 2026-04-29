const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  floorId: {
    type: String,
    required: true,
    index: true
  },
  // 区域类型: seat=座位区域, function=功能区域(会议室、茶水间等)
  type: {
    type: String,
    enum: ['seat', 'function'],
    default: 'seat',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  x: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  y: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  width: {
    type: Number,
    required: true,
    default: 300,
    min: 10
  },
  height: {
    type: Number,
    required: true,
    default: 400,
    min: 10
  },
  // 以下字段仅对 type='seat' 有效
  count: {
    type: Number,
    default: null
  },
  rows: {
    type: Number,
    default: null
  },
  cols: {
    type: Number,
    default: null
  },
  order: {
    type: String,
    enum: [
      'row',
      'row-reverse',
      'snake',
      'snake-reverse',
      'col',
      'col-reverse',
      'col-snake',
      'row-desc',
      'row-reverse-desc',
      'snake-desc',
      'snake-reverse-desc',
      'col-desc',
      'col-reverse-desc',
      'col-snake-desc'
    ],
    default: 'row'
  },
  color: {
    type: String,
    default: '#6366f1',
    match: /^#[0-9A-Fa-f]{6}$/
  },
  // 区域图片（URL或base64）
  image: {
    type: String,
    default: null
  },
  // 版本号（用于乐观锁和增量同步）
  version: {
    type: Number,
    default: 1,
    min: 1
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
  collection: 'zones'
});

// 创建索引以优化查询
zoneSchema.index({ floorId: 1 });
zoneSchema.index({ floorId: 1, code: 1 }, { unique: true });

// 验证座位区域的必填字段
zoneSchema.pre('validate', function(next) {
  // 如果是座位区域，验证count/rows/cols必须>=1
  if (this.type === 'seat') {
    const errors = [];

    if (this.count == null || this.count < 1) {
      errors.push('座位区域的工位数必须≥1');
    }

    if (this.rows == null || this.rows < 1) {
      errors.push('座位区域的行数必须≥1');
    }

    if (this.cols == null || this.cols < 1) {
      errors.push('座位区域的列数必须≥1');
    }

    if (errors.length > 0) {
      const error = new Error(errors.join('; '));
      error.name = 'ValidationError';
      return next(error);
    }
  }

  next();
});

// 自动更新 updatedAt 和版本号
zoneSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // 如果文档被修改（非新建），增加版本号
  if (!this.isNew) {
    this.version += 1;
  }
  next();
});

module.exports = mongoose.model('Zone', zoneSchema);
