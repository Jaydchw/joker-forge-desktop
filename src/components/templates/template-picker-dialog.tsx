import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import {
  Copy,
  FileArrowUp,
  FloppyDiskBack,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { pushGlobalAlert } from "@/lib/app/global-alerts-bus";
import type {
  ItemTemplateEntry,
  RuleTemplateEntry,
  TemplateEntry,
} from "@/lib/content/templates";
import {
  parseTemplateBundleText,
  serializeTemplateBundle,
  TEMPLATE_FILE_EXTENSION,
  useTemplateStore,
} from "@/lib/content/templates";
import {
  TemplateCard,
  getTemplateImage,
} from "@/components/templates/template-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  EditBoosterDialog,
  EditConsumableDialog,
  EditConsumableSetDialog,
  EditDeckDialog,
  EditEditionDialog,
  EditEnhancementDialog,
  EditJokerDialog,
  EditRarityDialog,
  EditSealDialog,
  EditSoundDialog,
  EditVoucherDialog,
} from "@/components/edit-dialogs";
import type {
  BoosterData,
  ConsumableData,
  ConsumableSetData,
  DeckData,
  EditionData,
  EnhancementData,
  JokerData,
  RarityData,
  SealData,
  SoundData,
  VoucherData,
} from "@/lib/core/types";

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  templates: TemplateEntry[];
  onUseTemplate: (template: ItemTemplateEntry | RuleTemplateEntry) => void;
}

const sanitizeExportName = (name: string): string =>
  name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "jokerforge-templates";

const buildTemplatePayload = (
  template: ItemTemplateEntry,
  updates: Record<string, unknown>,
  nextName: string,
): Record<string, unknown> => {
  const mergedPayload: Record<string, unknown> = {
    ...(template.payload as Record<string, unknown>),
    ...updates,
    name: nextName,
  };
  delete mergedPayload.id;
  delete mergedPayload.orderValue;
  return mergedPayload;
};

export function TemplatePickerDialog({
  open,
  onOpenChange,
  title,
  description,
  templates,
  onUseTemplate,
}: TemplatePickerDialogProps) {
  const [search, setSearch] = useState("");
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const {
    upsertImportedTemplates,
    duplicateTemplate,
    deleteTemplates,
    updateItemTemplate,
  } = useTemplateStore();
  const isItemKind = templates[0]?.kind === "item";

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return templates.filter((template) => {
      if (!needle) return true;
      return [template.name, template.itemType, template.kind]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [search, templates]);

  const imageLayout = useMemo(() => {
    const hasImage = filtered.some(
      (template) =>
        template.kind === "item" && Boolean(getTemplateImage(template)),
    );
    return hasImage ? "mixed" : "text-only";
  }, [filtered]);

  const handleUseTemplate = (template: TemplateEntry) => {
    onUseTemplate(template as ItemTemplateEntry | RuleTemplateEntry);
    onOpenChange(false);
  };

  const editingTemplate = useMemo(
    () =>
      templates.find(
        (entry) => entry.id === editingTemplateId && entry.kind === "item",
      ) as ItemTemplateEntry | undefined,
    [editingTemplateId, templates],
  );

  const editingDialogItem = useMemo(() => {
    if (!editingTemplate) return null;
    const payload = (editingTemplate.payload || {}) as Record<string, unknown>;
    return {
      id: editingTemplate.id,
      ...payload,
      name: editingTemplate.name,
    };
  }, [editingTemplate]);

  const handleItemTemplateSave = (
    id: string,
    updates: Record<string, unknown>,
  ) => {
    if (!editingTemplate) return;
    const nextName =
      typeof updates.name === "string" ? updates.name : editingTemplate.name;
    const nextPayload = buildTemplatePayload(
      editingTemplate,
      updates,
      nextName,
    );
    updateItemTemplate(id, { name: nextName, payload: nextPayload });
    setEditingTemplateId(null);
  };

  const handleImport = async () => {
    try {
      const selected = await openDialog({
        title: "Import Templates",
        multiple: false,
        filters: [
          {
            name: "Joker Forge Templates",
            extensions: [TEMPLATE_FILE_EXTENSION],
          },
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
      });

      if (!selected || Array.isArray(selected)) return;

      const raw = await readTextFile(selected);
      const imported = parseTemplateBundleText(raw);
      const matchingKind = templates[0]?.kind;
      const matchingTypeSet = new Set(
        templates.map((template) => template.itemType),
      );
      const filteredImport = imported.filter((entry) => {
        if (matchingKind && entry.kind !== matchingKind) return false;
        if (matchingTypeSet.size > 0 && !matchingTypeSet.has(entry.itemType))
          return false;
        return true;
      });

      const count = upsertImportedTemplates(filteredImport);
      pushGlobalAlert({
        type: "success",
        title: "Templates Imported",
        message: `Imported ${count} template${count === 1 ? "" : "s"} for this picker.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown import error.";
      pushGlobalAlert({
        type: "danger",
        title: "Import Failed",
        message,
      });
    }
  };

  const handleExportSingle = async (template: TemplateEntry) => {
    try {
      const targetPath = await save({
        title: "Export Template",
        defaultPath: `${sanitizeExportName(`${template.name}-template`)}.${TEMPLATE_FILE_EXTENSION}`,
        filters: [
          {
            name: "Joker Forge Templates",
            extensions: [TEMPLATE_FILE_EXTENSION],
          },
        ],
      });
      if (!targetPath) return;
      await writeTextFile(targetPath, serializeTemplateBundle([template]));
      pushGlobalAlert({
        type: "success",
        title: "Template Exported",
        message: `Exported \"${template.name}\".`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown export error.";
      pushGlobalAlert({
        type: "danger",
        title: "Export Failed",
        message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search templates..."
              className="cursor-text"
            />
            <Button
              size="sm"
              onClick={handleImport}
              icon={<FileArrowUp className="h-4 w-4" />}
            >
              Import Templates
            </Button>
          </div>
        </div>

        <ScrollArea className="h-124">
          <div
            className={
              isItemKind
                ? "grid auto-rows-fr grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4"
                : "grid auto-rows-fr grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {filtered.length === 0 && (
              <div className="col-span-full px-2 py-3 text-sm text-muted-foreground">
                <div>No matching templates.</div>
                {!isItemKind && (
                  <div className="mt-1 text-xs">
                    Tip: save a rule as a template from the Rule Card menu, then
                    reopen this picker.
                  </div>
                )}
              </div>
            )}
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                imageLayout={imageLayout}
                onCardClick={handleUseTemplate}
                actions={[
                  ...(template.kind === "item"
                    ? [
                        {
                          id: "edit",
                          label: "Edit Template",
                          icon: PencilSimple,
                          onClick: () => setEditingTemplateId(template.id),
                        },
                      ]
                    : []),
                  {
                    id: "duplicate",
                    label: "Duplicate Template",
                    icon: Copy,
                    onClick: () => duplicateTemplate(template.id),
                  },
                  {
                    id: "export",
                    label: "Export Template",
                    icon: FloppyDiskBack,
                    onClick: () => {
                      void handleExportSingle(template);
                    },
                  },
                  {
                    id: "delete",
                    label: "Delete Template",
                    icon: Trash,
                    onClick: () => setConfirmDeleteIds([template.id]),
                    destructive: true,
                  },
                ]}
              />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>

      <ConfirmDialog
        open={confirmDeleteIds.length > 0}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setConfirmDeleteIds([]);
        }}
        title="Delete Template(s)?"
        description={`This will delete ${confirmDeleteIds.length} template${confirmDeleteIds.length === 1 ? "" : "s"}.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => {
          deleteTemplates(confirmDeleteIds);
          setConfirmDeleteIds([]);
        }}
      />

      {editingTemplate?.kind === "item" &&
        editingTemplate.itemType === "joker" && (
          <EditJokerDialog
            editingItem={editingDialogItem as JokerData | null}
            setEditingItem={(item) => {
              if (!item) setEditingTemplateId(null);
            }}
            onSave={(id, updates) =>
              handleItemTemplateSave(id, updates as Record<string, unknown>)
            }
          />
        )}
      {editingTemplate?.kind === "item" &&
        editingTemplate.itemType === "booster" && (
          <EditBoosterDialog
            editingItem={editingDialogItem as BoosterData | null}
            setEditingItem={(item) => {
              if (!item) setEditingTemplateId(null);
            }}
            onSave={(id, updates) =>
              handleItemTemplateSave(id, updates as Record<string, unknown>)
            }
          />
        )}
      {editingTemplate?.kind === "item" &&
        editingTemplate.itemType === "consumable" && (
          <EditConsumableDialog
            editingItem={editingDialogItem as ConsumableData | null}
            setEditingItem={(item) => {
              if (!item) setEditingTemplateId(null);
            }}
            onSave={(id, updates) =>
              handleItemTemplateSave(id, updates as Record<string, unknown>)
            }
          />
        )}
      {editingTemplate?.kind === "item" &&
        editingTemplate.itemType === "deck" && (
          <EditDeckDialog
            editingItem={editingDialogItem as DeckData | null}
            setEditingItem={(item) => {
              if (!item) setEditingTemplateId(null);
            }}
            onSave={(id, updates) =>
              handleItemTemplateSave(id, updates as Record<string, unknown>)
            }
          />
        )}
      {editingTemplate?.kind === "item" &&
        editingTemplate.itemType === "edition" && (
          <EditEditionDialog
            editingItem={editingDialogItem as EditionData | null}
            setEditingItem={(item) => {
              if (!item) setEditingTemplateId(null);
            }}
            onSave={(id, updates) =>
              handleItemTemplateSave(id, updates as Record<string, unknown>)
            }
          />
        )}
      {editingTemplate?.kind === "item" &&
        editingTemplate.itemType === "enhancement" && (
          <EditEnhancementDialog
            editingItem={editingDialogItem as EnhancementData | null}
            setEditingItem={(item) => {
              if (!item) setEditingTemplateId(null);
            }}
            onSave={(id, updates) =>
              handleItemTemplateSave(id, updates as Record<string, unknown>)
            }
          />
        )}
      {editingTemplate?.kind === "item" &&
        editingTemplate.itemType === "seal" && (
          <EditSealDialog
            editingItem={editingDialogItem as SealData | null}
            setEditingItem={(item) => {
              if (!item) setEditingTemplateId(null);
            }}
            onSave={(id, updates) =>
              handleItemTemplateSave(id, updates as Record<string, unknown>)
            }
          />
        )}
      {editingTemplate?.kind === "item" &&
        editingTemplate.itemType === "voucher" && (
          <EditVoucherDialog
            editingItem={editingDialogItem as VoucherData | null}
            setEditingItem={(item) => {
              if (!item) setEditingTemplateId(null);
            }}
            onSave={(id, updates) =>
              handleItemTemplateSave(id, updates as Record<string, unknown>)
            }
          />
        )}
      {editingTemplate?.kind === "item" &&
        editingTemplate.itemType === "rarity" && (
          <EditRarityDialog
            editingItem={editingDialogItem as RarityData | null}
            setEditingItem={(item) => {
              if (!item) setEditingTemplateId(null);
            }}
            onSave={(id, updates) =>
              handleItemTemplateSave(id, updates as Record<string, unknown>)
            }
          />
        )}
      {editingTemplate?.kind === "item" &&
        editingTemplate.itemType === "consumableSet" && (
          <EditConsumableSetDialog
            editingItem={editingDialogItem as ConsumableSetData | null}
            setEditingItem={(item) => {
              if (!item) setEditingTemplateId(null);
            }}
            onSave={(id, updates) =>
              handleItemTemplateSave(id, updates as Record<string, unknown>)
            }
          />
        )}
      {editingTemplate?.kind === "item" &&
        editingTemplate.itemType === "sound" && (
          <EditSoundDialog
            editingItem={editingDialogItem as SoundData | null}
            setEditingItem={(item) => {
              if (!item) setEditingTemplateId(null);
            }}
            onSave={(id, updates) =>
              handleItemTemplateSave(id, updates as Record<string, unknown>)
            }
          />
        )}
    </Dialog>
  );
}
