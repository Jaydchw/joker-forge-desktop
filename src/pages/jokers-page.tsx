import { useState, useCallback, useMemo } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { useProjectData, useModName } from "@/lib/storage";
import { JokerData } from "@/lib/types";
import { formatBalatroText } from "@/lib/balatro-text-formatter";
import {
  Star,
  Clock,
  Lightning,
  CurrencyDollar,
  Prohibit,
  Lock,
  LockOpen,
  Eye,
  EyeSlash,
  PencilSimple,
  Sparkle,
  VideoCamera,
  DownloadSimple,
  Copy,
  Trash,
  Image as ImageIcon,
  TextT,
  Gear,
  LockKey,
  Storefront,
  ListDashes,
  Plus,
  Minus,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { jokerUnlockOptions } from "@/lib/unlock-utils";

export default function JokersPage() {
  const { data, updateJokers } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<JokerData | null>(null);

  const processJokerImage = useCallback((file: File): Promise<string> => {
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
    (id: string, updates: Partial<JokerData>) => {
      updateJokers(
        data.jokers.map((j) => (j.id === id ? { ...j, ...updates } : j)),
      );
    },
    [data.jokers, updateJokers],
  );

  const handleCreate = useCallback(async () => {
    const newJoker: JokerData = {
      id: crypto.randomUUID(),
      objectType: "joker",
      name: "New Joker",
      description: "Effect description",
      rarity: 1,
      cost: 4,
      orderValue: data.jokers.length + 1,
      blueprint_compat: true,
      eternal_compat: true,
      unlocked: true,
      discovered: true,
      appears_in_shop: true,
      image: "",
      objectKey: "new_joker",
      cardAppearance: {},
      rules: [],
      pools: [],
    };
    updateJokers([...data.jokers, newJoker]);
  }, [data.jokers, updateJokers]);

  const handleDelete = useCallback(
    (id: string) => {
      updateJokers(data.jokers.filter((j) => j.id !== id));
    },
    [data.jokers, updateJokers],
  );

  const getRarityLabel = (rarity: number | string) => {
    const r = typeof rarity === "string" ? parseInt(rarity) : rarity;
    switch (r) {
      case 1:
        return "Common";
      case 2:
        return "Uncommon";
      case 3:
        return "Rare";
      case 4:
        return "Legendary";
      default:
        return "Custom";
    }
  };

  const getRarityColorHex = (rarity: number | string) => {
    switch (Number(rarity)) {
      case 1:
        return "#009dff";
      case 2:
        return "#4BC292";
      case 3:
        return "#fe5f55";
      case 4:
        return "#b26cbb";
      default:
        return "#009dff";
    }
  };

  const jokerDialogTabs: DialogTab<JokerData>[] = useMemo(
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
                processFile: processJokerImage,
              },
              {
                id: "overlayImage",
                type: "image",
                label: "Overlay Sprite",
                description: "Optional overlay layer",
                processFile: processJokerImage,
              },
              {
                id: "scale_w",
                type: "number",
                label: "Scale Width (%)",
                placeholder: "100",
              },
              {
                id: "scale_h",
                type: "number",
                label: "Scale Height (%)",
                placeholder: "100",
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
                placeholder: "Joker Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "j_my_joker",
                description: "Internal ID for the game code",
                className: "col-span-2",
              },
              {
                id: "rarity",
                type: "select",
                label: "Rarity",
                options: [
                  { label: "Common", value: 1 },
                  { label: "Uncommon", value: 2 },
                  { label: "Rare", value: 3 },
                  { label: "Legendary", value: 4 },
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
                label: "Joker Effect Description",
                placeholder:
                  "Use {C:attention}colors{} and {X:mult,C:white}XMult{} formatting...",
                validate: (val) => (!val ? "Description is required" : null),
              },
            ],
          },
        ],
      },
      {
        id: "properties",
        label: "Properties",
        icon: Gear,
        groups: [
          {
            id: "compat",
            label: "Compatibility",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "blueprint_compat",
                type: "switch",
                label: "Blueprint Compatible",
                description: "Can be copied by Blueprint/Brainstorm",
              },
              {
                id: "eternal_compat",
                type: "switch",
                label: "Eternal Compatible",
                description: "Can be Eternal",
              },
              {
                id: "perishable_compat",
                type: "switch",
                label: "Perishable Compatible",
                description: "Can be Perishable",
              },
            ],
          },
          {
            id: "forced",
            label: "Forced Spawning",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "force_eternal",
                type: "switch",
                label: "Force Eternal",
                description: "Always spawns as Eternal",
              },
              {
                id: "force_perishable",
                type: "switch",
                label: "Force Perishable",
                description: "Always spawns as Perishable",
              },
              {
                id: "force_rental",
                type: "switch",
                label: "Force Rental",
                description: "Always spawns as Rental",
              },
              {
                id: "force_negative",
                type: "switch",
                label: "Force Negative",
                description: "Always spawns as Negative",
              },
            ],
          },
          {
            id: "other",
            label: "Other",
            fields: [
              {
                id: "ignoreSlotLimit",
                type: "switch",
                label: "Ignore Slot Limit",
                description: "Can be added even if slots are full",
              },
            ],
          },
        ],
      },
      {
        id: "unlock",
        label: "Unlock",
        icon: LockKey,
        groups: [
          {
            id: "default_state",
            label: "Default State",
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
            ],
          },
          {
            id: "requirements",
            label: "Unlock Requirements",
            fields: [
              {
                id: "unlockTrigger",
                type: "select",
                label: "Trigger Condition",
                options: [
                  { label: "None", value: "" },
                  { label: "Hand Played", value: "round_played" },
                  { label: "Discard", value: "discard" },
                  { label: "Money", value: "c_dollars" },
                  { label: "Ante Reached", value: "ante_reached" },
                ],
                hidden: (item) => item.unlocked,
              },
              {
                id: "unlockCount",
                type: "number",
                label: "Count/Amount",
                hidden: (item) => item.unlocked || !item.unlockTrigger,
              },
              {
                id: "unlockDescription",
                type: "textarea",
                label: "Unlock Text",
                placeholder: "Describe how to unlock this joker...",
                hidden: (item) => item.unlocked,
              },
              {
                id: "unlockProperties",
                type: "custom",
                label: "Properties",
                hidden: (item) => item.unlocked || !item.unlockTrigger,
                render: (value, onChange, item) => {
                  const props = Array.isArray(value) ? value : [];
                  const currentTrigger = item.unlockTrigger || "";
                  const availableOptions =
                    jokerUnlockOptions[currentTrigger]?.categories || [];

                  return (
                    <div className="space-y-3 bg-muted/20 p-4 rounded-lg border border-border/50">
                      {props.map((prop: any, idx: number) => {
                        const categoryOptions = availableOptions;
                        const selectedCategory = categoryOptions.find(
                          (c: any) => c.value === prop.category,
                        );
                        const propertyOptions = selectedCategory?.options || [];

                        return (
                          <div key={idx} className="flex gap-2 items-center">
                            <div className="flex-1">
                              <select
                                value={prop.category}
                                onChange={(e) => {
                                  const newProps = [...props];
                                  newProps[idx] = {
                                    ...newProps[idx],
                                    category: e.target.value,
                                    property: "",
                                  };
                                  onChange(newProps);
                                }}
                                className="w-full h-9 bg-background border rounded px-2 text-sm"
                              >
                                <option value="">Select Category</option>
                                {categoryOptions.map((opt: any) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1">
                              <select
                                value={prop.property}
                                onChange={(e) => {
                                  const newProps = [...props];
                                  newProps[idx] = {
                                    ...newProps[idx],
                                    property: e.target.value,
                                  };
                                  onChange(newProps);
                                }}
                                className="w-full h-9 bg-background border rounded px-2 text-sm"
                              >
                                <option value="">Select Property</option>
                                {propertyOptions.map((opt: any) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() =>
                                onChange(props.filter((_, i) => i !== idx))
                              }
                            >
                              <Minus className="h-4 w-4" weight="bold" />
                            </Button>
                          </div>
                        );
                      })}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onChange([...props, { category: "", property: "" }])
                        }
                        className="w-full border-dashed"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add Property
                      </Button>
                    </div>
                  );
                },
              },
            ],
          },
        ],
      },
      {
        id: "appearance",
        label: "Appearance",
        icon: Storefront,
        groups: [
          {
            id: "spawning",
            label: "Spawn Conditions",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "appears_in_shop",
                type: "switch",
                label: "Shop",
                description: "Can appear in the shop",
              },
              {
                id: "cardAppearance.jud",
                type: "switch",
                label: "Judgement",
                description: "From Judgement Tarot",
              },
              {
                id: "cardAppearance.buf",
                type: "switch",
                label: "Buffoon Pack",
                description: "From Buffoon Pack",
              },
              {
                id: "cardAppearance.sou",
                type: "switch",
                label: "The Soul",
                description: "From The Soul Spectral",
              },
              {
                id: "cardAppearance.wra",
                type: "switch",
                label: "The Wraith",
                description: "From The Wraith Spectral",
              },
            ],
          },
        ],
      },
      {
        id: "pools",
        label: "Pools & Queues",
        icon: ListDashes,
        groups: [
          {
            id: "pools_config",
            label: "Custom Pools",
            fields: [
              {
                id: "pools",
                type: "custom",
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
                      placeholder="Pool names separated by comma..."
                    />
                    <p className="text-xs text-muted-foreground">
                      This joker will be available in these custom pools.
                    </p>
                  </div>
                ),
              },
            ],
          },
          {
            id: "queues_config",
            label: "Info Queues",
            fields: [
              {
                id: "info_queues",
                type: "custom",
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
                      placeholder="j_joker, c_tarot..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Related items to display in the tooltip.
                    </p>
                  </div>
                ),
              },
            ],
          },
        ],
      },
    ],
    [processJokerImage],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: JokerData, term: string) =>
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "ID Order",
        value: "orderValue",
        sortFn: (a: JokerData, b: JokerData) => a.orderValue - b.orderValue,
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: JokerData, b: JokerData) => a.name.localeCompare(b.name),
      },
      {
        label: "Cost",
        value: "cost",
        sortFn: (a: JokerData, b: JokerData) => (a.cost || 0) - (b.cost || 0),
      },
      {
        label: "Rarity",
        value: "rarity",
        sortFn: (a: JokerData, b: JokerData) =>
          Number(a.rarity) - Number(b.rarity),
      },
    ],
    [],
  );

  const filterOptions = useMemo(
    () => [
      {
        id: "rarity",
        label: "Rarity",
        options: [
          { label: "Common", value: 1 },
          { label: "Uncommon", value: 2 },
          { label: "Rare", value: 3 },
          { label: "Legendary", value: 4 },
        ],
        predicate: (item: JokerData, val: any) => item.rarity === val,
      },
    ],
    [],
  );

  // Use callback for renderCard so the function reference stays stable
  const renderCard = useCallback(
    (joker: JokerData) => (
      <GenericItemCard
        key={joker.id}
        name={joker.name}
        description={formatBalatroText(joker.description)}
        cost={joker.cost}
        idValue={joker.orderValue}
        rarity={joker.rarity}
        onUpdate={(updates) => handleUpdate(joker.id, updates)}
        onDuplicate={() => {
          const duplicatedJoker: JokerData = {
            ...joker,
            id: crypto.randomUUID(),
            name: `${joker.name} (Copy)`,
            objectKey: `${joker.objectKey}_copy`,
            orderValue: data.jokers.length + 1,
          };
          updateJokers([...data.jokers, duplicatedJoker]);
        }}
        image={
          <div className="w-full h-full relative group cursor-pointer rounded-lg overflow-hidden flex items-center justify-center">
            {joker.image ? (
              <img
                src={joker.image}
                className="w-full h-full object-contain [image-rendering:pixelated]"
                alt={joker.name}
              />
            ) : (
              <div className="text-muted-foreground/30 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border p-4 rounded-lg">
                No Image
              </div>
            )}
          </div>
        }
        properties={[
          {
            id: "eternal",
            label: joker.eternal_compat ? "Eternal Compatible" : "No Eternal",
            icon: (
              <Star
                className="h-4 w-4"
                weight={joker.eternal_compat ? "fill" : "regular"}
              />
            ),
            isActive: joker.eternal_compat,
            variant: "purple",
            onClick: () =>
              handleUpdate(joker.id, {
                eternal_compat: !joker.eternal_compat,
              }),
          },
          {
            id: "perishable",
            label: joker.perishable_compat
              ? "Perishable Compatible"
              : "No Perishable",
            icon: <Clock className="h-4 w-4" weight="regular" />,
            isActive: !!joker.perishable_compat,
            variant: "warning",
            onClick: () =>
              handleUpdate(joker.id, {
                perishable_compat: !joker.perishable_compat,
              }),
          },
          {
            id: "blueprint",
            label: joker.blueprint_compat
              ? "Blueprint Compatible"
              : "No Blueprint",
            icon: (
              <Lightning
                className="h-4 w-4"
                weight={joker.blueprint_compat ? "fill" : "regular"}
              />
            ),
            isActive: joker.blueprint_compat,
            variant: "info",
            onClick: () =>
              handleUpdate(joker.id, {
                blueprint_compat: !joker.blueprint_compat,
              }),
          },
          {
            id: "shop",
            label: joker.appears_in_shop
              ? "Appears in Shop"
              : "Hidden from Shop",
            icon: joker.appears_in_shop ? (
              <CurrencyDollar className="h-4 w-4" weight="regular" />
            ) : (
              <Prohibit className="h-4 w-4" weight="regular" />
            ),
            isActive: joker.appears_in_shop,
            variant: "success",
            onClick: () =>
              handleUpdate(joker.id, {
                appears_in_shop: !joker.appears_in_shop,
              }),
          },
          {
            id: "unlocked",
            label: joker.unlocked ? "Unlocked" : "Locked",
            icon: joker.unlocked ? (
              <LockOpen className="h-4 w-4" weight="regular" />
            ) : (
              <Lock className="h-4 w-4" weight="regular" />
            ),
            isActive: joker.unlocked,
            variant: "warning",
            onClick: () =>
              handleUpdate(joker.id, { unlocked: !joker.unlocked }),
          },
          {
            id: "discovered",
            label: joker.discovered ? "Discovered" : "Undiscovered",
            icon: joker.discovered ? (
              <Eye className="h-4 w-4" weight="regular" />
            ) : (
              <EyeSlash className="h-4 w-4" weight="regular" />
            ),
            isActive: joker.discovered,
            variant: "default",
            onClick: () =>
              handleUpdate(joker.id, { discovered: !joker.discovered }),
          },
        ]}
        actions={[
          {
            id: "edit",
            label: "Edit Info",
            icon: <PencilSimple className="h-5 w-5" weight="bold" />,
            onClick: () => setEditingItem(joker),
            variant: "secondary",
          },
          {
            id: "rules",
            label: "Edit Rules",
            icon: <Sparkle className="h-5 w-5" weight="bold" />,
            onClick: () => {},
            variant: "outline",
          },
          {
            id: "showcase",
            label: "Showcase",
            icon: <VideoCamera className="h-5 w-5" weight="regular" />,
            onClick: () => {},
            variant: "ghost",
          },
          {
            id: "export",
            label: "Export Code",
            icon: <DownloadSimple className="h-5 w-5" weight="regular" />,
            onClick: () => {},
            variant: "ghost",
          },
          {
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy className="h-5 w-5" weight="regular" />,
            onClick: () => {},
            variant: "ghost",
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash className="h-5 w-5" weight="bold" />,
            variant: "destructive",
            onClick: () => handleDelete(joker.id),
          },
        ]}
      />
    ),
    [handleUpdate, handleDelete, data.jokers, updateJokers],
  ); // Dependencies include data.jokers for duplication

  return (
    <>
      <GenericItemPage<JokerData>
        title="Jokers"
        subtitle={modName}
        items={data.jokers}
        onAddNew={handleCreate}
        addNewLabel="Create Joker"
        searchProps={searchProps}
        sortOptions={sortOptions}
        filterOptions={filterOptions}
        renderCard={renderCard}
      />

      <GenericItemDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Joker"}`}
        description="Modify the properties of your custom Joker."
        tabs={jokerDialogTabs}
        onSave={handleUpdate}
        renderPreview={(item) => {
          if (!item) return null;
          return (
            <BalatroCard
              type="joker"
              data={item}
              rarityName={item?.rarity ? getRarityLabel(item.rarity) : "Common"}
              rarityColor={
                item?.rarity ? getRarityColorHex(item.rarity) : "#009dff"
              }
            />
          );
        }}
      />
    </>
  );
}
