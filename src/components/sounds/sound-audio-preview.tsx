import { useEffect, useRef, useState } from "react";
import type { SoundData } from "@/lib/core/types";

export function SoundAudioPreview({ sound }: { sound: SoundData }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setPreviewError(false);
    const audio = audioRef.current;
    if (!audio || !sound.audioDataUrl) return;
    audio.src = sound.audioDataUrl;
    audio.load();
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [sound.audioDataUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const volume = sound.volume ?? 1;
    audio.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
    const pitch = sound.pitch ?? 1;
    try { audio.playbackRate = Number.isFinite(pitch) && pitch > 0 ? pitch : 1; }
    catch { audio.playbackRate = 1; }
    audio.preservesPitch = false;
  }, [sound.audioDataUrl, sound.volume, sound.pitch]);

  if (!sound.audioDataUrl) {
    return <p className="text-sm text-muted-foreground">Upload an MP3 or OGG file to preview and export this sound.</p>;
  }
  return (
    <div className="space-y-2">
      <audio ref={audioRef} controls preload="metadata" aria-label={`Preview ${sound.key}`} onError={() => setPreviewError(true)} className="h-10 w-full" />
      {previewError && <p role="status" className="text-xs text-destructive">This file could not be previewed. Try replacing it with another MP3 or OGG file.</p>}
    </div>
  );
}
