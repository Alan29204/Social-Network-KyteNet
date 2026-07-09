import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
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
import { useLogin } from '@/features/auth/apis/auth-api';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { toast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useLogin();
  const setAuth = useAuthStore((state) => state.setAuth);

  const onSubmit = async (data: LoginFormValues) => {
    loginMutation.mutate(data, {
      onSuccess: (res) => {
        // res is wrapped by NestJS TransformInterceptor: { statusCode, message, data: { accessToken, user } }
        const payloadData = res.data || res;
        const token =
          payloadData.accessToken ||
          payloadData.access_token ||
          res.accessToken;
        const user = payloadData.user || res.user;
        setAuth(token, user);
        navigate(user?.role === 'admin' ? '/admin' : '/');
      },
      onError: (err) => {
        console.error('Login failed', err);
        const status = (err as any)?.response?.status;
        toast({
          title: status === 403 ? 'Tài khoản đã bị khóa' : 'Đăng nhập thất bại',
          description:
            status === 403
              ? 'Tài khoản của bạn đã bị khóa bởi quản trị viên.'
              : 'Vui lòng kiểm tra lại email và mật khẩu.',
          variant: 'destructive',
        });
      },
    });
  };

  const isLoading = loginMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-none border-border">
        <CardHeader className="space-y-1 items-center mb-4">
          <CardTitle className="text-4xl tracking-tight font-bold mb-4">
            KyteNet
          </CardTitle>
          <CardDescription> Đăng nhập để khám phá và kết nối. </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mật khẩu</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
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
            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-none border-border">
        <CardContent className="flex justify-center items-center py-6">
          <p className="text-sm">
            Bạn chưa có tài khoản?{' '}
            <Link
              to="/register"
              className="font-semibold text-primary hover:underline"
            >
              Đăng ký
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
