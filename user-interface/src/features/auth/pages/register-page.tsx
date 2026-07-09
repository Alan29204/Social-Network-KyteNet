import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRegister, useSendRegisterOtp } from '@/features/auth/apis/auth-api';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

const registerSchema = z
  .object({
    email: z.string().email('Email không hợp lệ'),
    full_name: z
      .string()
      .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
      .max(50, 'Họ và tên không được vượt quá 50 ký tự'),
    username: z
      .string()
      .min(2, 'Tên người dùng phải có ít nhất 2 ký tự')
      .max(20, 'Tên người dùng không được vượt quá 20 ký tự'),
    birthday: z.string().min(1, 'Vui lòng chọn ngày sinh'),
    gender: z.enum(['male', 'female', 'other'], {
      message: 'Vui lòng chọn giới tính',
    }),
    password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [payload, setPayload] = useState<Omit<
    RegisterFormValues,
    'confirmPassword'
  > | null>(null);
  const [otp, setOtp] = useState('');

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const sendOtpMutation = useSendRegisterOtp();
  const registerMutation = useRegister();

  // Bước 1: validate form -> gửi OTP -> sang bước nhập OTP
  const onSubmitForm = (data: RegisterFormValues) => {
    const { confirmPassword, ...rest } = data;
    void confirmPassword;
    sendOtpMutation.mutate(
      { email: data.email, username: data.username },
      {
        onSuccess: (res: any) => {
          setPayload(rest);
          setStep('otp');
          void res;
          toast({
            title: 'Đã gửi mã OTP',
            description: 'Vui lòng kiểm tra email để lấy mã xác thực.',
          });
        },
        onError: (err: any) => {
          toast({
            title: 'Không gửi được mã',
            description:
              err?.response?.data?.message ||
              'Email có thể đã tồn tại hoặc dữ liệu chưa hợp lệ.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  // Bước 2: gửi OTP + thông tin -> tạo tài khoản
  const onVerifyOtp = () => {
    if (!payload || otp.length !== 6) return;
    registerMutation.mutate(
      { ...payload, otp },
      {
        onSuccess: () => {
          toast({
            title: 'Đăng ký thành công',
            description: 'Vui lòng đăng nhập để tiếp tục.',
          });
          navigate('/login');
        },
        onError: (err: any) => {
          toast({
            title: 'Xác thực thất bại',
            description:
              err?.response?.data?.message ||
              'Mã OTP không đúng hoặc đã hết hạn.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleResendOtp = () => {
    if (!payload) return;
    sendOtpMutation.mutate(
      { email: payload.email, username: payload.username },
      {
        onSuccess: (res: any) => {
          void res;
          toast({
            title: 'Đã gửi lại mã OTP',
            description: 'Kiểm tra email của bạn.',
          });
        },
      },
    );
  };

  if (step === 'otp') {
    return (
      <Card className="shadow-none border-border">
        <CardHeader className="space-y-1 items-center mb-2 text-center">
          <CardTitle className="text-3xl tracking-tight font-bold mb-2">
            Xác thực email
          </CardTitle>
          <CardDescription>
            Nhập mã OTP gồm 6 số đã gửi tới{' '}
            <span className="font-medium text-foreground">
              {payload?.email}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            autoFocus
            inputMode="numeric"
            maxLength={6}
            placeholder="______"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            onKeyDown={(e) => e.key === 'Enter' && onVerifyOtp()}
            className="text-center text-2xl tracking-[0.5em] font-semibold"
          />
          <Button
            onClick={onVerifyOtp}
            disabled={otp.length !== 6 || registerMutation.isPending}
            className="w-full"
          >
            {registerMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Xác nhận & Đăng ký'
            )}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={sendOtpMutation.isPending}
              className="font-medium text-primary hover:underline disabled:opacity-50"
            >
              Gửi lại mã
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-none border-border">
        <CardHeader className="space-y-1 items-center mb-4 text-center">
          <CardTitle className="text-4xl tracking-tight font-bold mb-4">
            KyteNet
          </CardTitle>
          <CardDescription>
            Đăng ký để kết nối và chia sẻ với cộng đồng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Họ và tên</Label>
              <Input
                id="full_name"
                placeholder="Nguyễn Văn A"
                {...register('full_name')}
              />
              {errors.full_name && (
                <p className="text-xs text-destructive">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Tên người dùng</Label>
              <Input
                id="username"
                placeholder="nguyenvana"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-xs text-destructive">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="birthday">Ngày sinh</Label>
                <Input id="birthday" type="date" {...register('birthday')} />
                {errors.birthday && (
                  <p className="text-xs text-destructive">
                    {errors.birthday.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Giới tính</Label>
                <Controller
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Chọn" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Nam</SelectItem>
                        <SelectItem value="female">Nữ</SelectItem>
                        <SelectItem value="other">Khác</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.gender && (
                  <p className="text-xs text-destructive">
                    {errors.gender.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="text-xs text-muted-foreground text-center pt-2">
              Bằng cách đăng ký, bạn đồng ý với Điều khoản, Chính sách dữ liệu
              và Chính sách cookie của chúng tôi.
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              disabled={sendOtpMutation.isPending}
            >
              {sendOtpMutation.isPending ? 'Đang gửi mã...' : 'Tiếp tục'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-none border-border">
        <CardContent className="flex justify-center items-center py-6">
          <p className="text-sm">
            Bạn đã có tài khoản?{' '}
            <Link
              to="/login"
              className="font-semibold text-primary hover:underline"
            >
              Đăng nhập
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
