const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  floorId: {
    type: String,
    required: true,
    index: true
  },
  zoneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
    required: true,
    index: true
  },
  // ⭐ 关键字段：允许为 null（可选工位编号）
  seatNo: {
    type: String,
    default: null,
    // 如果不为 null，必须是 3 位数字
    validate: {
      validator: function(v) {
        if (v === null || v === undefined || v === '') {
          return true;
        }
        return /^\d{3}$/.test(v);
      },
      message: '工位号必须是 3 位数字或为空'
    }
  },
  globalIdx: {
    type: Number,
    required: true,
    min: 0
  },
  localIdx: {
    type: Number,
    required: true,
    min: 0
  },
  r: {
    type: Number,
    required: true,
    min: 0
  },
  c: {
    type: Number,
    required: true,
    min: 0
  },
  person: {
    name: {
      type: String,
      default: '',
      trim: true
    },
    dept: {
      type: String,
      default: '',
      trim: true
    },
    empId: {
      type: String,
      default: '',
      trim: true
    },
    phone: {
      type: String,
      default: '',
      trim: true
    },
    note: {
      type: String,
      default: '',
      trim: true
    }
  },
  // 网络接口信息
  network: {
    interfaceS: {
      type: String,
      default: '',
      trim: true
    },
    interfaceW: {
      type: String,
      default: '',
      trim: true
    },
    ipS: {
      type: String,
      default: '',
      trim: true
    },
    ipW: {
      type: String,
      default: '',
      trim: true
    }
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
  collection: 'seats'
});

// 创建索引以优化查询性能
seatSchema.index({ floorId: 1 });
seatSchema.index({ zoneId: 1 });
seatSchema.index({ floorId: 1, zoneId: 1 });
seatSchema.index({ globalIdx: 1 });
seatSchema.index({ seatNo: 1 }, { sparse: true }); // 稀疏索引以支持 null 值

// 自动更新 updatedAt 和版本号
seatSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // 如果文档被修改（非新建），增加版本号
  if (!this.isNew) {
    this.version += 1;
  }
  next();
});

module.exports = mongoose.model('Seat', seatSchema);
