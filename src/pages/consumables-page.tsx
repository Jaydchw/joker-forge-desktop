import { useState } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { ConsumableData } from "@/lib/types";
import {
  Flask,
  PencilSimple,
  Sparkle,
  Trash,
  Image as ImageIcon,
  TextT,
} from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";
import { Badge } from "@/components/ui/badge";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { BalatroCard } from "@/components/balatro/balatro-card";

export default function ConsumablesPage() {
  const { data, updateConsumables } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<ConsumableData | null>(null);

  const processConsumableImage = (file: File): Promise<string> => {
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
  };

  const handleUpdate = (id: string, updates: Partial<ConsumableData>) => {
    updateConsumables(
      data.consumables.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    );
  };

  const handleCreate = () => {
    const newConsumable: ConsumableData = {
      id: crypto.randomUUID(),
      objectType: "consumable",
      name: "New Tarot",
      description: "Effect",
      image: "",
      orderValue: data.consumables.length + 1,
      set: "Tarot",
      cost: 3,
      unlocked: true,
      discovered: true,
      rules: [],
      objectKey: "new_tarot",
    };
    updateConsumables([...data.consumables, newConsumable]);
  };

  const handleDelete = (id: string) =>
    updateConsumables(data.consumables.filter((c) => c.id !== id));

  const getCurrentSetName = (setKey: string): string => {
    return setKey;
  };

  const getCurrentSetColor = (setKey: string): string => {
    return setKey === "Tarot"
      ? "#b26cbb"
      : setKey === "Planet"
        ? "#13afce"
        : setKey === "Spectral"
          ? "#4584fa"
          : "#666666";
  };

  const consumableDialogTabs: DialogTab<ConsumableData>[] = [
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
              processFile: processConsumableImage,
            },
            {
              id: "overlayImage",
              type: "image",
              label: "Overlay Sprite",
              description: "Optional overlay layer",
              processFile: processConsumableImage,
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
              placeholder: "Consumable Name",
              className: "col-span-2",
              validate: (val) => (!val ? "Name is required" : null),
            },
            {
              id: "objectKey",
              type: "text",
              label: "Object Key",
              placeholder: "c_tarot_name",
              description: "Internal ID",
              className: "col-span-2",
            },
            {
              id: "set",
              type: "select",
              label: "Set",
              options: [
                { label: "Tarot", value: "Tarot" },
                { label: "Planet", value: "Planet" },
                { label: "Spectral", value: "Spectral" },
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
          id: "props",
          label: "Properties",
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
              label: "Effect Description",
              placeholder: "Description...",
              validate: (val) => (!val ? "Description is required" : null),
            },
          ],
        },
      ],
    },
  ];

  return (
    <>
      <GenericItemPage<ConsumableData>
        title="Consumables"
        subtitle={modName}
        items={data.consumables}
        onAddNew={handleCreate}
        addNewLabel="Create Consumable"
        searchProps={{
          searchFn: (item, term) => item.name.toLowerCase().includes(term),
        }}
        sortOptions={[
          {
            label: "Set",
            value: "set",
            sortFn: (a, b) => a.set.localeCompare(b.set),
          },
          {
            label: "Name",
            value: "name",
            sortFn: (a, b) => a.name.localeCompare(b.name),
          },
        ]}
        filterOptions={[
          {
            id: "set",
            label: "Type",
            options: [
              { label: "Tarot", value: "Tarot" },
              { label: "Planet", value: "Planet" },
              { label: "Spectral", value: "Spectral" },
            ],
            predicate: (item, val) => item.set === val,
          },
        ]}
        renderCard={(item) => (
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
                <Flask className="h-20 w-20 text-muted-foreground/20" />
              )
            }
            badges={
              <Badge
                variant="secondary"
                className="font-bold uppercase tracking-wider"
              >
                {item.set}
              </Badge>
            }
            actions={[
              {
                id: "edit",
                label: "Edit",
                icon: <PencilSimple className="h-4 w-4" />,
                onClick: () => setEditingItem(item),
              },
              {
                id: "rules",
                label: "Rules",
                icon: <Sparkle className="h-4 w-4" />,
                onClick: () => {},
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
        )}
      />
      <GenericItemDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Consumable"}`}
        description="Modify consumable properties."
        tabs={consumableDialogTabs}
        onSave={handleUpdate}
        renderPreview={(item) => {
          if (!item) return null;
          return (
            <BalatroCard
              type="consumable"
              data={item}
              setName={getCurrentSetName(item.set)}
              setColor={getCurrentSetColor(item.set)}
            />
          );
        }}
      />
    </>
  );
}
