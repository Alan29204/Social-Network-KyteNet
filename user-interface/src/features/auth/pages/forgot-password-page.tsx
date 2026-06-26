import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  useForgotPassword,
  useResetPassword,
} from '@/features/auth/apis/auth-api';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

type Step = 'email' | 'otp' | 'password';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const forgotMutation = useForgotPassword();
  const resetMutation = useResetPassword();

  // Bước 1: nhập email -> gửi OTP
  const handleSendEmail = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Email không hợp lệ', variant: 'destructive' });
      return;
    }
    forgotMutation.mutate(email, {
      onSuccess: (res: any) => {
        setStep('otp');
        const devCode = res?.data?.dev_reset_code || res?.dev_reset_code;
        toast({
          title: 'Đã gửi mã OTP',
          description: devCode
            ? `Mã xác thực (dev): ${devCode}`
            : 'Nếu email tồn tại, mã xác thực đã được gửi tới hộp thư của bạn.',
        });
      },
      onError: () =>
        toast({
          title: 'Có lỗi xảy ra',
          description: 'Vui lòng thử lại sau.',
          variant: 'destructive',
        }),
    });
  };

  // Bước 2: nhập OTP (xác thực thực sự ở bước đặt mật khẩu)
  const handleVerifyOtp = () => {
    if (code.length !== 6) return;
    setStep('password');
  };

  // Bước 3: đặt mật khẩu mới
  const handleResetPassword = () => {
    if (newPassword.length < 8) {
      toast({
        title: 'Mật khẩu phải có ít nhất 8 ký tự',
        variant: 'destructive',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Mật khẩu xác nhận không khớp', variant: 'destructive' });
      return;
    }
    resetMutation.mutate(
      { email, reset_code: code, new_password: newPassword },
      {
        onSuccess: () => {
          toast({
            title: 'Đặt lại mật khẩu thành công',
            description: 'Vui lòng đăng nhập bằng mật khẩu mới.',
          });
          navigate('/login');
        },
        onError: (err: any) => {
          toast({
            title: 'Đặt lại mật khẩu thất bại',
            description:
              err?.response?.data?.message ||
              'Mã OTP không đúng hoặc đã hết hạn.',
            variant: 'destructive',
          });
          setStep('otp');
        },
      },
    );
  };

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="space-y-1 items-center mb-2 text-center">
        <CardTitle className="text-3xl tracking-tight font-bold mb-2">
          Quên mật khẩu
        </CardTitle>
        <CardDescription>
          {step === 'email' && 'Nhập email để nhận mã xác thực.'}
          {step === 'otp' && `Nhập mã OTP 6 số đã gửi tới ${email}.`}
          {step === 'password' && 'Tạo mật khẩu mới cho tài khoản của bạn.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'email' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoFocus
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendEmail()}
              />
            </div>
            <Button
              onClick={handleSendEmail}
              disabled={forgotMutation.isPending}
              className="w-full"
            >
              {forgotMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Gửi mã xác thực'
              )}
            </Button>
          </>
        )}

        {step === 'otp' && (
          <>
            <Input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              placeholder="______"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
              className="text-center text-2xl tracking-[0.5em] font-semibold"
            />
            <Button
              onClick={handleVerifyOtp}
              disabled={code.length !== 6}
              className="w-full"
            >
              Tiếp tục
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" /> Đổi email
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={forgotMutation.isPending}
                className="font-medium text-primary hover:underline disabled:opacity-50"
              >
                Gửi lại mã
              </button>
            </div>
          </>
        )}

        {step === 'password' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="new_password">Mật khẩu mới</Label>
              <Input
                id="new_password"
                type="password"
                autoFocus
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Xác nhận mật khẩu</Label>
              <Input
                id="confirm_password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
              />
            </div>
            <Button
              onClick={handleResetPassword}
              disabled={resetMutation.isPending}
              className="w-full"
            >
              {resetMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Đặt lại mật khẩu'
              )}
            </Button>
          </>
        )}

        <div className="text-center text-sm pt-2">
          <Link
            to="/login"
            className="font-medium text-primary hover:underline"
          >
            Quay lại đăng nhập
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
