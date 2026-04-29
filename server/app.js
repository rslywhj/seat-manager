/**
 * Express Application Entry Point
 * D座8层 数字孪生工位管理系统 - 后端服务
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { connectDB } = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const websocketService = require('./services/websocketService');

// 路由模块
const floorsRouter = require('./routes/floors');
const zonesRouter = require('./routes/zones');
const seatsRouter = require('./routes/seats');

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_PREFIX = process.env.API_PREFIX || '/api';

// 创建 HTTP 服务器用于 WebSocket
const server = http.createServer(app);

// 初始化 Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

// 初始化 WebSocket 服务
websocketService.initialize(io);

// ==================== 中间件 ====================

// CORS 配置
const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Body parser
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务（上传的图片）
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== 路由 ====================

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: '工位管理系统 API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// API 路由
app.use(`${API_PREFIX}/floors`, floorsRouter);

// 嵌套路由：zones 和 seats 属于 floors
app.use(`${API_PREFIX}/floors/:floorId/zones`, zonesRouter);
app.use(`${API_PREFIX}/floors/:floorId/seats`, seatsRouter);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: '请求的资源不存在'
  });
});

// ==================== 错误处理 ====================
app.use(errorHandler);

// ==================== 启动服务器 ====================

const startServer = async () => {
  try {
    // 连接数据库
    await connectDB();

    // 启动服务器（使用 HTTP 服务器而非 Express.listen）
    server.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════╗
║   工位管理系统 API 服务已启动                 ║
║   Server: http://localhost:${PORT}            ║
║   API: http://localhost:${PORT}${API_PREFIX}          ║
║   WebSocket: ws://localhost:${PORT}            ║
║   Health: http://localhost:${PORT}/health    ║
║   MongoDB: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/floor-db'} ║
╚═══════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('启动失败:', error.message);
    process.exit(1);
  }
};

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM 信号，关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('收到 SIGINT 信号，关闭服务器...');
  process.exit(0);
});

// 启动
if (require.main === module) {
  startServer();
}

module.exports = app;
