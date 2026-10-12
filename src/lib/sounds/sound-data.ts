import type { SoundData } from "@/lib/core/types";

type SoundRecord = Record<string, unknown>;

const soundRecord = (value: unknown): SoundRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as SoundRecord
    : {};

const finiteNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const embeddedSoundExtension = (value: string): "ogg" | "mp3" | null => {
  const match = value.match(/^data:([^,]*);base64,([\s\S]*)$/i);
  if (!match) return null;

  try {
    const prefix = atob(match[2].slice(0, 64).replace(/\s/g, "").slice(0, 16));
    if (prefix.startsWith("OggS")) return "ogg";
    if (prefix.startsWith("ID3") || (prefix.charCodeAt(0) === 0xff && (prefix.charCodeAt(1) & 0xe0) === 0xe0)) {
      return "mp3";
    }
  } catch {
  }

  const mime = match[1].split(";", 1)[0].trim().toLowerCase();
  if (["audio/ogg", "application/ogg", "audio/x-ogg", "audio/vorbis", "audio/opus"].includes(mime)) return "ogg";
  if (["audio/mpeg", "audio/mp3", "audio/x-mp3", "audio/mpeg3", "audio/x-mpeg"].includes(mime)) return "mp3";
  return null;
};

const migratedFileStem = (key: string): string => {
  const stem = key.replace(/[^A-Za-z0-9_-]/g, "_") || "sound";
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem) ? `${stem}_sound` : stem;
};

const exportFilename = (filename: string): string =>
  filename.split(/[\\/]/).pop()!.replace(/\.mp3$/i, ".ogg").toLowerCase();

export const normalizeSoundData = (value: unknown, index = 0): SoundData => {
  const obj = soundRecord(value);
  const key = typeof obj.key === "string" && obj.key.trim() ? obj.key.trim() : `sound_${index + 1}`;
  const soundString = typeof obj.soundString === "string" ? obj.soundString.trim() : "";
  const audioDataUrl = typeof obj.audioDataUrl === "string" && obj.audioDataUrl.trim() ? obj.audioDataUrl : undefined;
  const legacyExtension = embeddedSoundExtension(soundString);
  const extension = legacyExtension && (embeddedSoundExtension(audioDataUrl ?? "") ?? legacyExtension);

  return {
    ...obj,
    id: typeof obj.id === "string" && obj.id.trim() ? obj.id : `sound-${index + 1}`,
    key,
    soundString: extension ? `${migratedFileStem(key)}.${extension}` : soundString,
    ...(extension ? { audioDataUrl: audioDataUrl ?? soundString } : {}),
    volume: finiteNumber(obj.volume, 1),
    pitch: finiteNumber(obj.pitch, 1),
  } as SoundData;
};

export const normalizeSounds = (value: unknown): SoundData[] => {
  if (!Array.isArray(value)) return [];
  const migrated = value.map((sound) => {
    const source = soundRecord(sound).soundString;
    return typeof source === "string" && embeddedSoundExtension(source.trim()) !== null;
  });
  const sounds = value.map(normalizeSoundData);
  const reserved = new Set(sounds.filter((_, index) => !migrated[index]).map((sound) => exportFilename(sound.soundString)));
  return sounds.map((sound, index) => {
    if (!migrated[index]) return sound;
    const extension = sound.soundString.slice(sound.soundString.lastIndexOf("."));
    const stem = sound.soundString.slice(0, -extension.length);
    let filename = sound.soundString;
    let suffix = 2;
    while (reserved.has(exportFilename(filename))) filename = `${stem}_${suffix++}${extension}`;
    reserved.add(exportFilename(filename));
    return filename === sound.soundString ? sound : { ...sound, soundString: filename };
  });
};
