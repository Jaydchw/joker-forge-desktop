import { useMemo } from "react";
import { GenericItemDialogMini } from "@/components/pages/generic-item-dialog-mini";
import type { DialogTab } from "@/components/pages/generic-item-dialog";
import type { SoundData } from "@/lib/core/types";
import { MusicNotes } from "@phosphor-icons/react";

interface EditSoundDialogProps {
  editingItem: SoundData | null;
  setEditingItem: (item: SoundData | null) => void;
  onSave: (id: string, updates: Partial<SoundData & { name?: string }>) => void;
}

type SoundTemplateItem = SoundData & { name?: string };

export function EditSoundDialog({
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
