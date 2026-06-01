import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRef, useState, useCallback } from 'react';
import { orvalClient } from '@/services/apis/axios-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/utils/cropImage';
import { Slider } from '@/components/ui/slider';

interface AvatarUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatar?: string;
}

export function AvatarUploadModal({ isOpen, onClose, currentAvatar }: AvatarUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Cropper states
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Reset modal when closing
  const handleClose = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    onClose();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageSrc(reader.result?.toString() || null));
      reader.readAsDataURL(file);
    }
    // reset input value so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setIsLoading(true);
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      
      // Convert Blob to File
      const file = new File([croppedImageBlob], 'avatar.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('avatar-user', file);

      await orvalClient({
        url: '/users/profile',
        method: 'PATCH',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      queryClient.invalidateQueries({ queryKey: ['usersControllerGetProfile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      
      handleClose();
    } catch (error) {
      console.error('Lỗi khi tải ảnh lên:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveClick = async () => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('removeAvatar', 'true');

      await orvalClient({
        url: '/users/profile',
        method: 'PATCH',
        data: formData,
      });

      queryClient.invalidateQueries({ queryKey: ['usersControllerGetProfile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      
      handleClose();
    } catch (error) {
      console.error('Lỗi khi gỡ ảnh:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[400px] p-0 overflow-hidden bg-card border-none rounded-xl gap-0">
        <DialogTitle className="sr-only">Thay đổi ảnh đại diện</DialogTitle>
        
        {imageSrc ? (
          // Cropper UI
          <div className="flex flex-col h-[500px]">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <Button variant="ghost" onClick={handleClose} disabled={isLoading}>Hủy</Button>
              <h2 className="text-lg font-semibold">Cắt ảnh</h2>
              <Button variant="ghost" className="text-primary font-bold" onClick={handleSaveCroppedImage} disabled={isLoading}>
                {isLoading ? 'Đang lưu...' : 'Xong'}
              </Button>
            </div>
            
            <div className="relative flex-1 bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            
            <div className="p-4 bg-background">
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium">Thu nhỏ</span>
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onValueChange={(val) => setZoom(val[0])}
                  className="flex-1"
                />
                <span className="text-xs font-medium">Phóng to</span>
              </div>
            </div>
          </div>
        ) : (
          // Default Upload Options UI
          <div className="flex flex-col text-center">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold">Thay đổi ảnh đại diện</h2>
            </div>
            
            <Button 
              variant="ghost" 
              className="w-full rounded-none py-4 h-auto text-primary font-bold border-b border-border"
              onClick={handleUploadClick}
              disabled={isLoading}
            >
              Tải ảnh lên
            </Button>

            <Button 
              variant="ghost" 
              className="w-full rounded-none py-4 h-auto text-destructive font-bold border-b border-border"
              onClick={handleRemoveClick}
              disabled={isLoading || !currentAvatar || currentAvatar === '/default-avatar.png'}
            >
              Gỡ ảnh hiện tại
            </Button>

            <Button 
              variant="ghost" 
              className="w-full rounded-none py-4 h-auto"
              onClick={handleClose}
              disabled={isLoading}
            >
              Hủy
            </Button>
          </div>
        )}

        {/* Hidden file input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          onChange={handleFileChange}
        />
      </DialogContent>
    </Dialog>
  );
}
