const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const prisma = require('../db');
const { supabase, supabaseAnon } = require('../services/supabase');
const { sendUnlockEmail } = require('../services/mail');

// ============================================================================
// 1. TRANG ĐĂNG KÝ (REGISTER)
// ============================================================================

// GET /auth/register
router.get('/register', (req, res) => {
  res.render('auth/register', {
    title: 'Đăng Ký Tài Khoản',
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
    errors: [],
    formData: { username: '', email: '', dob: '' }
  });
});

// POST /auth/register
router.post('/register', async (req, res, next) => {
  const { username, email, password, dob, handsome_owner, 'cf-turnstile-response': captchaToken } = req.body;
  const errors = [];

  // Kiểm tra checkbox bắt buộc: "Chủ cửa hàng đẹp trai"
  if (handsome_owner !== 'yes') {
    errors.push('Bạn bắt buộc phải xác nhận "Chủ cửa hàng đẹp trai" để hoàn tất đăng ký!');
  }

  // Kiểm tra các trường dữ liệu
  if (!username || username.trim().length < 3) {
    errors.push('Tên đăng nhập phải có ít nhất 3 ký tự.');
  }
  if (!email || !email.includes('@')) {
    errors.push('Địa chỉ email không hợp lệ.');
  }
  if (!password || password.length < 6) {
    errors.push('Mật khẩu phải có tối thiểu 6 ký tự.');
  }
  if (!dob) {
    errors.push('Vui lòng chọn ngày sinh (Day of birth).');
  }

  // Kiểm tra Captcha nếu có cấu hình Turnstile Secret Key
  if (process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SECRET_KEY.trim() !== '') {
    if (!captchaToken) {
      errors.push('Vui lòng hoàn thành xác thực Captcha.');
    } else {
      try {
        const captchaVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${encodeURIComponent(process.env.TURNSTILE_SECRET_KEY)}&response=${encodeURIComponent(captchaToken)}`
        }).then(r => r.json());

        if (!captchaVerify.success) {
          errors.push('Xác thực Captcha không hợp lệ hoặc đã hết hạn.');
        }
      } catch (err) {
        console.warn('Lỗi khi kiểm tra Turnstile Captcha:', err.message);
      }
    }
  }

  if (errors.length > 0) {
    return res.render('auth/register', {
      title: 'Đăng Ký Tài Khoản',
      turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
      errors,
      formData: { username, email, dob }
    });
  }

  try {
    // 1. Kiểm tra username hoặc email đã tồn tại trong database chưa
    const existing = await prisma.profile.findFirst({
      where: {
        OR: [
          { username: username.trim() },
          { email: email.trim().toLowerCase() }
        ]
      }
    });

    if (existing) {
      return res.render('auth/register', {
        title: 'Đăng Ký Tài Khoản',
        turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
        errors: [existing.username === username.trim() ? 'Tên đăng nhập đã được sử dụng.' : 'Email đã được đăng ký.'],
        formData: { username, email, dob }
      });
    }

    // 2. Đăng ký tài khoản trên Supabase Auth
    // Supabase tự động mã hóa Bcrypt mật khẩu và gửi email xác thực chống tài khoản ảo
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: password,
      options: {
        data: {
          username: username.trim(),
          dob: dob
        },
        emailRedirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/auth/login`
      }
    });

    if (authError) {
      return res.render('auth/register', {
        title: 'Đăng Ký Tài Khoản',
        turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
        errors: [authError.message],
        formData: { username, email, dob }
      });
    }

    const userId = authData.user?.id || crypto.randomUUID();

    // 3. Lưu thông tin hồ sơ người dùng vào cơ sở dữ liệu
    await prisma.profile.create({
      data: {
        id: userId,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        dob: new Date(dob),
        role: email.trim().toLowerCase() === (process.env.MANAGER_EMAIL || '').toLowerCase() ? 'manager' : 'user'
      }
    });

    return res.render('auth/info', {
      title: 'Đăng Ký Thành Công',
      type: 'success',
      heading: '🎉 Đăng ký tài khoản thành công!',
      message: `Hệ thống đã gửi một liên kết xác thực tới email <strong>${email}</strong>.<br>Vui lòng mở hộp thư và nhấn vào liên kết xác thực để kích hoạt tài khoản trước khi đăng nhập.`,
      actionText: 'Đến Trang Đăng Nhập',
      actionUrl: '/auth/login'
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 2. TRANG ĐĂNG NHẬP (LOGIN) & KHÓA SAU 5 LẦN SAI
// ============================================================================

// GET /auth/login
router.get('/login', (req, res) => {
  res.render('auth/login', {
    title: 'Đăng Nhập',
    errors: [],
    identifier: '',
    redirectUrl: req.query.redirect || ''
  });
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  const { identifier, password, redirectUrl } = req.body;
  const trimmedId = (identifier || '').trim();

  if (!trimmedId || !password) {
    return res.render('auth/login', {
      title: 'Đăng Nhập',
      errors: ['Vui lòng nhập đầy đủ Tên đăng nhập / Email và Mật khẩu.'],
      identifier: trimmedId,
      redirectUrl
    });
  }

  try {
    // 1. Tìm hồ sơ profile tương ứng bằng username hoặc email
    const profile = await prisma.profile.findFirst({
      where: {
        OR: [
          { username: trimmedId },
          { email: trimmedId.toLowerCase() }
        ]
      }
    });

    // 2. Kiểm tra xem tài khoản có đang bị khóa (sau 5 lần sai) không
    if (profile && profile.isLocked) {
      return res.render('auth/login', {
        title: 'Tài Khoản Bị Khóa',
        errors: [
          'Tài khoản này đã bị KHÓA do nhập sai mật khẩu 5 lần liên tiếp. ' +
          'Vui lòng kiểm tra email của bạn để lấy đường link mở khóa hoặc đặt lại mật khẩu.'
        ],
        identifier: trimmedId,
        redirectUrl
      });
    }

    // 3. Chuẩn bị email để xác thực với Supabase
    const authEmail = profile ? profile.email : trimmedId;

    // 4. Thử đăng nhập qua Supabase Auth (kiểm tra mật khẩu bcrypt)
    const { data: sessionData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: authEmail,
      password: password
    });

    // Nếu đăng nhập THẤT BẠI (sai mật khẩu hoặc chưa xác thực email)
    if (authError) {
      // Nếu email chưa được xác thực
      if (authError.message.toLowerCase().includes('email not confirmed')) {
        return res.render('auth/login', {
          title: 'Đăng Nhập',
          errors: ['Email của bạn chưa được xác nhận. Vui lòng kiểm tra hộp thư để kích hoạt tài khoản.'],
          identifier: trimmedId,
          redirectUrl
        });
      }

      // Xử lý cơ chế nhập sai mật khẩu cho tài khoản có trong hệ thống
      if (profile) {
        const newAttempts = profile.failedLoginAttempts + 1;

        if (newAttempts >= 5) {
          // Đã đủ 5 lần sai -> Khóa tài khoản & tạo mã mở khóa
          const unlockToken = crypto.randomBytes(32).toString('hex');
          const tokenExpires = new Date(Date.now() + 60 * 60 * 1000); // Có hiệu lực 60 phút

          await prisma.profile.update({
            where: { id: profile.id },
            data: {
              failedLoginAttempts: newAttempts,
              isLocked: true,
              unlockToken: unlockToken,
              unlockTokenExpires: tokenExpires
            }
          });

          // Tạo link mở khóa
          const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
          const unlockLink = `${baseUrl}/auth/unlock?token=${unlockToken}`;

          // Gửi email thông báo mở khóa
          await sendUnlockEmail(profile.email, unlockLink);

          return res.render('auth/login', {
            title: 'Tài Khoản Bị Khóa',
            errors: [
              '⚠️ Bạn đã nhập sai mật khẩu 5 lần. Tài khoản của bạn đã bị KHÓA. ' +
              `Hệ thống đã gửi một email tới ${profile.email} kèm liên kết để mở khóa tài khoản.`
            ],
            identifier: trimmedId,
            redirectUrl
          });
        } else {
          // Chưa tới 5 lần -> Tăng biến đếm và thông báo số lần còn lại
          await prisma.profile.update({
            where: { id: profile.id },
            data: { failedLoginAttempts: newAttempts }
          });

          const remaining = 5 - newAttempts;
          return res.render('auth/login', {
            title: 'Đăng Nhập',
            errors: [`Mật khẩu không chính xác. Bạn còn ${remaining} lần thử trước khi tài khoản bị khóa!`],
            identifier: trimmedId,
            redirectUrl
          });
        }
      }

      return res.render('auth/login', {
        title: 'Đăng Nhập',
        errors: ['Tài khoản hoặc mật khẩu không chính xác.'],
        identifier: trimmedId,
        redirectUrl
      });
    }

    // 5. Đăng nhập THÀNH CÔNG -> Reset số lần đăng nhập sai về 0
    if (profile) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          failedLoginAttempts: 0,
          isLocked: false,
          unlockToken: null,
          unlockTokenExpires: null
        }
      });
    }

    // 6. Lưu thông tin đăng nhập vào Cookie
    const userPayload = {
      id: sessionData.user.id,
      email: sessionData.user.email,
      username: profile ? profile.username : sessionData.user.email.split('@')[0],
      role: profile ? profile.role : 'user'
    };

    res.cookie('user_session', JSON.stringify(userPayload), {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
    });

    // Chuyển hướng tới trang mong muốn hoặc trang chủ
    const targetUrl = redirectUrl && redirectUrl.startsWith('/') ? redirectUrl : '/dishes';
    res.redirect(targetUrl);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 3. MỞ KHÓA TÀI KHOẢN QUA LINK EMAIL
// ============================================================================

// GET /auth/unlock
router.get('/unlock', async (req, res, next) => {
  const { token } = req.query;

  if (!token) {
    return res.render('auth/info', {
      title: 'Mở Khóa Thất Bại',
      type: 'error',
      heading: 'Lỗi Mở Khóa',
      message: 'Mã mở khóa không hợp lệ.',
      actionText: 'Về Trang Đăng Nhập',
      actionUrl: '/auth/login'
    });
  }

  try {
    const profile = await prisma.profile.findFirst({
      where: {
        unlockToken: token,
        unlockTokenExpires: { gt: new Date() }
      }
    });

    if (!profile) {
      return res.render('auth/info', {
        title: 'Liên Kết Hết Hạn',
        type: 'error',
        heading: 'Liên kết không hợp lệ hoặc đã hết hạn',
        message: 'Đường link mở khóa này không tồn tại hoặc đã quá hạn 60 phút. Nếu bạn vẫn bị khóa, hãy sử dụng tính năng "Quên mật khẩu" để lấy lại quyền truy cập.',
        actionText: 'Quên Mật Khẩu',
        actionUrl: '/auth/forgot-password'
      });
    }

    // Mở khóa và reset số lần sai
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        isLocked: false,
        failedLoginAttempts: 0,
        unlockToken: null,
        unlockTokenExpires: null
      }
    });

    res.render('auth/info', {
      title: 'Mở Khóa Thành Công',
      type: 'success',
      heading: '🔓 Tài khoản của bạn đã được mở khóa!',
      message: `Tài khoản <strong>${profile.username}</strong> (${profile.email}) đã được kích hoạt lại bình thường. Bạn có thể đăng nhập ngay hoặc đổi mật khẩu mới để tăng cường bảo mật.`,
      actionText: 'Đăng Nhập Ngay',
      actionUrl: '/auth/login'
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 4. QUÊN MẬT KHẨU (FORGOT PASSWORD)
// ============================================================================

// GET /auth/forgot-password
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', {
    title: 'Quên Mật Khẩu',
    errors: [],
    email: ''
  });
});

// POST /auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  const { email, handsome_owner } = req.body;
  const errors = [];

  // Yêu cầu tích chọn checkbox "Chủ cửa hàng đẹp trai"
  if (handsome_owner !== 'yes') {
    errors.push('Bạn bắt buộc phải tích chọn "Chủ cửa hàng đẹp trai" trước khi yêu cầu đổi mật khẩu!');
  }

  if (!email || !email.includes('@')) {
    errors.push('Vui lòng nhập địa chỉ email hợp lệ.');
  }

  if (errors.length > 0) {
    return res.render('auth/forgot-password', {
      title: 'Quên Mật Khẩu',
      errors,
      email: email || ''
    });
  }

  try {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${baseUrl}/auth/reset-password`
    });

    if (resetError) {
      return res.render('auth/forgot-password', {
        title: 'Quên Mật Khẩu',
        errors: [resetError.message],
        email
      });
    }

    res.render('auth/info', {
      title: 'Đã Gửi Hướng Dẫn',
      type: 'success',
      heading: '📧 Đã gửi liên kết đặt lại mật khẩu!',
      message: `Chúng tôi đã gửi một email tới <strong>${email}</strong>. Vui lòng kiểm tra hộp thư và làm theo hướng dẫn để tạo mật khẩu mới.`,
      actionText: 'Về Trang Đăng Nhập',
      actionUrl: '/auth/login'
    });
  } catch (err) {
    next(err);
  }
});

// GET /auth/reset-password
router.get('/reset-password', (req, res) => {
  res.render('auth/reset-password', {
    title: 'Đặt Lại Mật Khẩu',
    errors: []
  });
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  const { password, confirmPassword } = req.body;
  if (!password || password.length < 6) {
    return res.render('auth/reset-password', {
      title: 'Đặt Lại Mật Khẩu',
      errors: ['Mật khẩu mới phải có ít nhất 6 ký tự.']
    });
  }
  if (password !== confirmPassword) {
    return res.render('auth/reset-password', {
      title: 'Đặt Lại Mật Khẩu',
      errors: ['Mật khẩu xác nhận không khớp.']
    });
  }

  try {
    // Cập nhật mật khẩu trên Supabase
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return res.render('auth/reset-password', {
        title: 'Đặt Lại Mật Khẩu',
        errors: [error.message]
      });
    }

    res.render('auth/info', {
      title: 'Đổi Mật Khẩu Thành Công',
      type: 'success',
      heading: '✅ Đặt lại mật khẩu thành công!',
      message: 'Mật khẩu của bạn đã được cập nhật. Bạn có thể sử dụng mật khẩu mới để đăng nhập.',
      actionText: 'Đăng Nhập Ngay',
      actionUrl: '/auth/login'
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 5. ĐĂNG XUẤT (LOGOUT)
// ============================================================================
router.get('/logout', (req, res) => {
  res.clearCookie('user_session');
  res.redirect('/auth/login');
});

module.exports = router;
