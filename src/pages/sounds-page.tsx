import { useMemo, useState } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { useProjectData, useModName } from "@/lib/storage";
import { SoundData } from "@/lib/types";
import {
  BookmarksSimple,
  PencilSimple,
  SpeakerHigh,
  Trash,
} from "@phosphor-icons/react";
import {
  instantiateItemFromTemplate,
  useTemplateStore,
  type ItemTemplateEntry,
} from "@/lib/templates";
import { TemplatePickerDialog } from "@/components/templates/template-picker-dialog";
import { pushGlobalAlert } from "@/lib/global-alerts-bus";

export default function SoundsPage() {
  const { data, updateSounds, isHydrating } = useProjectData();
  const modName = useModName();
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const { createItemTemplate, getItemTemplatesForType } = useTemplateStore();
  const soundTemplates = useMemo(
    () => getItemTemplatesForType("sound"),
    [getItemTemplatesForType],
  );

  const handleUpdate = (id: string, updates: Partial<SoundData>) => {
    updateSounds(
      data.sounds.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  };

  const createBaseSound = (): SoundData => ({
    id: crypto.randomUUID(),
    key: "new_sound",
    soundString: "sound_data",
    volume: 1,
    pitch: 1,
  });

  const handleCreate = () => {
    const newSound = createBaseSound();
    updateSounds([...data.sounds, newSound]);
  };

  const handleCreateFromTemplate = (template: ItemTemplateEntry) => {
    const baseSound = createBaseSound();
    const templatedSound = instantiateItemFromTemplate(baseSound, template);
    updateSounds([...data.sounds, templatedSound]);
    pushGlobalAlert({
      type: "success",
      title: "Template Applied",
      message: `Created Sound from "${template.name}".`,
    });
  };

  const handleDelete = (id: string) =>
    updateSounds(data.sounds.filter((s) => s.id !== id));

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDelete);

  return (
    <>
      <GenericItemPage<SoundData>
        title="Sounds"
        subtitle={modName}
        items={data.sounds}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        onAddFromTemplate={soundTemplates.length > 0 ? () => setIsTemplatePickerOpen(true) : undefined}
        addNewLabel="Create Sound"
        addFromTemplateLabel="Create Sound from Template"
        searchProps={{
          searchFn: (item, term) => item.key.toLowerCase().includes(term),
        }}
        sortOptions={[
          {
            label: "ID Order",
            value: "id",
            sortFn: (a, b) => a.key.localeCompare(b.key),
          },
        ]}
        renderCard={(item) => (
          <GenericItemCard
            key={item.id}
            name={item.key}
            description={`Volume: ${item.volume} | Pitch: ${item.pitch}`}
            onUpdate={(updates) => handleUpdate(item.id, { key: updates.name })}
            image={
              <SpeakerHigh className="h-20 w-20 text-muted-foreground/20" />
            }
            actions={[
              {
                id: "edit",
                label: "Edit",
                icon: <PencilSimple className="h-4 w-4" />,
                onClick: () => {},
              },
              {
                id: "saveTemplate",
                label: "Save as Template",
                icon: <BookmarksSimple className="h-4 w-4" />,
                onClick: () => {
                  createItemTemplate({
                    name: `${item.key} Template`,
                    itemType: "sound",
                    payload: item as unknown as Record<string, unknown>,
                  });
                  pushGlobalAlert({
                    type: "success",
                    title: "Template Saved",
                    message: `Saved "${item.key}" as a template.`,
                  });
                },
              },
              {
                id: "delete",
                label: "Delete",
                icon: <Trash className="h-4 w-4" />,
                variant: "destructive",
                onClick: () => requestDelete(item.id, item.key),
              },
            ]}
          />
        )}
      />
      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
        title="Create Sound from Template"
        description="Select a Sound template to start from."
        templates={soundTemplates}
        onUseTemplate={(template) =>
          handleCreateFromTemplate(template as ItemTemplateEntry)
        }
      />
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        title="Delete this sound?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this sound"}
            </span>
            . This action cannot be undone.
          </span>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={confirmDelete}
      />
    </>
  );
}

