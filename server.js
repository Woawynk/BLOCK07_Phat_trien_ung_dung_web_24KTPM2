require('dotenv').config();
const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');

const dishesRouter = require('./routes/dishes');
const adminRouter = require('./routes/admin');
const authRouter = require('./routes/auth');
const { authMiddleware } = require('./middleware/auth');

const app = express();

// Thiết lập View Engine là EJS (SSR)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware xử lý URL-encoded data từ form HTML
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Middleware cookie & phiên làm việc
app.use(cookieParser(process.env.SESSION_SECRET || 'secret-key'));
app.use(authMiddleware);

// Middleware hỗ trợ method-override (?_method=PATCH hoặc ?_method=DELETE)
app.use(methodOverride('_method'));

// Middleware phục vụ static assets (CSS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Tuyến đường mặc định: Chuyển hướng về thực đơn món ăn
app.get('/', (req, res) => {
  res.redirect('/dishes');
});

// Cụm 0: Xác thực và tài khoản (Auth)
app.use('/auth', authRouter);

// Cụm 1: Dành cho người dùng xem thực đơn
app.use('/dishes', dishesRouter);

// Cụm 2: Dành cho quản trị viên (Admin CRUD - Được bảo vệ bằng requireManager)
app.use('/admin', adminRouter);

// Xử lý 404 Not Found khi không khớp bất kỳ route nào
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - Không Tìm Thấy',
    message: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.'
  });
});

// Xử lý lỗi tập trung 500 (Error Handling Middleware)
app.use((err, req, res, next) => {
  console.error('Lỗi hệ thống (Server Error):', err);
  res.status(500).render('500', {
    title: '500 - Lỗi Hệ Thống',
    message: 'Đã có lỗi xảy ra phía máy chủ. Vui lòng thử lại sau.'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` Server đang chạy tại: http://localhost:${PORT}`);
  console.log(` - Thực đơn khách hàng : http://localhost:${PORT}/dishes`);
  console.log(` - Trang quản trị     : http://localhost:${PORT}/admin`);
  console.log(`=================================================`);
});
