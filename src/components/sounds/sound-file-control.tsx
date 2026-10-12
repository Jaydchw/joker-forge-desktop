import { useEffect, useRef, useState } from "react";
import { UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { SoundData } from "@/lib/core/types";
import { readSoundUpload, SOUND_FILE_ACCEPT } from "@/lib/sounds/sound-editor-utils";
import { SoundAudioPreview } from "./sound-audio-preview";

interface SoundFileControlProps {
  sound: SoundData;
  onUpload: (upload: Pick<SoundData, "soundString" | "audioDataUrl">) => void;
  onPendingChange?: (pending: boolean) => void;
}

export function SoundFileControl({ sound, onUpload, onPendingChange }: SoundFileControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  const upload = async (file: File) => {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    setError(null);
    setIsUploading(true);
    onPendingChange?.(true);
    try {
      const result = await readSoundUpload(file, request.signal);
      if (!request.signal.aborted && requestRef.current === request) onUpload(result);
    } catch (failure) {
      if (!request.signal.aborted && requestRef.current === request) {
        setError(failure instanceof Error ? failure.message : "The audio file could not be uploaded.");
      }
    } finally {
      if (!request.signal.aborted && requestRef.current === request) {
        requestRef.current = null;
        setIsUploading(false);
        onPendingChange?.(false);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-muted-foreground" title={sound.soundString || undefined}>
          {sound.soundString || "No audio file uploaded"}
        </p>
        <Button type="button" size="sm" variant="outline" disabled={isUploading} onClick={() => inputRef.current?.click()} className="shrink-0 cursor-pointer">
          <UploadSimple className="mr-1.5 h-4 w-4" />
          {isUploading ? "Uploading..." : sound.audioDataUrl ? "Replace audio" : "Upload audio"}
        </Button>
      </div>
      <input ref={inputRef} type="file" accept={SOUND_FILE_ACCEPT} aria-label={`Upload audio for ${sound.key}`} className="hidden" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void upload(file);
      }} />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <SoundAudioPreview sound={sound} />
    </div>
  );
}
