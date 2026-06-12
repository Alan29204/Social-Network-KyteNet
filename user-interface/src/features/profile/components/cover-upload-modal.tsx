import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRef, useState, useCallback } from 'react';
import { orvalClient } from '@/services/apis/axios-client';
import { useQueryClient } from '@tanstack/react-query';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/utils/cropImage';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface CoverUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCover?: string | null;
  userId: string;
}

export function CoverUploadModal({
  isOpen,
  onClose,
  currentCover,
  userId,
}: CoverUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Cropper states
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImageSrc(reader.result?.toString() || null),
      );
      reader.readAsDataURL(file);
    }
    // reset input value so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onCropComplete = useCallback(
    (_croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  const updateProfileData = (newCoverUrl: string | null) => {
    queryClient.setQueryData(['profile', userId], (oldData: any) => {
      if (!oldData) return oldData;
      return { ...oldData, cover_photo: newCoverUrl };
    });
  };

  const handleSaveCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setIsLoading(true);
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);

      // Convert Blob to File
      const file = new File([croppedImageBlob], 'cover.jpg', {
        type: 'image/jpeg',
      });

      const formData = new FormData();
      formData.append('cover-photo', file);

      const res = await orvalClient<any>({
        url: '/users/profile/cover-photo',
        method: 'PATCH',
        data: formData,
      });

      const newCoverUrl = res.data?.cover_photo;
      updateProfileData(newCoverUrl);

      handleClose();

      toast({
        title: 'Thành công',
        description: 'Đã cập nhật ảnh bìa thành công!',
      });
    } catch (error) {
      console.error('Lỗi khi tải ảnh lên:', error);
      toast({
        title: 'Lỗi',
        description: 'Có lỗi xảy ra khi tải ảnh lên.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveClick = async () => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('removeCoverPhoto', 'true');

      await orvalClient({
        url: '/users/profile/cover-photo',
        method: 'PATCH',
        data: formData,
      });

      updateProfileData(null);
      handleClose();

      toast({
        title: 'Thành công',
        description: 'Đã gỡ ảnh bìa thành công!',
      });
    } catch (error) {
      console.error('Lỗi khi gỡ ảnh:', error);
      toast({
        title: 'Lỗi',
        description: 'Có lỗi xảy ra khi gỡ ảnh.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-[800px] p-0 overflow-hidden bg-card border-none rounded-xl gap-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Thay đổi ảnh bìa</DialogTitle>
          <DialogDescription className="sr-only">Cập nhật ảnh bìa</DialogDescription>

          {imageSrc ? (
            // Cropper UI
            <div className="flex flex-col h-[500px]">
              <div className="flex justify-between items-center p-4 border-b border-border">
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  disabled={isLoading}
                >
                  Hủy
                </Button>
                <h2 className="text-lg font-semibold">Kéo để điều chỉnh ảnh bìa</h2>
                <Button
                  variant="ghost"
                  className="text-primary font-bold"
                  onClick={handleSaveCroppedImage}
                  disabled={isLoading}
                >
                  {isLoading ? 'Đang lưu...' : 'Xong'}
                </Button>
              </div>

              <div className="relative flex-1 bg-black">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={896 / 256} // Approximate ratio for max-w-4xl and h-64
                  cropShape="rect"
                  showGrid={true}
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
                <h2 className="text-xl font-semibold">Thay đổi ảnh bìa</h2>
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
                onClick={() => setShowRemoveConfirm(true)}
                disabled={isLoading || !currentCover || currentCover.includes('cafe.jpg')}
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

      {/* Remove Cover Confirmation */}
      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent className="max-w-[400px] gap-0 p-0 overflow-hidden bg-card border-none rounded-xl">
          <AlertDialogHeader className="text-center p-6 pb-4">
            <AlertDialogTitle className="text-center font-semibold text-lg">
              Gỡ ảnh bìa?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col items-stretch space-x-0 border-t border-border mt-0 gap-0">
            <AlertDialogAction
              onClick={() => {
                handleRemoveClick();
                setShowRemoveConfirm(false);
              }}
              className="w-full bg-transparent text-destructive hover:bg-muted text-base font-bold shadow-none rounded-none py-4 h-auto border-b border-border"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gỡ'}
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => setShowRemoveConfirm(false)}
              className="w-full bg-transparent hover:bg-muted text-base shadow-none rounded-none border-0 py-4 h-auto m-0"
              disabled={isLoading}
            >
              Hủy
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
