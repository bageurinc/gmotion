'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, RefreshCw, Share2, FileText } from 'lucide-react';
import {
  captionToText,
  cleanYoutubeTags,
  MAX_CAPTION_GENERATIONS,
  videoFileName,
  YOUTUBE_TAGS_LIMIT,
  YOUTUBE_TITLE_LIMIT,
  youtubeTagsText,
} from '@/lib/social/format';
import type { SocialCaption, StudioProject } from '@/types/studio';

interface SharePanelProps {
  project: StudioProject;
  exportUrl: string;
  onCaption: (caption: SocialCaption) => void;
}

/** True only where the system share sheet accepts video files, which in practice means phones. */
function canShareVideo(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([], 'video.mp4', { type: 'video/mp4' })] });
  } catch {
    return false;
  }
}

export const SharePanel: React.FC<SharePanelProps> = ({ project, exportUrl, onCaption }) => {
  const fileName = videoFileName(project.storyboard.title);
  const saved = project.socialCaption;
  const [platform, setPlatform] = useState<'short' | 'youtube'>('short');
  const [caption, setCaption] = useState(saved ? captionToText(saved) : '');
  const [youtubeTitle, setYoutubeTitle] = useState(saved?.youtubeTitle ?? '');
  const [youtubeDescription, setYoutubeDescription] = useState(saved ? captionToText(saved) : '');
  const [youtubeTags, setYoutubeTags] = useState(saved?.youtubeTags ? youtubeTagsText(saved.youtubeTags) : '');
  const [isWriting, setIsWriting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shareSupported, setShareSupported] = useState(false);
  const generationsLeft = MAX_CAPTION_GENERATIONS - (project.socialCaption?.generatedCount ?? 0);

  const tagsLength = youtubeTagsText(cleanYoutubeTags(youtubeTags.split(','))).length;
  const hasText = Boolean(caption || youtubeTitle || youtubeTags);

  const copyButton = (key: string, text: string, label: string) => (
    <button
      onClick={() => copyText(key, text)}
      disabled={!text.trim()}
      className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 hover:text-white disabled:opacity-40"
    >
      {copied === key ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      <span>{copied === key ? 'Tersalin' : label}</span>
    </button>
  );
  const field = 'w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-400';

  // Checked after mount: the server render has no navigator.
  useEffect(() => setShareSupported(canShareVideo()), []);

  const copyText = async (key: string, text: string): Promise<boolean> => {
    if (!text.trim()) return false;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
      return true;
    } catch {
      setMessage('Browser menolak menyalin otomatis. Pilih teksnya lalu salin manual.');
      return false;
    }
  };

  const writeCaption = async () => {
    setIsWriting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/caption`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.socialCaption) {
        setMessage(data?.error ?? 'Caption gagal dibuat. Coba lagi.');
        return;
      }
      const next: SocialCaption = data.socialCaption;
      setCaption(captionToText(next));
      setYoutubeTitle(next.youtubeTitle ?? '');
      setYoutubeDescription(captionToText(next));
      setYoutubeTags(next.youtubeTags ? youtubeTagsText(next.youtubeTags) : '');
      onCaption(next);
      if (!data.usedModel) setMessage('AI sedang tidak tersedia, jadi caption diisi dari judul dan kalimat pertama.');
    } catch {
      setMessage('Caption gagal dibuat karena koneksi terputus. Coba lagi.');
    } finally {
      setIsWriting(false);
    }
  };

  const shareVideo = async () => {
    setIsSharing(true);
    setMessage(null);
    try {
      // Instagram and TikTok drop text that comes with a file, so the caption goes to the clipboard first.
      const captionCopied = await copyText('caption', caption);
      const res = await fetch(exportUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const file = new File([await res.blob()], fileName, { type: 'video/mp4' });
      await navigator.share({ files: [file], title: project.storyboard.title, text: caption || undefined });
      if (captionCopied) setMessage('Caption sudah disalin. Tempel di aplikasi tujuan.');
    } catch (error) {
      // Closing the share sheet is not an error worth reporting.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setMessage('Video gagal dibagikan dari browser ini. Download dulu, lalu unggah dari aplikasinya.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-3 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Platform caption" className="flex gap-1 rounded-md bg-slate-800 p-0.5">
          {([['short', 'TikTok / IG'], ['youtube', 'YouTube']] as const).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={platform === value}
              onClick={() => setPlatform(value)}
              className={`px-2.5 py-1 rounded-md text-sm font-semibold transition ${
                platform === value ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={writeCaption}
          disabled={isWriting || generationsLeft <= 0}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
        >
          {isWriting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText aria-hidden="true" className="w-4 h-4" />}
          <span>{hasText ? `Buat ulang (sisa ${generationsLeft})` : 'Buat caption'}</span>
        </button>
      </div>

      {platform === 'short' ? (
        <div className="space-y-1.5">
          <label htmlFor="social-caption" className="text-xs font-semibold text-slate-300">
            Caption dan hashtag
          </label>
          <textarea
            id="social-caption"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={5}
            placeholder="Klik Buat caption, atau tulis sendiri."
            className={`${field} resize-none`}
          />
          {copyButton('caption', caption, 'Salin caption')}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="youtube-title" className="text-xs font-semibold text-slate-300">Judul</label>
              <span className={`text-[10px] ${youtubeTitle.length > YOUTUBE_TITLE_LIMIT ? 'text-red-300' : 'text-slate-500'}`}>
                {youtubeTitle.length}/{YOUTUBE_TITLE_LIMIT}
              </span>
            </div>
            <input id="youtube-title" value={youtubeTitle} onChange={(event) => setYoutubeTitle(event.target.value)} className={field} />
            {copyButton('title', youtubeTitle, 'Salin judul')}
          </div>
          <div className="space-y-1">
            <label htmlFor="youtube-description" className="text-xs font-semibold text-slate-300">Deskripsi</label>
            <textarea
              id="youtube-description"
              value={youtubeDescription}
              onChange={(event) => setYoutubeDescription(event.target.value)}
              rows={4}
              className={`${field} resize-none`}
            />
            {copyButton('description', youtubeDescription, 'Salin deskripsi')}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="youtube-tags" className="text-xs font-semibold text-slate-300">Tag (pisahkan dengan koma)</label>
              <span className={`text-[10px] ${tagsLength > YOUTUBE_TAGS_LIMIT ? 'text-red-300' : 'text-slate-500'}`}>
                {tagsLength}/{YOUTUBE_TAGS_LIMIT}
              </span>
            </div>
            <input id="youtube-tags" value={youtubeTags} onChange={(event) => setYoutubeTags(event.target.value)} className={field} />
            {copyButton('tags', youtubeTags, 'Salin tag')}
          </div>
        </div>
      )}

      {message && (
        <p role="status" className="text-[11px] text-slate-300">
          {message}
        </p>
      )}

      <div className="flex items-center gap-3">
        {shareSupported && (
          <button
            onClick={shareVideo}
            disabled={isSharing}
            className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {isSharing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            <span>Bagikan</span>
          </button>
        )}
        <a
          href={exportUrl}
          download={fileName}
          className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
            shareSupported ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Download .mp4</span>
        </a>
      </div>
    </div>
  );
};
