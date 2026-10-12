import { useId, useMemo, useRef, useState } from "react";
import { GenericItemDialogMini } from "@/components/pages/generic-item-dialog-mini";
import type { DialogTab } from "@/components/pages/generic-item-dialog";
import type { SoundData } from "@/lib/core/types";
import { MusicNotes } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SoundFileControl } from "@/components/sounds/sound-file-control";
import { getSoundChanges, getSoundKeyError, getSoundMixError } from "@/lib/sounds/sound-editor-utils";

interface EditSoundDialogProps {
  editingItem: SoundData | null;
  setEditingItem: (item: SoundData | null) => void;
  onSave: (id: string, updates: Partial<SoundData & { name?: string }>) => void;
  mode?: "template" | "project";
  sounds?: SoundData[];
  modPrefix?: string;
}

type SoundTemplateItem = SoundData & { name?: string };

export function EditSoundDialog({
  mode = "template",
  ...props
}: EditSoundDialogProps) {
  if (mode === "project") {
    return props.editingItem ? <ProjectSoundDialog key={props.editingItem.id} {...props} editingItem={props.editingItem} /> : null;
  }
  return <TemplateSoundDialog {...props} />;
}

function ProjectSoundDialog({
  editingItem,
  setEditingItem,
  onSave,
  sounds = [],
  modPrefix = "",
}: EditSoundDialogProps & { editingItem: SoundData }) {
  const inputId = useId();
  const initial = useRef({ ...editingItem, volume: editingItem.volume ?? 1, pitch: editingItem.pitch ?? 1, replace: editingItem.replace ?? "" });
  const [draft, setDraft] = useState(initial.current);
  const [key, setKey] = useState(editingItem.key);
  const [volume, setVolume] = useState(String(initial.current.volume));
  const [pitch, setPitch] = useState(String(initial.current.pitch));
  const [replace, setReplace] = useState(initial.current.replace);
  const [isUploading, setIsUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const keyError = getSoundKeyError(key, sounds, editingItem.id, modPrefix);
  const volumeError = getSoundMixError(volume, "volume");
  const pitchError = getSoundMixError(pitch, "pitch");
  const preview = { ...draft, key, volume: volumeError ? 1 : Number(volume), pitch: pitchError ? 1 : Number(pitch) };

  const save = () => {
    setSubmitted(true);
    if (isUploading || keyError || volumeError || pitchError) return;
    onSave(editingItem.id, getSoundChanges(initial.current, {
      ...draft, key: key.trim(), volume: Number(volume), pitch: Number(pitch), replace: replace.trim(),
    }));
    setEditingItem(null);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
      <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border-border bg-card">
        <DialogHeader>
          <DialogTitle>Edit {editingItem.key || "Sound"}</DialogTitle>
          <DialogDescription>Upload audio and set its playback options.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${inputId}-key`}>Sound key</Label>
            <Input id={`${inputId}-key`} value={key} onChange={(event) => setKey(event.target.value)} aria-invalid={submitted && !!keyError} aria-describedby={submitted && keyError ? `${inputId}-key-error` : undefined} placeholder="custom_sound" />
            {submitted && keyError ? <p id={`${inputId}-key-error`} role="alert" className="text-xs text-destructive">{keyError}</p> : <p className="text-xs text-muted-foreground">{modPrefix ? `The mod prefix ${modPrefix}_ is added automatically.` : "Use this key to select the sound in your rules."}</p>}
          </div>
          <SoundFileControl sound={preview} onUpload={(upload) => setDraft((previous) => ({ ...previous, ...upload }))} onPendingChange={setIsUploading} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${inputId}-volume`}>Volume</Label>
              <Input id={`${inputId}-volume`} type="number" min={0} step={0.1} value={volume} onChange={(event) => setVolume(event.target.value)} aria-invalid={submitted && !!volumeError} />
              {submitted && volumeError && <p role="alert" className="text-xs text-destructive">{volumeError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${inputId}-pitch`}>Pitch</Label>
              <Input id={`${inputId}-pitch`} type="number" min={0.01} step={0.1} value={pitch} onChange={(event) => setPitch(event.target.value)} aria-invalid={submitted && !!pitchError} />
              {submitted && pitchError && <p role="alert" className="text-xs text-destructive">{pitchError}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${inputId}-replace`}>Replace sound key</Label>
            <Input id={`${inputId}-replace`} value={replace} onChange={(event) => setReplace(event.target.value)} placeholder="Optional, e.g. music1" />
            <p className="text-xs text-muted-foreground">Enter an existing sound key to replace it with this audio.</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setEditingItem(null)} className="cursor-pointer">Cancel</Button>
          <Button type="button" onClick={save} disabled={isUploading} className="cursor-pointer">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateSoundDialog({
  editingItem,
  setEditingItem,
  onSave,
}: EditSoundDialogProps) {
  const soundDialogTabs: DialogTab<SoundTemplateItem>[] = useMemo(
    () => [
      {
        id: "details",
        label: "Details",
        icon: MusicNotes,
        groups: [
          {
            id: "basic",
            label: "Basic",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "name",
                type: "text",
                label: "Template Name",
                className: "col-span-2",
              },
              {
                id: "key",
                type: "text",
                label: "Sound Key",
                placeholder: "s_custom_sound",
                className: "col-span-2",
              },
              {
                id: "soundString",
                type: "text",
                label: "Sound String",
                placeholder: "custom_sound.wav",
                className: "col-span-2",
              },
            ],
          },
          {
            id: "mix",
            label: "Mix",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "volume",
                type: "number",
                label: "Volume",
                step: 0.1,
              },
              {
                id: "pitch",
                type: "number",
                label: "Pitch",
                step: 0.1,
              },
              {
                id: "replace",
                type: "text",
                label: "Replace",
                placeholder: "s_vanilla_sound",
                className: "col-span-2",
              },
            ],
          },
        ],
      },
    ],
    [],
  );

  return (
    <GenericItemDialogMini
      open={!!editingItem}
      onOpenChange={(open) => !open && setEditingItem(null)}
      item={editingItem as SoundTemplateItem | null}
      title={`Edit ${editingItem?.key || "Sound"}`}
      description="Update template sound settings."
      tabs={soundDialogTabs}
      onSave={(id, updates) => onSave(id, updates)}
    />
  );
}
