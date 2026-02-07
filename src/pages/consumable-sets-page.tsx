import { useCallback, useMemo, useState } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCardMini } from "@/components/pages/generic-item-card-mini";
import { DialogTab } from "@/components/pages/generic-item-dialog";
import { GenericItemDialogMini } from "@/components/pages/generic-item-dialog-mini";
import { BadgePreview } from "@/components/balatro/badge-preview";
import { Input } from "@/components/ui/input";
import { useModName, useProjectData } from "@/lib/storage";
import { slugify } from "@/lib/balatro-utils";
import { ConsumableSetData } from "@/lib/types";
import { Copy, Palette, PencilSimple, Trash } from "@phosphor-icons/react";

const DEFAULT_SET_COLOR = "666666";

const buildSetKey = (name: string): string => {
  const next = slugify(name);
  return next.startsWith("booster_") ? "custom_set" : next;
};

const normalizeHex = (value: string | undefined | null): string => {
  const raw = String(value || DEFAULT_SET_COLOR).replace("#", "");
  const clean = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
  return `#${clean.padEnd(6, "0")}`;
};

export default function ConsumableSetsPage() {
  const { data, updateConsumableSets } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<ConsumableSetData | null>(
    null,
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<ConsumableSetData>) => {
      updateConsumableSets(
        data.consumableSets.map((set) =>
          set.id === id
            ? {
                ...set,
                ...updates,
                key: (updates.key || set.key || "").replace("#", ""),
                primary_colour: (
                  updates.primary_colour ||
                  set.primary_colour ||
                  ""
                )
                  .replace("#", "")
                  .toUpperCase(),
                secondary_colour: (
                  updates.secondary_colour ||
                  set.secondary_colour ||
                  ""
                )
                  .replace("#", "")
                  .toUpperCase(),
              }
            : set,
        ),
      );
    },
    [data.consumableSets, updateConsumableSets],
  );

  const handleCreate = useCallback(() => {
    const newSet: ConsumableSetData = {
      id: crypto.randomUUID(),
      key: "new_set",
      name: "New Set",
      primary_colour: DEFAULT_SET_COLOR,
      secondary_colour: DEFAULT_SET_COLOR,
      shop_rate: 1,
      collection_rows: [4, 5],
      collection_name: "New Set Cards",
    };
    updateConsumableSets([...data.consumableSets, newSet]);
    setEditingItem(newSet);
  }, [data.consumableSets, updateConsumableSets]);

  const handleDelete = useCallback(
    (id: string) =>
      updateConsumableSets(data.consumableSets.filter((set) => set.id !== id)),
    [data.consumableSets, updateConsumableSets],
  );

  const handleDuplicate = useCallback(
    (set: ConsumableSetData) => {
      const name = `${set.name} Copy`;
      const duplicated: ConsumableSetData = {
        ...set,
        id: crypto.randomUUID(),
        name,
        key: buildSetKey(name),
      };
      updateConsumableSets([...data.consumableSets, duplicated]);
    },
    [data.consumableSets, updateConsumableSets],
  );

  const setDialogTabs: DialogTab<ConsumableSetData>[] = useMemo(
    () => [
      {
        id: "details",
        label: "Details",
        icon: Palette,
        groups: [
          {
            id: "basics",
            label: "Basics",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "name",
                type: "custom",
                label: "Name",
                render: (value, onChange, _item, setField) => (
                  <Input
                    value={String(value || "")}
                    placeholder="Mystical"
                    onChange={(event) => {
                      const nextName = event.target.value;
                      onChange(nextName);
                      setField("key", buildSetKey(nextName));
                    }}
                  />
                ),
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "key",
                type: "text",
                label: "Key",
                placeholder: "mystical",
                description: "Used as the set identifier",
              },
              {
                id: "collection_name",
                type: "text",
                label: "Collection Name",
                placeholder: "Mystical Cards",
              },
            ],
          },
          {
            id: "shop",
            label: "Shop",
            fields: [
              {
                id: "shop_rate",
                type: "slider",
                label: "Shop Rate",
                min: 0,
                step: 0.1,
              },
              {
                id: "collection_rows",
                type: "custom",
                label: "Collection Rows",
                render: (value, onChange) => {
                  const rows = Array.isArray(value) ? value : [4, 5];
                  const [row1, row2] = rows;
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={row1 ?? 4}
                        onChange={(event) =>
                          onChange([Number(event.target.value) || 1, row2 ?? 5])
                        }
                        className="h-9"
                      />
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={row2 ?? 5}
                        onChange={(event) =>
                          onChange([row1 ?? 4, Number(event.target.value) || 1])
                        }
                        className="h-9"
                      />
                    </div>
                  );
                },
              },
            ],
          },
          {
            id: "colors",
            label: "Colors",
            fields: [
              {
                id: "primary_colour",
                type: "custom",
                label: "Primary Color",
                render: (value, onChange) => {
                  const hex = normalizeHex(value);
                  const raw = hex.replace("#", "");
                  return (
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-md border border-border/60"
                        style={{ backgroundColor: hex }}
                      />
                      <Input
                        type="color"
                        value={hex}
                        onChange={(event) =>
                          onChange(event.target.value.replace("#", ""))
                        }
                        className="h-9 w-12 p-1 cursor-pointer"
                      />
                      <Input
                        value={raw}
                        onChange={(event) =>
                          onChange(event.target.value.replace("#", ""))
                        }
                        className="font-mono"
                      />
                    </div>
                  );
                },
              },
              {
                id: "secondary_colour",
                type: "custom",
                label: "Secondary Color",
                render: (value, onChange) => {
                  const hex = normalizeHex(value);
                  const raw = hex.replace("#", "");
                  return (
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-md border border-border/60"
                        style={{ backgroundColor: hex }}
                      />
                      <Input
                        type="color"
                        value={hex}
                        onChange={(event) =>
                          onChange(event.target.value.replace("#", ""))
                        }
                        className="h-9 w-12 p-1 cursor-pointer"
                      />
                      <Input
                        value={raw}
                        onChange={(event) =>
                          onChange(event.target.value.replace("#", ""))
                        }
                        className="font-mono"
                      />
                    </div>
                  );
                },
              },
              {
                id: "set_badge",
                type: "custom",
                render: (_value, _onChange, item) => {
                  const color = normalizeHex(item.primary_colour);
                  return (
                    <div className="flex items-center justify-center py-4">
                      <BadgePreview label={item.name || "Set"} color={color} />
                    </div>
                  );
                },
              },
            ],
          },
        ],
      },
    ],
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: ConsumableSetData, b: ConsumableSetData) =>
          a.name.localeCompare(b.name),
      },
      {
        label: "Key",
        value: "key",
        sortFn: (a: ConsumableSetData, b: ConsumableSetData) =>
          a.key.localeCompare(b.key),
      },
    ],
    [],
  );

  const searchProps = useMemo(
    () => ({
      placeholder: "Search sets by name or key...",
      searchFn: (item: ConsumableSetData, term: string) =>
        item.name.toLowerCase().includes(term) ||
        item.key.toLowerCase().includes(term),
    }),
    [],
  );

  const renderCard = useCallback(
    (item: ConsumableSetData) => (
      <GenericItemCardMini
        title={item.name}
        subtitle={item.key}
        accentColor={normalizeHex(item.primary_colour)}
        badgePreview={{
          label: item.name,
          color: normalizeHex(item.primary_colour),
        }}
        onTitleSave={(value) =>
          handleUpdate(item.id, {
            name: value,
            key: buildSetKey(value),
            collection_name: `${value} Cards`,
          })
        }
        fields={[
          {
            id: "shop_rate",
            label: "Shop Rate",
            value: item.shop_rate,
            editable: true,
            type: "number",
            step: 0.1,
            onSave: (value) =>
              handleUpdate(item.id, { shop_rate: Number(value) }),
            formatter: (value) => Number(value || 0).toFixed(1),
          },
          {
            id: "rows",
            label: "Rows",
            value: `${item.collection_rows?.[0] ?? 4} / ${
              item.collection_rows?.[1] ?? 5
            }`,
          },
          {
            id: "collection",
            label: "Collection",
            value: item.collection_name,
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
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy className="h-4 w-4" />,
            onClick: () => handleDuplicate(item),
            variant: "outline",
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash className="h-4 w-4" />,
            onClick: () => handleDelete(item.id),
            variant: "destructive",
          },
        ]}
      />
    ),
    [handleDelete, handleDuplicate, handleUpdate],
  );

  return (
    <>
      <GenericItemPage<ConsumableSetData>
        title="Consumable Sets"
        subtitle={modName}
        items={data.consumableSets}
        onAddNew={handleCreate}
        addNewLabel="Create Set"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
      />
      <GenericItemDialogMini
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Set"}`}
        description="Edit consumable set details."
        tabs={setDialogTabs}
        onSave={handleUpdate}
      />
    </>
  );
}
