import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|mkv)$/i.test(url) || url.includes('video');
}

type Orientation = 'portrait' | 'landscape' | null;

/** Đo tỉ lệ media để chọn bố cục lưới (portrait khi cao > rộng rõ rệt). */
function useMediaOrientation(url?: string): Orientation {
  const [ori, setOri] = useState<Orientation>(null);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    const classify = (w: number, h: number) => {
      if (!alive || !w || !h) return;
      setOri(h / w > 1.1 ? 'portrait' : 'landscape');
    };

    if (isVideoUrl(url)) {
      const v = document.createElement('video');
      v.preload = 'metadata';
      const onMeta = () => classify(v.videoWidth, v.videoHeight);
      v.addEventListener('loadedmetadata', onMeta);
      v.src = url;
      return () => {
        alive = false;
        v.removeEventListener('loadedmetadata', onMeta);
      };
    }

    const img = new Image();
    const onLoad = () => classify(img.naturalWidth, img.naturalHeight);
    img.addEventListener('load', onLoad);
    img.src = url;
    return () => {
      alive = false;
      img.removeEventListener('load', onLoad);
    };
  }, [url]);

  return ori;
}

function Tile({
  url,
  onClick,
  overlay,
}: {
  url: string;
  onClick: () => void;
  overlay?: string;
}) {
  const video = isVideoUrl(url);
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full h-full overflow-hidden bg-muted group/tile"
    >
      {video ? (
        <>
          <video
            src={url}
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="w-11 h-11 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="w-5 h-5 text-white fill-white" />
            </span>
          </span>
        </>
      ) : (
        <img
          src={url}
          loading="lazy"
          alt=""
          className="w-full h-full object-cover transition-transform duration-300 group-hover/tile:scale-[1.03]"
        />
      )}
      {overlay && (
        <span className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-2xl font-bold">
          {overlay}
        </span>
      )}
    </button>
  );
}

/**
 * Lưới ảnh/video kiểu Facebook: hiển thị tối đa 3 ô. Nếu > 3 media, ô thứ 3
 * phủ overlay "+N" (N = tổng - 2, tính cả ảnh thứ 3). Dùng cho bài có ≥2 media.
 */
export function MediaGrid({
  medias,
  onOpen,
}: {
  medias: string[];
  onOpen: (index: number) => void;
}) {
  const count = medias.length;
  // Hướng của media đầu tiên quyết định bố cục (mặc định landscape khi đang đo)
  const firstOri = useMediaOrientation(medias[0]);
  const isPortrait = firstOri === 'portrait';

  if (count === 2) {
    return (
      <div
        className={`grid grid-cols-2 gap-0.5 rounded-lg overflow-hidden ${
          isPortrait ? 'aspect-[4/5]' : 'aspect-[16/10]'
        }`}
      >
        <Tile url={medias[0]} onClick={() => onOpen(0)} />
        <Tile url={medias[1]} onClick={() => onOpen(1)} />
      </div>
    );
  }

  // count >= 3: ô thứ 3 phủ "+N" nếu > 3
  const overlay = count > 3 ? `+${count - 2}` : undefined;

  if (isPortrait) {
    // Ảnh đầu DỌC → 1 ô lớn bên TRÁI (span 2 hàng) + 2 ô xếp chồng bên PHẢI
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 rounded-lg overflow-hidden aspect-[4/5]">
        <div className="row-span-2 min-h-0">
          <Tile url={medias[0]} onClick={() => onOpen(0)} />
        </div>
        <div className="min-h-0">
          <Tile url={medias[1]} onClick={() => onOpen(1)} />
        </div>
        <div className="min-h-0">
          <Tile url={medias[2]} onClick={() => onOpen(2)} overlay={overlay} />
        </div>
      </div>
    );
  }

  // Ảnh đầu NGANG/vuông → 1 ô lớn bên TRÊN (span 2 cột) + 2 ô dưới
  return (
    <div className="grid grid-cols-2 grid-rows-[1.5fr_1fr] gap-0.5 rounded-lg overflow-hidden aspect-[4/3]">
      <div className="col-span-2 min-h-0">
        <Tile url={medias[0]} onClick={() => onOpen(0)} />
      </div>
      <div className="min-h-0">
        <Tile url={medias[1]} onClick={() => onOpen(1)} />
      </div>
      <div className="min-h-0">
        <Tile url={medias[2]} onClick={() => onOpen(2)} overlay={overlay} />
      </div>
    </div>
  );
}
