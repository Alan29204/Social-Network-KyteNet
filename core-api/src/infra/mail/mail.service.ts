import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type OtpPurpose = 'register' | 'reset';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private resolved = false;

  constructor(private readonly configService: ConfigService) {}

  /** Khởi tạo transporter từ cấu hình SMTP (lazy, chỉ 1 lần). */
  private getTransporter(): Transporter | null {
    if (this.resolved) return this.transporter;
    this.resolved = true;

    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP chưa được cấu hình (SMTP_HOST/USER/PASS). OTP sẽ chỉ hiển thị ở log/dev.',
      );
      this.transporter = null;
      return null;
    }

    const port = Number(this.configService.get<string>('SMTP_PORT')) || 587;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = SSL, còn lại STARTTLS
      auth: { user, pass },
    });
    return this.transporter;
  }

  get isConfigured(): boolean {
    return !!this.getTransporter();
  }

  /**
   * Gửi email chứa mã OTP. Trả về true nếu đã gửi qua SMTP thật.
   * Nếu chưa cấu hình SMTP, chỉ ghi log (để dev dùng dev_*_code).
   */
  async sendOtp(
    to: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn(`[DEV] OTP cho ${to} (${purpose}): ${code}`);
      return false;
    }

    const from =
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('SMTP_USER');

    const title =
      purpose === 'register'
        ? 'Xác thực đăng ký tài khoản Snet'
        : 'Đặt lại mật khẩu Snet';
    const intro =
      purpose === 'register'
        ? 'Cảm ơn bạn đã đăng ký Snet. Hãy dùng mã OTP dưới đây để xác thực email của bạn:'
        : 'Bạn vừa yêu cầu đặt lại mật khẩu. Hãy dùng mã OTP dưới đây để tiếp tục:';

    try {
      await transporter.sendMail({
        from: `"Snet" <${from}>`,
        to,
        subject: `${title} - Mã OTP: ${code}`,
        html: this.buildOtpHtml(title, intro, code),
        text: `${intro}\n\nMã OTP: ${code}\nMã có hiệu lực trong 10 phút.`,
      });
      return true;
    } catch (err) {
      this.logger.error(`Gửi email OTP tới ${to} thất bại`, err as Error);
      // Không chặn luồng nghiệp vụ vì lỗi gửi mail; dev vẫn có dev code.
      return false;
    }
  }

  private buildOtpHtml(title: string, intro: string, code: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
        <h2 style="color: #7c3aed; margin: 0 0 16px;">Snet</h2>
        <h3 style="margin: 0 0 12px;">${title}</h3>
        <p style="color: #444; line-height: 1.5;">${intro}</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; background: #f5f3ff; color: #6d28d9; padding: 16px; border-radius: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #888; font-size: 13px;">Mã có hiệu lực trong 10 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
      </div>
    `;
  }
}
