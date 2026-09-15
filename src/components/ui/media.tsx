import { ImageOff, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { initials } from '@/lib/format';
import { repoImageUrl } from '@/lib/images';

export function Thumb({ videoId, alt = '', className = '', badge, quality = 'mqdefault' }: { videoId: string | null; alt?: string; className?: string; badge?: string; quality?: 'mqdefault' | 'hqdefault' }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative aspect-video shrink-0 overflow-hidden rounded-lg bg-sunken ${className}`}>
      {videoId && !failed ? (
        <img src={`https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${quality}.jpg`} alt={alt} loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="flex size-full items-center justify-center text-ink-3">
          <Play size={18} aria-hidden />
        </div>
      )}
      {badge ? <span className="absolute right-1 bottom-1 rounded bg-[oklch(0.15_0_0/0.82)] px-1 py-px text-2xs font-medium text-[oklch(0.98_0_0)] tabular-nums">{badge}</span> : null}
    </div>
  );
}

export function Avatar({ src, name, size = 32, className = '' }: { src?: string | null; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.36) };
  if (src && !failed) {
    return <img src={src} alt="" width={size} height={size} loading="lazy" style={style} className={`shrink-0 rounded-full bg-sunken object-cover ${className}`} onError={() => setFailed(true)} />;
  }
  return (
    <span style={style} className={`inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-medium text-accent-ink ${className}`} aria-hidden>
      {initials(name)}
    </span>
  );
}

// Print guardado no repositório privado: baixa com o token e mostra como blob URL
export function RepoImage({ path, alt = '', className = '' }: { path: string; alt?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    repoImageUrl(path)
      .then((value) => active && setUrl(value))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [path]);
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-sunken text-ink-3 ${className}`}>
        <ImageOff size={18} aria-label="Imagem indisponível" />
      </div>
    );
  }
  return url ? <img src={url} alt={alt} className={`object-cover ${className}`} /> : <div className={`skeleton ${className}`} aria-hidden />;
}
