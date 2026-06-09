import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Type, Loader2, X } from 'lucide-react';
import { useCreateStory } from '../api';
import { useToast } from '@/hooks/use-toast';

interface CreateStoryModalProps {
  open: boolean;
  onClose: () => void;
}

const BACKGROUNDS = [
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
  'linear-gradient(135deg, #3b82f6, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #10b981, #3b82f6)',
  'linear-gradient(135deg, #1f2937, #4b5563)',
  'linear-gradient(135deg, #ec4899, #f59e0b)',
];

type Mode = 'choose' | 'media' | 'text';

export function CreateStoryModal({ open, onClose }: CreateStoryModalProps) {
  const { toast } = useToast();
  const createStory = useCreateStory();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('choose');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [text, setText] = useState('');
  const [background, setBackground] = useState(BACKGROUNDS[0]);

  const reset = () => {
    setMode('choose');
    setFile(null);
    setPreview('');
    setText('');
    setBackground(BACKGROUNDS[0]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMode('media');
  };

  const handleSubmit = () => {
    const payload =
      mode === 'media' ? { file: file! } : { content: text, background };

    createStory.mutate(payload, {
      onSuccess: () => {
        toast({ title: 'Đã đăng story!' });
        handleClose();
      },
      onError: () => {
        toast({
          title: 'Đăng story thất bại',
          variant: 'destructive',
        });
      },
    });
  };

  const isVideo = file?.type.startsWith('video/');
  const canSubmit =
    (mode === 'media' && !!file) || (mode === 'text' && text.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Tạo story</DialogTitle>
        </DialogHeader>

        {/* Chọn loại story */}
        {mode === 'choose' && (
          <div className="grid grid-cols-2 gap-3 p-4 pt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 h-32 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 transition-colors border border-border"
            >
              <ImageIcon className="w-8 h-8 text-blue-500" />
              <span className="text-sm font-medium">Ảnh / Video</span>
            </button>
            <button
              onClick={() => setMode('text')}
              className="flex flex-col items-center justify-center gap-2 h-32 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 transition-colors border border-border"
            >
              <Type className="w-8 h-8 text-purple-500" />
              <span className="text-sm font-medium">Văn bản</span>
            </button>
          </div>
        )}

        {/* Preview media */}
        {mode === 'media' && preview && (
          <div className="p-4 pt-2">
            <div className="relative w-full aspect-[9/16] max-h-[50vh] rounded-xl overflow-hidden bg-black">
              {isVideo ? (
                <video
                  src={preview}
                  className="w-full h-full object-contain"
                  controls
                />
              ) : (
                <img
                  src={preview}
                  alt="preview"
                  className="w-full h-full object-contain"
                />
              )}
              <button
                onClick={() => {
                  setFile(null);
                  setPreview('');
                  setMode('choose');
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Soạn story text */}
        {mode === 'text' && (
          <div className="p-4 pt-2 space-y-3">
            <div
              className="w-full aspect-[9/16] max-h-[45vh] rounded-xl flex items-center justify-center p-6"
              style={{ background }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Nhập nội dung..."
                maxLength={500}
                className="w-full bg-transparent text-white text-xl font-bold text-center placeholder-white/60 outline-none resize-none"
                rows={4}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-center">
              {BACKGROUNDS.map((bg) => (
                <button
                  key={bg}
                  onClick={() => setBackground(bg)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    background === bg
                      ? 'border-foreground scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ background: bg }}
                  aria-label="Chọn nền"
                />
              ))}
            </div>
          </div>
        )}

        {/* Hành động */}
        {mode !== 'choose' && (
          <div className="flex gap-2 p-4 pt-0">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setMode('choose')}
            >
              Quay lại
            </Button>
            <Button
              className="flex-1"
              disabled={!canSubmit || createStory.isPending}
              onClick={handleSubmit}
            >
              {createStory.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Đăng'
              )}
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </DialogContent>
    </Dialog>
  );
}
