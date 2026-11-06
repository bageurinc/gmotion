import React from 'react';
import { Heart, MessageCircle, Send, Bookmark, Share2, ThumbsUp, ThumbsDown,
  MoreHorizontal, Search, Camera, Music2, Home, Plus, UserRound, ChevronLeft } from 'lucide-react';
import { getSocialSafeInsets } from '@/motion-kit/core/SafeOverlay';

export const SOCIAL_PLATFORMS = [
  { id: 'generic', label: 'Umum' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram Reels' },
  { id: 'shorts', label: 'YouTube Shorts' },
  { id: 'facebook', label: 'Facebook Reels' },
] as const;
import type { SocialPlatform } from '@/types/studio';
export type { SocialPlatform } from '@/types/studio';

// Illustrative preview margins, not an exact replica of a platform or device.
export function getPreviewInsets(width: number, height: number, platform: SocialPlatform) {
  return getSocialSafeInsets(width, height, platform);
}

export const SocialPlatformOverlay: React.FC<{
  platform: SocialPlatform; width: number; height: number;
}> = ({ platform, width, height }) => {
  if (platform === 'generic' || height <= width) return null;
  const unit = width / 390;
  const isShorts = platform === 'shorts';
  const isTikTok = platform === 'tiktok';
  const isInstagram = platform === 'instagram';
  const iconSize = 27 * unit;
  const actions = isShorts
    ? [[ThumbsUp, 'Suka'], [ThumbsDown, 'Tidak suka'], [MessageCircle, '128'], [Share2, 'Bagikan']] as const
    : isTikTok
      ? [[Heart, '12,8 rb'], [MessageCircle, '128'], [Bookmark, 'Simpan'], [Share2, 'Bagikan']] as const
      : [[isInstagram ? Heart : ThumbsUp, '12,8 rb'], [MessageCircle, '128'], [isInstagram ? Send : Share2, 'Bagikan'], [MoreHorizontal, '']] as const;
  return (
    <div aria-hidden data-social-preview={platform} style={{
      position: 'absolute', inset: 0, zIndex: 70, pointerEvents: 'none',
      color: '#fff', fontFamily: 'Arial, sans-serif', fontSize: 13 * unit,
      lineHeight: 1.4, textShadow: '0 1px 4px #000',
    }}>
      <div style={{ position: 'absolute', top: '3%', left: '5%', right: '5%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 18 * unit, fontWeight: 700 }}>
        {isTikTok ? <><span style={{ opacity: 0.8 }}>Mengikuti</span><span>Untuk Anda</span><Search size={24 * unit} /></>
          : <><ChevronLeft size={24 * unit} /><span>{isShorts ? 'Shorts' : 'Reels'}</span><Camera size={24 * unit} /></>}
      </div>
      <div style={{ position: 'absolute', right: '3%', bottom: '21%', width: '10%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 * unit }}>
        {isTikTok && <div style={{ width: 38 * unit, height: 38 * unit, borderRadius: '50%',
          border: `${2 * unit}px solid white`, display: 'grid', placeItems: 'center', background: '#334155' }}><UserRound size={23 * unit} /></div>}
        {actions.map(([Icon, label], index) => <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 * unit }}>
          <Icon size={iconSize} strokeWidth={2} />
          {label && <span style={{ fontSize: 10 * unit, whiteSpace: 'nowrap', fontWeight: 600 }}>{label}</span>}
        </div>)}
      </div>
      <div style={{ position: 'absolute', left: '5%', right: '19%', bottom: '10%',
        display: 'flex', flexDirection: 'column', gap: 8 * unit }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 * unit, fontWeight: 700 }}>
          {!isTikTok && <UserRound size={22 * unit} />}
          <span>@nama_akun</span>
          {!isTikTok && <span style={{ border: `${unit}px solid #fff`, borderRadius: 4 * unit, padding: `${2 * unit}px ${7 * unit}px`, fontSize: 10 * unit }}>{isShorts ? 'Subscribe' : 'Ikuti'}</span>}
        </div>
        <div>Contoh caption video Anda…<br /><span style={{ opacity: 0.85 }}>#konten #cerita</span></div>
        <div style={{ display: 'flex', gap: 6 * unit, alignItems: 'center', fontSize: 11 * unit }}><Music2 size={13 * unit} />Audio asli · nama_akun</div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '7%',
        background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
        <Home size={22 * unit} /><Search size={22 * unit} /><Plus size={26 * unit} />
        <MessageCircle size={22 * unit} /><UserRound size={22 * unit} />
      </div>
    </div>
  );
};
