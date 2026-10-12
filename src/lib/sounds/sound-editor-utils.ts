import type { SoundData } from "@/lib/core/types";

export const SOUND_FILE_ACCEPT = ".mp3,.ogg,audio/mpeg,audio/ogg";

export const getNextSoundKey = (sounds: Pick<SoundData, "key">[]): string => {
  const keys = new Set(sounds.map((sound) => sound.key.trim().toLowerCase()));
  let index = 1;
  while (keys.has(`sound_${index}`)) index += 1;
  return `sound_${index}`;
};

export const getSoundKeyError = (
  value: string,
  sounds: Pick<SoundData, "id" | "key">[],
  soundId: string,
  modPrefix = "",
): string | null => {
  const key = value.trim();
  if (!key) return "A sound key is required.";
  if (!/^[A-Za-z0-9_]+$/.test(key)) {
    return "Use letters, numbers, and underscores for the sound key.";
  }
  const normalized = key.toLowerCase();
  if (sounds.some((sound) => sound.id !== soundId && sound.key.trim().toLowerCase() === normalized)) {
    return "Another sound already uses this key.";
  }
  const prefix = modPrefix.trim().toLowerCase();
  if (prefix && normalized.startsWith(`${prefix}_`)) {
    return `Leave off ${modPrefix.trim()}_: the mod prefix is added automatically.`;
  }
  return null;
};

export const getSoundMixError = (value: string, field: "volume" | "pitch"): string | null => {
  const number = Number(value);
  if (!value.trim() || !Number.isFinite(number)) return `Enter a valid ${field}.`;
  if (field === "volume" && number < 0) return "Volume must be zero or greater.";
  if (field === "pitch" && number <= 0) return "Pitch must be greater than zero.";
  return null;
};

export const getSoundChanges = (initial: SoundData, edited: SoundData): Partial<SoundData> => {
  const changes: Partial<SoundData> = {};
  const fields = ["key", "volume", "pitch", "replace", "soundString", "audioDataUrl"] as const;
  for (const field of fields) {
    if (initial[field] !== edited[field]) Object.assign(changes, { [field]: edited[field] });
  }
  return changes;
};

export const readSoundUpload = (
  file: File,
  signal?: AbortSignal,
): Promise<Pick<SoundData, "soundString" | "audioDataUrl">> => {
  const extension = file.name.toLowerCase().match(/\.(mp3|ogg)$/)?.[1];
  if (!extension) return Promise.reject(new Error("Choose an MP3 or OGG audio file."));
  if (file.size === 0) return Promise.reject(new Error("This audio file is empty. Choose another file."));
  if (signal?.aborted) return Promise.reject(new DOMException("Upload cancelled.", "AbortError"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const cancel = () => reader.abort();
    const cleanup = () => signal?.removeEventListener("abort", cancel);
    signal?.addEventListener("abort", cancel, { once: true });
    reader.onerror = () => {
      cleanup();
      reject(new Error("The audio file could not be read. Try uploading it again."));
    };
    reader.onabort = () => {
      cleanup();
      reject(new DOMException("Upload cancelled.", "AbortError"));
    };
    reader.onload = () => {
      cleanup();
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!/^data:[^,]*;base64,.+/s.test(result)) {
        reject(new Error("The audio file could not be read. Try uploading it again."));
        return;
      }
      const mime = extension === "ogg" ? "audio/ogg" : "audio/mpeg";
      resolve({ soundString: file.name, audioDataUrl: result.replace(/^data:[^;]*;/, `data:${mime};`) });
    };
    try { reader.readAsDataURL(file); }
    catch {
      cleanup();
      reject(new Error("The audio file could not be read. Try uploading it again."));
    }
  });
};
