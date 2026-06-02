import React, { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, MusicNotes, Pause, Play, Plus, Trash, UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input as InputField } from "@/components/ui/input";
import { useProjectData } from "@/lib/services/storage";
import type { SoundData } from "@/lib/core/types";
import Panel from "./panel";
import IconButton from "@/components/ui/icon-button";

interface SoundsPanelProps {
  position: { x: number; y: number };
  onClose: () => void;
}

const createBaseSound = (key: string): SoundData => ({
  id: crypto.randomUUID(),
  key,
  soundString: "",
  audioDataUrl: "",
  volume: 1,
  pitch: 1,
});

const decodeWaveformPeaks = async (dataUrl: string, bars = 72): Promise<number[]> => {
  if (!dataUrl) return [];
  const response = await fetch(dataUrl);
  const arrayBuffer = await response.arrayBuffer();
  const context = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / bars));
    const peaks: number[] = [];
    for (let i = 0; i < bars; i += 1) {
      let max = 0;
      const start = i * block;
      const end = Math.min(channel.length, start + block);
      for (let j = start; j < end; j += 1) {
        const value = Math.abs(channel[j]);
        if (value > max) max = value;
      }
      peaks.push(Math.max(0.06, Math.min(1, max)));
    }
    return peaks;
  } finally {
    void context.close();
  }
};

const SoundsPanel: React.FC<SoundsPanelProps> = ({ position, onClose }) => {
  const { data, updateSounds } = useProjectData();
  const [searchTerm, setSearchTerm] = useState("");
  const [playingById, setPlayingById] = useState<Record<string, boolean>>({});
  const [currentTimeById, setCurrentTimeById] = useState<Record<string, number>>({});
  const [durationsById, setDurationsById] = useState<Record<string, number>>({});
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});
  const [isWaveformLoading, setIsWaveformLoading] = useState(false);
  const [scrubbingById, setScrubbingById] = useState<Record<string, boolean>>({});
  const [scrubTimeById, setScrubTimeById] = useState<Record<string, number>>({});
  const [pendingDeletedIds, setPendingDeletedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSoundIdRef = useRef<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const hasCompletedInitialWaveformLoadRef = useRef(false);

  const sounds = data.sounds;
  const keysInUse = useMemo(
    () => new Set(sounds.map((sound) => sound.key.trim().toLowerCase())),
    [sounds],
  );

  useEffect(() => {
    let cancelled = false;
    const shouldShowInitialSkeleton =
      !hasCompletedInitialWaveformLoadRef.current && sounds.length > 0;
    const load = async () => {
      if (shouldShowInitialSkeleton) {
        setIsWaveformLoading(true);
      }
      const entries = await Promise.all(
        sounds.map(async (sound) => {
          if (!sound.audioDataUrl) return [sound.id, []] as const;
          try {
            const peaks = await decodeWaveformPeaks(sound.audioDataUrl);
            return [sound.id, peaks] as const;
          } catch {
            return [sound.id, []] as const;
          }
        }),
      );
      if (cancelled) return;
      setWaveforms(Object.fromEntries(entries));
      if (shouldShowInitialSkeleton) {
        setIsWaveformLoading(false);
      }
      hasCompletedInitialWaveformLoadRef.current = true;
    };
    void load();
    return () => {
      cancelled = true;
      if (shouldShowInitialSkeleton) {
        setIsWaveformLoading(false);
      }
    };
  }, [sounds]);

  useEffect(() => {
    const nextIds = new Set(sounds.map((sound) => sound.id));
    setPendingDeletedIds((prev) => {
      if (prev.size === 0) return prev;
      const remaining = new Set(
        Array.from(prev).filter((id) => nextIds.has(id)),
      );
      return remaining.size === prev.size ? prev : remaining;
    });
    Object.entries(audioRefs.current).forEach(([id, audio]) => {
      if (!nextIds.has(id)) {
        audio.pause();
        delete audioRefs.current[id];
      }
    });
  }, [sounds]);

  const updateSound = (id: string, updates: Partial<SoundData>) => {
    updateSounds((previous) =>
      previous.map((sound) => (sound.id === id ? { ...sound, ...updates } : sound)),
    );
  };

  const addSound = () => {
    const key = `sound_${sounds.length + 1}`;
    if (keysInUse.has(key.toLowerCase())) return;
    updateSounds((previous) => [...previous, createBaseSound(key)]);
  };

  const removeSound = (id: string) => {
    setPendingDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const audio = audioRefs.current[id];
    if (audio) {
      audio.pause();
      delete audioRefs.current[id];
    }
    setPlayingById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCurrentTimeById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDurationsById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setWaveforms((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    updateSounds((previous) => previous.filter((sound) => sound.id !== id));
  };

  const triggerUpload = (soundId: string) => {
    pendingSoundIdRef.current = soundId;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const soundId = pendingSoundIdRef.current;
    pendingSoundIdRef.current = null;
    event.target.value = "";
    if (
      !file ||
      !soundId ||
      ![".mp3", ".ogg"].some((extension) => file.name.toLowerCase().endsWith(extension))
    ) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      updateSound(soundId, {
        soundString: file.name,
        audioDataUrl: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  const ensureAudio = (sound: SoundData) => {
    if (!sound.audioDataUrl) return null;
    let audio = audioRefs.current[sound.id];
    if (!audio) {
      audio = new Audio();
      audio.preload = "metadata";
      audio.addEventListener("timeupdate", () => {
        setCurrentTimeById((prev) => ({ ...prev, [sound.id]: audio.currentTime || 0 }));
      });
      audio.addEventListener("durationchange", () => {
        const d = Number.isFinite(audio.duration) ? audio.duration : 0;
        if (d > 0) {
          setDurationsById((prev) => ({ ...prev, [sound.id]: d }));
        }
      });
      audio.addEventListener("ended", () => {
        setPlayingById((prev) => ({ ...prev, [sound.id]: false }));
      });
      audioRefs.current[sound.id] = audio;
    }
    if (audio.src !== sound.audioDataUrl) {
      audio.src = sound.audioDataUrl;
      audio.load();
      setCurrentTimeById((prev) => ({ ...prev, [sound.id]: 0 }));
    }
    return audio;
  };

  const togglePlay = (sound: SoundData) => {
    const audio = ensureAudio(sound);
    if (!audio) return;
    const isPlaying = playingById[sound.id];
    if (isPlaying) {
      audio.pause();
      setPlayingById((prev) => ({ ...prev, [sound.id]: false }));
      return;
    }
    setPlayingById((prev) => ({ ...prev, [sound.id]: true }));
    const playPromise = audio.play();
    if (playPromise) {
      void playPromise.catch(() => {
        setPlayingById((prev) => ({ ...prev, [sound.id]: false }));
      });
    }
  };

  const seekTo = (sound: SoundData, timeSeconds: number) => {
    const audio = ensureAudio(sound);
    if (!audio) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : durationsById[sound.id] || 0;
    const clamped = Math.max(0, Math.min(duration, timeSeconds));
    audio.currentTime = clamped;
    setCurrentTimeById((prev) => ({ ...prev, [sound.id]: clamped }));
    setDurationsById((prev) => (duration > 0 ? { ...prev, [sound.id]: duration } : prev));
  };

  const formatTime = (seconds: number): string => {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const filteredSounds = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const visibleSounds = sounds.filter((sound) => !pendingDeletedIds.has(sound.id));
    if (!term) return visibleSounds;
    return visibleSounds.filter((sound) => {
      const key = sound.key.toLowerCase();
      const file = (sound.soundString || "").toLowerCase();
      return key.includes(term) || file.includes(term);
    });
  }, [searchTerm, sounds, pendingDeletedIds]);

  return (
    <Panel
      id="sounds"
      position={position}
      icon={MusicNotes}
      title="Sounds"
      onClose={onClose}
      closeLabel="Close Sounds"
      className="w-80"
      headerClassName="p-4"
      contentClassName="p-4"
      headerActions={
        <span className="text-muted-foreground text-xs">
          {sounds.length} sound{sounds.length === 1 ? "" : "s"}
        </span>
      }
    >
      <div className="space-y-3">
        <div className="bg-background/70 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={addSound}
              icon={<Plus className="h-4 w-4" />}
              className="cursor-pointer w-full"
            >
              Add Sound
            </Button>
          </div>
          <div className="relative">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <InputField
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search sounds..."
              size="sm"
              className="pl-8"
            />
          </div>
        </div>

        <div className="divide-y divide-border/40 max-h-96">
          {isWaveformLoading && sounds.length > 0 ? (
            <div className="space-y-2">
              {[0, 1, 2].map((index) => (
                <div key={`sound-skeleton-${index}`} className="bg-background/60 rounded-xl p-2.5 animate-pulse">
                  <div className="h-8 bg-muted/50 rounded mb-2" />
                  <div className="h-3 bg-muted/40 rounded w-1/2 mb-2" />
                  <div className="h-12 bg-muted/40 rounded mb-2" />
                  <div className="flex justify-between">
                    <div className="h-8 w-20 bg-muted/40 rounded" />
                    <div className="h-8 w-8 bg-muted/40 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredSounds.length === 0 ? (
            <div className="text-center py-8">
              <MusicNotes className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground text-sm">
                {sounds.length === 0 ? "No sounds created yet" : "No sounds match your search"}
              </p>
              {sounds.length === 0 ? (
                <p className="text-muted-foreground text-xs mt-1">Add a sound, then upload an MP3 or OGG file</p>
              ) : null}
            </div>
          ) : (
            filteredSounds.map((sound) => {
              const isPlaying = !!playingById[sound.id];
              const bars = waveforms[sound.id] ?? [];
              const duration = durationsById[sound.id] || 0;
              const isScrubbing = !!scrubbingById[sound.id];
              const effectiveCurrent = isScrubbing
                ? scrubTimeById[sound.id] ?? currentTimeById[sound.id] ?? 0
                : currentTimeById[sound.id] ?? 0;
              const ratio =
                duration > 0 ? Math.max(0, Math.min(1, effectiveCurrent / duration)) : 0;
              return (
                <div key={sound.id} className="bg-background/60 rounded-xl p-2.5">
                  <div className="space-y-2">
                    <InputField
                      label="Name"
                      value={sound.key}
                      onChange={(event) => updateSound(sound.id, { key: event.target.value })}
                      size="sm"
                    />
                    <div className="text-xs text-muted-foreground truncate">
                      {sound.soundString?.trim() ? sound.soundString : "No MP3 or OGG uploaded"}
                    </div>
                    <div className="relative h-12 bg-background/50 px-1 rounded-md">
                      <div className="absolute inset-0 flex items-end gap-[2px] px-1 py-1">
                        {(bars.length > 0 ? bars : new Array(72).fill(0.08)).map((peak, index) => (
                          <div
                            key={`${sound.id}-bar-${index}`}
                            className={`w-[2px] rounded-sm ${index / 72 <= ratio ? "bg-primary/80" : "bg-muted-foreground/35"}`}
                            style={{ height: `${Math.max(8, Math.floor(peak * 34))}px` }}
                          />
                        ))}
                      </div>
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-primary"
                        style={{ left: `calc(${ratio * 100}% - 1px)` }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={duration > 0 ? duration : 1}
                        step={0.01}
                        value={duration > 0 ? effectiveCurrent : 0}
                        disabled={!sound.audioDataUrl}
                        onMouseDown={() =>
                          setScrubbingById((prev) => ({ ...prev, [sound.id]: true }))
                        }
                        onMouseUp={() => {
                          setScrubbingById((prev) => ({ ...prev, [sound.id]: false }));
                          seekTo(sound, scrubTimeById[sound.id] ?? effectiveCurrent);
                        }}
                        onTouchStart={() =>
                          setScrubbingById((prev) => ({ ...prev, [sound.id]: true }))
                        }
                        onTouchEnd={() => {
                          setScrubbingById((prev) => ({ ...prev, [sound.id]: false }));
                          seekTo(sound, scrubTimeById[sound.id] ?? effectiveCurrent);
                        }}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          setScrubTimeById((prev) => ({ ...prev, [sound.id]: next }));
                          if (!scrubbingById[sound.id]) {
                            seekTo(sound, next);
                          }
                        }}
                        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] text-muted-foreground tabular-nums w-20 shrink-0">{`${formatTime(
                        effectiveCurrent,
                      )}/${formatTime(duration)}`}</div>
                      <div className="flex items-center gap-1">
                        <IconButton
                          icon={UploadSimple}
                          tooltip="Upload MP3 or OGG"
                          iconOnly
                          onClick={() => triggerUpload(sound.id)}
                          className="h-8 w-8 rounded-md"
                          iconClassName="h-4 w-4"
                        />
                        <IconButton
                          icon={isPlaying ? Pause : Play}
                          tooltip={isPlaying ? "Pause" : "Play"}
                          disabled={!sound.audioDataUrl}
                          iconOnly
                          onClick={() => togglePlay(sound)}
                          className="h-8 w-8 rounded-md"
                          iconClassName="h-4 w-4"
                        />
                      </div>
                      <IconButton
                        icon={Trash}
                        tooltip="Delete sound"
                        iconOnly
                        onClick={() => removeSound(sound.id)}
                        className="h-8 w-8 rounded-md text-destructive hover:text-destructive shrink-0"
                        iconClassName="h-4 w-4"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.ogg,audio/mpeg,audio/ogg"
        className="hidden"
        onChange={handleFileChange}
      />
    </Panel>
  );
};

export default SoundsPanel;
