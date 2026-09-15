import { Link2 } from 'lucide-react';
import { RepoImage, Thumb } from '@/components/ui/media';
import type { Reference } from '@/lib/types';

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Capa de uma referência: print salvo, thumb do YouTube ou o domínio do link
export function ReferenceMedia({ reference, className = '' }: { reference: Reference; className?: string }) {
  if (reference.image) return <RepoImage path={reference.image} alt={reference.title} className={`aspect-video w-full rounded-lg ${className}`} />;
  if (reference.videoId) return <Thumb videoId={reference.videoId} quality="hqdefault" className={`w-full ${className}`} />;
  if (reference.url) {
    return (
      <div className={`flex aspect-[3/1] w-full items-center justify-center gap-2 rounded-lg bg-sunken text-xs text-ink-2 ${className}`}>
        <Link2 size={15} aria-hidden />
        {domainOf(reference.url)}
      </div>
    );
  }
  return null;
}

export function hasMedia(reference: Reference): boolean {
  return Boolean(reference.image || reference.videoId || reference.url);
}
