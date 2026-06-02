import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const profileSchema = z.object({
  username: z.string().min(2, 'Tên người dùng phải có ít nhất 2 ký tự').max(20, 'Tên người dùng không vượt quá 20 ký tự'),
  bio: z.string().max(100, 'Tiểu sử không vượt quá 100 ký tự').optional().or(z.literal('')),
  website: z.string().max(100).optional().or(z.literal('')),
  birthday: z.string().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  address: z.string().max(100).optional().or(z.literal('')),
  privacy: z.enum(['public', 'private', 'follower']).optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function EditProfilePage() {
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: userProfile, isLoading, isError } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const response = await orvalClient<{ data: any }>({
        method: 'GET',
        url: `/users/${user?.id}`,
      });
      return response.data;
    },
    enabled: !!user?.id,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: '',
      bio: '',
      website: '',
      birthday: '',
      gender: 'male',
      address: '',
      privacy: 'public',
    },
  });

  const bioValue = form.watch('bio') || '';

  useEffect(() => {
    if (userProfile) {
      form.reset({
        username: userProfile.username || '',
        bio: userProfile.bio || '',
        website: userProfile.website || '',
        birthday: userProfile.birthday ? new Date(userProfile.birthday).toISOString().split('T')[0] : '',
        gender: userProfile.gender || 'male',
        address: userProfile.address || '',
        privacy: userProfile.privacy || 'public',
      });
    }
  }, [userProfile, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      setIsSubmitting(true);
      
      const payload: any = {
        username: data.username,
        bio: data.bio || undefined,
        website: data.website || undefined,
        birthday: data.birthday ? new Date(data.birthday).toISOString() : undefined,
        gender: data.gender || undefined,
        address: data.address || undefined,
        privacy: data.privacy || 'public',
      };

      await orvalClient({
        url: '/users/profile',
        method: 'PATCH',
        data: payload,
      });

      queryClient.invalidateQueries({ queryKey: ['usersControllerGetProfile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      
      updateUser({
        username: data.username,
        bio: data.bio || undefined,
      });
      
      navigate(`/profile/${user?.id}`);
    } catch (error) {
      console.error('Lỗi khi cập nhật:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Đang tải...</div>;
  if (isError) return <div className="p-8 text-center text-destructive">Lỗi tải dữ liệu</div>;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold mb-8">Chỉnh sửa thông tin cá nhân</h1>
      
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="username">Tên người dùng</Label>
          <Input id="username" {...form.register('username')} />
          {form.formState.errors.username && (
            <p className="text-sm text-destructive">{form.formState.errors.username.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Tiểu sử</Label>
          <Textarea id="bio" {...form.register('bio')} rows={3} maxLength={100} />
          <div className="flex justify-between mt-1">
            <div className="flex-1">
              {form.formState.errors.bio && (
                <p className="text-sm text-destructive">{form.formState.errors.bio.message}</p>
              )}
            </div>
            <div className="text-xs text-muted-foreground text-right">{bioValue.length}/100</div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Trang web</Label>
          <Input id="website" {...form.register('website')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birthday">Ngày sinh</Label>
          <Input id="birthday" type="date" {...form.register('birthday')} />
        </div>

        <div className="space-y-2">
          <Label>Giới tính</Label>
          <Select 
            value={form.watch('gender')} 
            onValueChange={(value) => form.setValue('gender', value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Chọn giới tính" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Nam</SelectItem>
              <SelectItem value="female">Nữ</SelectItem>
              <SelectItem value="other">Khác</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Địa chỉ</Label>
          <Input id="address" {...form.register('address')} />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Tài khoản riêng tư</Label>
            <p className="text-sm text-muted-foreground">
              Khi tài khoản của bạn là riêng tư, chỉ những người bạn phê duyệt mới có thể xem ảnh và video của bạn trên Instagram.
            </p>
          </div>
          <Switch 
            checked={form.watch('privacy') === 'private'} 
            onCheckedChange={(checked) => form.setValue('privacy', checked ? 'private' : 'public')} 
          />
        </div>

        <div className="pt-4 flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu thông tin'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={isSubmitting}>
            Hủy
          </Button>
        </div>
      </form>
    </div>
  );
}
