import { useCallback, useMemo, useState } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { useProjectData, useModName } from "@/lib/storage";
import { BoosterData } from "@/lib/types";
import {
  Package,
  PencilSimple,
  Trash,
  Eye,
  EyeSlash,
  Hand,
  Play,
  Image as ImageIcon,
  TextT,
  Gear,
} from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { Input } from "@/components/ui/input";

export default function BoostersPage() {
  const { data, updateBoosters } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<BoosterData | null>(null);

  const processBoosterImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          if (img.width === 71 && img.height === 95) {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = 142;
            canvas.height = 190;
            if (ctx) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(img, 0, 0, 142, 190);
              resolve(canvas.toDataURL("image/png"));
            } else {
              reject(new Error("Canvas context failed"));
            }
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleUpdate = useCallback(
    (id: string, updates: Partial<BoosterData>) => {
      updateBoosters(
        data.boosters.map((b) => (b.id === id ? { ...b, ...updates } : b)),
      );
    },
    [data.boosters, updateBoosters],
  );

  const handleCreate = useCallback(() => {
    const newBooster: BoosterData = {
      id: crypto.randomUUID(),
      objectType: "booster",
      name: "Standard Pack",
      description: "Choose 1 of 3",
      orderValue: data.boosters.length + 1,
      image: "",
      cost: 4,
      weight: 1,
      draw_hand: true,
      instant_use: false,
      booster_type: "joker",
      config: { extra: 3, choose: 1 },
      card_rules: [],
      discovered: true,
      unlocked: true,
      objectKey: "new_pack",
    };
    updateBoosters([...data.boosters, newBooster]);
  }, [data.boosters, updateBoosters]);

  const handleDelete = useCallback(
    (id: string) => updateBoosters(data.boosters.filter((b) => b.id !== id)),
    [data.boosters, updateBoosters],
  );

  const boosterDialogTabs: DialogTab<BoosterData>[] = useMemo(
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
                processFile: processBoosterImage,
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
                placeholder: "Booster Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "p_pack",
                className: "col-span-2",
              },
              {
                id: "booster_type",
                type: "select",
                label: "Booster Type",
                options: [
                  { value: "joker", label: "Joker Pack" },
                  { value: "consumable", label: "Consumable Pack" },
                  { value: "playing_card", label: "Playing Card Pack" },
                  { value: "voucher", label: "Voucher Pack" },
                ],
              },
              {
                id: "cost",
                type: "number",
                label: "Cost ($)",
                min: 0,
              },
            ],
          },
          {
            id: "config",
            label: "Pack Settings",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "weight",
                type: "number",
                label: "Weight",
                min: 0,
                step: 0.05,
              },
              {
                id: "config.extra",
                type: "number",
                label: "Cards in Pack",
                min: 0,
              },
              {
                id: "config.choose",
                type: "number",
                label: "Cards to Choose",
                min: 0,
              },
            ],
          },
          {
            id: "props",
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
                id: "draw_hand",
                type: "switch",
                label: "Draw to Hand",
              },
              {
                id: "instant_use",
                type: "switch",
                label: "Instant Use",
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
            id: "advanced_fields",
            label: "Advanced Settings",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "kind",
                type: "text",
                label: "Kind",
                placeholder: "e.g. Ephemeral",
              },
              {
                id: "group_key",
                type: "text",
                label: "Group Key",
                placeholder: "k_booster_group_mystical",
              },
              {
                id: "hidden",
                type: "switch",
                label: "Hidden from Collection",
              },
            ],
          },
          {
            id: "colors",
            label: "Pack Colors",
            fields: [
              {
                id: "background_colour",
                type: "custom",
                label: "Background Color",
                render: (value, onChange) => {
                  const normalized =
                    typeof value === "string"
                      ? value.startsWith("#")
                        ? value
                        : `#${value}`
                      : "#666666";
                  return (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={normalized}
                        onChange={(e) =>
                          onChange(e.target.value.replace("#", ""))
                        }
                        className="w-12 h-10 rounded border border-border cursor-pointer"
                      />
                      <Input
                        value={normalized}
                        onChange={(e) =>
                          onChange(e.target.value.replace("#", ""))
                        }
                        placeholder="#666666"
                      />
                    </div>
                  );
                },
              },
              {
                id: "special_colour",
                type: "custom",
                label: "Special Color",
                render: (value, onChange) => {
                  const normalized =
                    typeof value === "string"
                      ? value.startsWith("#")
                        ? value
                        : `#${value}`
                      : "#666666";
                  return (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={normalized}
                        onChange={(e) =>
                          onChange(e.target.value.replace("#", ""))
                        }
                        className="w-12 h-10 rounded border border-border cursor-pointer"
                      />
                      <Input
                        value={normalized}
                        onChange={(e) =>
                          onChange(e.target.value.replace("#", ""))
                        }
                        placeholder="#666666"
                      />
                    </div>
                  );
                },
              },
            ],
          },
        ],
      },
    ],
    [processBoosterImage],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: BoosterData, term: string) =>
        item.name.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: BoosterData, b: BoosterData) =>
          a.name.localeCompare(b.name),
      },
      {
        label: "Cost",
        value: "cost",
        sortFn: (a: BoosterData, b: BoosterData) => a.cost - b.cost,
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: BoosterData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={formatBalatroText(item.description)}
        cost={item.cost}
        idValue={item.orderValue}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        image={
          item.image ? (
            <img
              src={item.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
            />
          ) : (
            <Package className="h-20 w-20 text-muted-foreground/20" />
          )
        }
        properties={[
          {
            id: "discovered",
            label: item.discovered ? "Discovered" : "Hidden",
            icon: item.discovered ? (
              <Eye className="h-4 w-4" weight="regular" />
            ) : (
              <EyeSlash className="h-4 w-4" weight="regular" />
            ),
            isActive: item.discovered ?? true,
            variant: "info",
            onClick: () =>
              handleUpdate(item.id, { discovered: !item.discovered }),
          },
          {
            id: "draw_hand",
            label: item.draw_hand ? "Draws to Hand" : "Opens Normally",
            icon: <Hand className="h-4 w-4" weight="regular" />,
            isActive: item.draw_hand === true,
            variant: "success",
            onClick: () =>
              handleUpdate(item.id, { draw_hand: !item.draw_hand }),
          },
          {
            id: "instant_use",
            label: item.instant_use ? "Instant Use" : "Adds to Hand",
            icon: <Play className="h-4 w-4" weight="regular" />,
            isActive: item.instant_use === true,
            variant: "success",
            onClick: () =>
              handleUpdate(item.id, { instant_use: !item.instant_use }),
          },
        ]}
        actions={[
          {
            id: "edit",
            label: "Edit",
            icon: <PencilSimple className="h-4 w-4" />,
            onClick: () => setEditingItem(item),
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash className="h-4 w-4" />,
            variant: "destructive",
            onClick: () => handleDelete(item.id),
          },
        ]}
      />
    ),
    [handleUpdate, handleDelete],
  );

  return (
    <>
      <GenericItemPage<BoosterData>
        title="Boosters"
        subtitle={modName}
        items={data.boosters}
        onAddNew={handleCreate}
        addNewLabel="Create Pack"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
      />
      <GenericItemDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Booster"}`}
        description="Modify booster properties."
        tabs={boosterDialogTabs}
        onSave={handleUpdate}
        renderPreview={(item) => (
          <BalatroCard type="booster" data={item || {}} size="lg" />
        )}
      />
    </>
  );
}
