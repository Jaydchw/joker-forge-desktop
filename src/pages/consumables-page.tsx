import { useState, useCallback, useMemo } from "react";
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
  LockOpen,
  Lock,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";
import { Badge } from "@/components/ui/badge";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { BalatroCard } from "@/components/balatro/balatro-card";
import {
  getConsumableSetByKey,
  getConsumableSetDropdownOptions,
  getCustomConsumableSetData,
} from "@/lib/balatro-utils";

export default function ConsumablesPage() {
  const { data, updateConsumables } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<ConsumableData | null>(null);

  const processConsumableImage = useCallback((file: File): Promise<string> => {
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
    (id: string, updates: Partial<ConsumableData>) => {
      updateConsumables(
        data.consumables.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      );
    },
    [data.consumables, updateConsumables],
  );

  const handleCreate = useCallback(() => {
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
  }, [data.consumables, updateConsumables]);

  const handleDelete = useCallback(
    (id: string) =>
      updateConsumables(data.consumables.filter((c) => c.id !== id)),
    [data.consumables, updateConsumables],
  );

  const getCurrentSetName = useCallback((setKey: string): string => {
    const set = getConsumableSetByKey(setKey);
    return set?.label || setKey;
  }, []);

  const getCurrentSetColor = useCallback((setKey: string): string => {
    const custom = getCustomConsumableSetData(setKey);
    if (custom?.primary_colour) {
      return custom.primary_colour.startsWith("#")
        ? custom.primary_colour
        : `#${custom.primary_colour}`;
    }
    return setKey === "Tarot"
      ? "#b26cbb"
      : setKey === "Planet"
        ? "#13afce"
        : setKey === "Spectral"
          ? "#4584fa"
          : "#666666";
  }, []);

  const consumableDialogTabs: DialogTab<ConsumableData>[] = useMemo(
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
                options: getConsumableSetDropdownOptions(),
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
              {
                id: "hidden",
                type: "switch",
                label: "Hidden",
              },
              {
                id: "can_repeat_soul",
                type: "switch",
                label: "Can Repeat Soul",
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
    ],
    [processConsumableImage],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: ConsumableData, term: string) =>
        item.name.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Set",
        value: "set",
        sortFn: (a: ConsumableData, b: ConsumableData) =>
          a.set.localeCompare(b.set),
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: ConsumableData, b: ConsumableData) =>
          a.name.localeCompare(b.name),
      },
    ],
    [],
  );

  const filterOptions = useMemo(
    () => [
      {
        id: "set",
        label: "Type",
        options: getConsumableSetDropdownOptions(),
        predicate: (item: ConsumableData, val: string) => item.set === val,
      },
    ],
    [],
  );

  const renderPreview = useCallback(
    (item: ConsumableData | null) => {
      if (!item) return null;
      return (
        <BalatroCard
          type="consumable"
          data={item}
          setName={getCurrentSetName(item.set)}
          setColor={getCurrentSetColor(item.set)}
        />
      );
    },
    [getCurrentSetName, getCurrentSetColor],
  );

  const renderCard = useCallback(
    (item: ConsumableData) => (
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
        properties={[
          {
            id: "unlocked",
            label: item.unlocked ? "Unlocked" : "Locked",
            icon: item.unlocked ? (
              <LockOpen className="h-4 w-4" weight="regular" />
            ) : (
              <Lock className="h-4 w-4" weight="regular" />
            ),
            isActive: item.unlocked ?? true,
            variant: "warning",
            onClick: () => handleUpdate(item.id, { unlocked: !item.unlocked }),
          },
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
        ]}
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
    ),
    [handleUpdate, handleDelete],
  );

  return (
    <>
      <GenericItemPage<ConsumableData>
        title="Consumables"
        subtitle={modName}
        items={data.consumables}
        onAddNew={handleCreate}
        addNewLabel="Create Consumable"
        searchProps={searchProps}
        sortOptions={sortOptions}
        filterOptions={filterOptions}
        renderCard={renderCard}
      />
      <GenericItemDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Consumable"}`}
        description="Modify consumable properties."
        tabs={consumableDialogTabs}
        onSave={handleUpdate}
        renderPreview={renderPreview}
      />
    </>
  );
}
