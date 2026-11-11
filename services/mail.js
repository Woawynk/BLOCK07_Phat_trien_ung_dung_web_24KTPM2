const nodemailer = require('nodemailer');

function createTransporter() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return null;
}

/**
 * Gửi email mở khóa tài khoản khi nhập sai 5 lần
 */
async function sendUnlockEmail(toEmail, unlockLink) {
  const transporter = createTransporter();

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #dc2626;">⚠️ Cảnh báo bảo mật tài khoản</h2>
      <p>Xin chào,</p>
      <p>Tài khoản của bạn đã bị <strong>tạm khóa</strong> do phát hiện <strong>5 lần nhập sai mật khẩu</strong> liên tiếp.</p>
      <p>Để bảo vệ tài khoản và mở khóa lại (hoặc đổi mật khẩu mới), vui lòng nhấn vào liên kết bên dưới:</p>
      <div style="margin: 25px 0; text-align: center;">
        <a href="${unlockLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">
          🔓 Mở Khóa Tài Khoản
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px;">Hoặc copy liên kết sau vào trình duyệt: <br><a href="${unlockLink}">${unlockLink}</a></p>
      <p style="color: #ef4444; font-size: 13px;">* Liên kết này sẽ hết hạn sau 60 phút.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 12px; color: #94a3b8;">Bếp Việt Cuisine - Hệ thống bảo mật đăng nhập</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Bếp Việt Cuisine Security" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: '⚠️ [Bếp Việt] Tài khoản bị khóa do nhập sai mật khẩu 5 lần - Hướng dẫn mở khóa',
        html: htmlContent
      });
      console.log(`[EMAIL] Đã gửi thư mở khóa tài khoản tới: ${toEmail}`);
    } catch (err) {
      console.error('[EMAIL ERROR] Không thể gửi email qua SMTP:', err.message);
      console.log(`[LINK MỞ KHÓA DỰ PHÒNG]: ${unlockLink}`);
    }
  } else {
    // Nếu chưa cấu hình SMTP trong .env, in link ra console để dev test nhanh
    console.log(`\n======================================================`);
    console.log(`[DEV MODE - CHƯA CẤU HÌNH SMTP EMAIL]`);
    console.log(`Đã tạo link mở khóa cho email: ${toEmail}`);
    console.log(`Link mở khóa: ${unlockLink}`);
    console.log(`======================================================\n`);
  }
}

module.exports = {
  sendUnlockEmail
};
