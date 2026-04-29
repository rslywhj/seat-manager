/**
 * 全局错误处理中间件
 */

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  console.error(`[ERROR] ${statusCode} - ${message}`, err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: '数据验证失败',
      errors: messages
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = err.keyPattern ? Object.keys(err.keyPattern)[0] : 'unknown';
    const value = err.keyValue ? err.keyValue[field] : '';
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: `${field} "${value}" 已存在，请使用不同的值`
    });
  }

  // Cast error (invalid MongoDB ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: '无效的资源 ID'
    });
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message
  });
};

module.exports = {
  AppError,
  errorHandler
};
