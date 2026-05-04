import { useCallback, useMemo } from "react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import {
  GenericItemDialog,
  type DialogTab,
} from "@/components/pages/generic-item-dialog";
import { Input } from "@/components/ui/input";
import { processBalatroCardImage } from "@/lib/media/image-processing-utils";
import type { DeckData } from "@/lib/types";
import { Gear, Image as ImageIcon, TextT } from "@phosphor-icons/react";

interface EditDeckDialogProps {
  editingItem: DeckData | null;
  setEditingItem: (item: DeckData | null) => void;
  onSave: (id: string, updates: Partial<DeckData>) => void;
}

export function EditDeckDialog({
  editingItem,
  setEditingItem,
  onSave,
}: EditDeckDialogProps) {
  const processDeckImage = processBalatroCardImage;
  const deckDialogTabs: DialogTab<DeckData>[] = useMemo(
    () => [
      {
        id: "visual",
        label: "Visual & Data",
        icon: ImageIcon,
        groups: [
          {
            id: "assets",
            label: "Assets",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "image",
                type: "image",
                label: "Main Sprite",
                description: "71x95px (auto-upscaled) or 142x190px",
                processFile: processDeckImage,
              },
            ],
          },
          {
            id: "data",
            label: "Basic Data",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "name",
                type: "text",
                label: "Name",
                placeholder: "Deck Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "b_deck",
                className: "col-span-2",
              },
            ],
          },
          {
            id: "properties",
            label: "Properties",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "unlocked",
                type: "switch",
                label: "Unlocked by Default",
              },
              {
                id: "discovered",
                type: "switch",
                label: "Discovered by Default",
              },
              {
                id: "no_collection",
                type: "switch",
                label: "Hidden from Collection",
              },
              {
                id: "no_interest",
                type: "switch",
                label: "No Interest",
              },
              {
                id: "no_faces",
                type: "switch",
                label: "No Face Cards",
              },
              {
                id: "erratic_deck",
                type: "switch",
                label: "Erratic Deck",
              },
            ],
          },
        ],
      },
      {
        id: "description",
        label: "Description",
        icon: TextT,
        groups: [
          {
            id: "desc",
            fields: [
              {
                id: "description",
                type: "rich-textarea",
                label: "Description",
                validate: (val) => (!val ? "Description is required" : null),
              },
            ],
          },
        ],
      },
      {
        id: "advanced",
        label: "Advanced",
        icon: Gear,
        groups: [
          {
            id: "starting",
            label: "Starting Items",
            fields: [
              {
                id: "Config_vouchers",
                type: "custom",
                label: "Starting Vouchers",
                render: (value, onChange) => (
                  <div className="space-y-2">
                    <Input
                      value={Array.isArray(value) ? value.join(", ") : ""}
                      onChange={(e) =>
                        onChange(
                          e.target.value
                            .split(",")
                            .map((s: string) => s.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="v_overstock_norm, v_paint_brush..."
                    />
                  </div>
                ),
              },
              {
                id: "Config_consumables",
                type: "custom",
                label: "Starting Consumables",
                render: (value, onChange) => (
                  <div className="space-y-2">
                    <Input
                      value={Array.isArray(value) ? value.join(", ") : ""}
                      onChange={(e) =>
                        onChange(
                          e.target.value
                            .split(",")
                            .map((s: string) => s.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="c_fool, c_death..."
                    />
                  </div>
                ),
              },
            ],
          },
        ],
      },
    ],
    [processDeckImage],
  );

  const renderPreview = useCallback(
    (item: DeckData | null) => (
      <BalatroCard type="deck" data={item || {}} size="lg" />
    ),
    [],
  );

  return (
    <GenericItemDialog
      open={!!editingItem}
      onOpenChange={(open) => !open && setEditingItem(null)}
      item={editingItem}
      title={`Edit ${editingItem?.name || "Deck"}`}
      description="Modify deck properties."
      tabs={deckDialogTabs}
      onSave={onSave}
      renderPreview={renderPreview}
      showPlaceholderPicker
      placeholderCategory="deck"
    />
  );
}
