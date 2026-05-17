import { useMemo, useState } from "react";
import { open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookmarksSimple,
  Copy,
  FileArrowDown,
  FileArrowUp,
  Files,
  FloppyDiskBack,
  PencilSimple,
  Shapes,
  Trash,
  Rows,
} from "@phosphor-icons/react";
import { cn } from "@/lib/core/utils";
import { pushGlobalAlert } from "@/lib/app/global-alerts-bus";
import {
  parseTemplateBundleText,
  serializeTemplateBundle,
  TEMPLATE_FILE_EXTENSION,
  type ItemTemplateEntry,
  type TemplateEntry,
} from "@/lib/content/templates";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import IconButton from "@/components/ui/icon-button";
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
import {
  TemplateCard,
  capitalizeLabel,
  getTemplateImage,
} from "@/components/templates/template-card";
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

interface TemplateLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TemplateEntry[];
  onDeleteTemplates: (templateIds: string[]) => void;
  onImportTemplates: (templates: TemplateEntry[]) => number;
  onUpdateTemplateName?: (templateId: string, nextName: string) => void;
  onUpdateItemTemplate?: (
    templateId: string,
    input: { name: string; payload: object },
  ) => void;
  onDuplicateTemplate?: (templateId: string) => void;
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

export function TemplateLibraryDialog({
  open,
  onOpenChange,
  templates,
  onDeleteTemplates,
  onImportTemplates,
  onUpdateTemplateName,
  onUpdateItemTemplate,
  onDuplicateTemplate,
}: TemplateLibraryDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [kindFilter, setKindFilter] = useState<"item" | "rule">("item");
  const [typeFilter, setTypeFilter] = useState<"all" | string>("all");
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [renameTemplateId, setRenameTemplateId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const kindTemplates = useMemo(
    () => templates.filter((template) => template.kind === kindFilter),
    [kindFilter, templates],
  );

  const availableTypes = useMemo(
    () =>
      Array.from(new Set(kindTemplates.map((template) => template.itemType))),
    [kindTemplates],
  );

  const filteredTemplates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return kindTemplates.filter((template) => {
      if (typeFilter !== "all" && template.itemType !== typeFilter)
        return false;
      if (!needle) return true;
      return [template.name, template.itemType]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [kindTemplates, search, typeFilter]);

  const imageLayout = useMemo(() => {
    const hasImage = filteredTemplates.some(
      (template) =>
        template.kind === "item" && Boolean(getTemplateImage(template)),
    );
    return hasImage ? "mixed" : "text-only";
  }, [filteredTemplates]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedTemplates = useMemo(
    () => templates.filter((template) => selectedIdSet.has(template.id)),
    [selectedIdSet, templates],
  );

  const editingTemplate = useMemo(
    () =>
      templates.find(
        (entry) => entry.id === editingTemplateId && entry.kind === "item",
      ) as ItemTemplateEntry | undefined,
    [editingTemplateId, templates],
  );

  const renameTemplate = useMemo(
    () => templates.find((entry) => entry.id === renameTemplateId),
    [renameTemplateId, templates],
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
    if (!onUpdateItemTemplate || !editingTemplate) return;
    const nextName =
      typeof updates.name === "string" ? updates.name : editingTemplate.name;
    const nextPayload = buildTemplatePayload(
      editingTemplate,
      updates,
      nextName,
    );
    onUpdateItemTemplate(id, { name: nextName, payload: nextPayload });
    setEditingTemplateId(null);
    pushGlobalAlert({
      type: "success",
      title: "Template Updated",
      message: `Saved changes to "${nextName}".`,
    });
  };

  const handleRenameSave = () => {
    if (!renameTemplateId || !onUpdateTemplateName) return;
    const nextName = renameValue.trim();
    if (!nextName) return;
    onUpdateTemplateName(renameTemplateId, nextName);
    setRenameTemplateId(null);
    setRenameValue("");
    pushGlobalAlert({
      type: "success",
      title: "Template Renamed",
      message: `Renamed to "${nextName}".`,
    });
  };

  const canDeleteSelected = selectedIds.length > 0;
  const canExportSelected = selectedIds.length > 0;

  const toggleSelectedId = (templateId: string) => {
    setSelectedIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId],
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredTemplates.map((template) => template.id);
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allFilteredSelected = filteredIds.every((id) => prevSet.has(id));
      if (allFilteredSelected) {
        return prev.filter((id) => !filteredIds.includes(id));
      }
      filteredIds.forEach((id) => prevSet.add(id));
      return Array.from(prevSet);
    });
  };

  const exportTemplatesToFile = async (
    exportTemplates: TemplateEntry[],
    defaultName: string,
  ) => {
    if (exportTemplates.length === 0) {
      pushGlobalAlert({
        type: "caution",
        title: "No Templates Selected",
        message: "Select at least one template to export.",
      });
      return;
    }

    try {
      const targetPath = await save({
        title: "Export Templates",
        defaultPath: `${sanitizeExportName(defaultName)}.${TEMPLATE_FILE_EXTENSION}`,
        filters: [
          {
            name: "Joker Forge Templates",
            extensions: [TEMPLATE_FILE_EXTENSION],
          },
        ],
      });

      if (!targetPath) return;

      await writeTextFile(targetPath, serializeTemplateBundle(exportTemplates));
      pushGlobalAlert({
        type: "success",
        title: "Templates Exported",
        message: `Exported ${exportTemplates.length} template${exportTemplates.length === 1 ? "" : "s"}.`,
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

  const handleExportAll = async () => {
    await exportTemplatesToFile(templates, "all-templates");
  };

  const handleExportSelected = async () => {
    await exportTemplatesToFile(selectedTemplates, "selected-templates");
  };

  const handleExportSingle = async (template: TemplateEntry) => {
    await exportTemplatesToFile([template], `${template.name}-template`);
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
      const count = onImportTemplates(imported);

      pushGlobalAlert({
        type: "success",
        title: "Templates Imported",
        message: `Imported ${count} template${count === 1 ? "" : "s"}.`,
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

  const allFilteredSelected =
    filteredTemplates.length > 0 &&
    filteredTemplates.every((template) => selectedIdSet.has(template.id));

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedIds([]);
          }
          onOpenChange(nextOpen);
        }}
      >
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shapes className="h-5 w-5 text-primary" />
              <span>Template Library</span>
            </DialogTitle>
            <DialogDescription>
              Manage item and rule templates, and import/export{" "}
              <code>.jftemplate</code> files.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search templates..."
              className="h-9 min-w-56 flex-1 cursor-text"
            />
            <Button
              size="sm"
              onClick={handleImport}
              icon={<FileArrowUp className="h-4 w-4" />}
            >
              Import Templates
            </Button>
            <IconButton
              icon={FileArrowDown}
              tooltip="Export Selected"
              onClick={() => void handleExportSelected()}
              disabled={!canExportSelected}
            />
            <IconButton
              icon={Trash}
              tooltip="Delete Selected"
              onClick={() => setConfirmDeleteIds(selectedIds)}
              disabled={!canDeleteSelected}
              className="text-destructive hover:text-destructive"
            />
            <IconButton
              icon={Files}
              tooltip="Export All"
              onClick={() => void handleExportAll()}
              disabled={templates.length === 0}
            />
            <IconButton
              icon={Trash}
              tooltip="Delete All"
              onClick={() =>
                setConfirmDeleteIds(templates.map((template) => template.id))
              }
              disabled={templates.length === 0}
              className="text-destructive hover:text-destructive"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setKindFilter("item");
                setTypeFilter("all");
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-t-xl border-b-2 px-4 py-2 text-sm font-semibold",
                kindFilter === "item"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <BookmarksSimple className="h-4 w-4" />
              Item Templates
            </button>
            <button
              type="button"
              onClick={() => {
                setKindFilter("rule");
                setTypeFilter("all");
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-t-xl border-b-2 px-4 py-2 text-sm font-semibold",
                kindFilter === "rule"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Rows className="h-4 w-4" />
              Rule Templates
            </button>
          </div>

          <div className="h-px bg-border/60" />

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={typeFilter === "all" ? "secondary" : "ghost"}
                onClick={() => setTypeFilter("all")}
              >
                All
              </Button>
              {availableTypes.map((itemType) => (
                <Button
                  key={itemType}
                  size="sm"
                  variant={typeFilter === itemType ? "secondary" : "ghost"}
                  onClick={() => setTypeFilter(itemType)}
                >
                  {capitalizeLabel(itemType)}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="cursor-pointer font-medium hover:text-foreground"
              >
                {allFilteredSelected ? "Deselect Filtered" : "Select Filtered"}
              </button>
              <span>
                {selectedIds.length} selected / {templates.length} total
              </span>
            </div>
          </div>

          <ScrollArea className="h-124">
            <div
              className={cn(
                "grid auto-rows-fr gap-3 p-1",
                kindFilter === "item"
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
              )}
            >
              {filteredTemplates.length === 0 && (
                <div className="col-span-full px-2 py-3 text-sm text-muted-foreground">
                  No templates found.
                </div>
              )}
              {filteredTemplates.map((template) => {
                const checked = selectedIdSet.has(template.id);

                return (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    imageLayout={imageLayout}
                    selectable
                    selected={checked}
                    onToggleSelect={toggleSelectedId}
                    actions={[
                      ...(template.kind === "item" && onUpdateItemTemplate
                        ? [
                            {
                              id: "edit",
                              label: "Edit Template",
                              icon: PencilSimple,
                              onClick: () => setEditingTemplateId(template.id),
                            },
                          ]
                        : []),
                      ...(template.kind === "rule" && onUpdateTemplateName
                        ? [
                            {
                              id: "rename",
                              label: "Rename Template",
                              icon: PencilSimple,
                              onClick: () => {
                                setRenameTemplateId(template.id);
                                setRenameValue(template.name);
                              },
                            },
                          ]
                        : []),
                      {
                        id: "duplicate",
                        label: "Duplicate Template",
                        icon: Copy,
                        onClick: () => onDuplicateTemplate?.(template.id),
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
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

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
          onDeleteTemplates(confirmDeleteIds);
          setSelectedIds((prev) =>
            prev.filter((id) => !confirmDeleteIds.includes(id)),
          );
          setConfirmDeleteIds([]);
        }}
      />

      <Dialog
        open={!!renameTemplateId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setRenameTemplateId(null);
            setRenameValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Template</DialogTitle>
            <DialogDescription>
              Update the name for "{renameTemplate?.name ?? "template"}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleRenameSave();
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setRenameTemplateId(null);
                  setRenameValue("");
                }
              }}
              placeholder="Template name"
              className="cursor-text"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRenameTemplateId(null);
                  setRenameValue("");
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleRenameSave}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
