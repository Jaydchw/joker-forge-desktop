import { useCallback, useMemo } from "react";
import {
  GenericItemDialog,
  type DialogTab,
} from "@/components/pages/generic-item-dialog";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { Button } from "@/components/ui/button";
import {
  COMPARISON_OPERATORS,
  getRarityBadgeColor,
  getRarityDisplayName,
  getRarityDropdownOptions,
} from "@/lib/balatro/balatro-utils";
import { processBalatroCardImage } from "@/lib/media/image-processing-utils";
import type { JokerData } from "@/lib/core/types";
import { jokerUnlockOptions, unlockTriggerOptions } from "@/lib/items/unlock-utils";
import {
  Gear,
  Image as ImageIcon,
  ListDashes,
  LockKey,
  Minus,
  Plus,
  Storefront,
  TextT,
} from "@phosphor-icons/react";

interface EditJokerDialogProps {
  editingItem: JokerData | null;
  setEditingItem: (item: JokerData | null) => void;
  onSave: (id: string, updates: Partial<JokerData>) => void;
  modPrefix?: string;
}

export function EditJokerDialog({
  editingItem,
  setEditingItem,
  onSave,
  modPrefix = "",
}: EditJokerDialogProps) {
  const processJokerImage = processBalatroCardImage;
  const automaticPool = `${modPrefix.trim()}${modPrefix.trim() ? "_" : ""}jokers`;
  const rarityOptions = useMemo(() => getRarityDropdownOptions(), []);
  const unlockOperatorOptions = useMemo(
    () =>
      COMPARISON_OPERATORS.map((op) => ({
        value: op.value,
        label: op.label,
      })),
    [],
  );

  const jokerDialogTabs: DialogTab<JokerData>[] = useMemo(
    () => [
      {
        id: "visual",
        label: "Visual & Data",
        icon: ImageIcon,
        groups: [
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
                options: rarityOptions,
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
            id: "assets",
            label: "Assets",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "image",
                type: "image",
                label: "Main Sprite",
                processFile: processJokerImage,
              },
              {
                id: "overlayImage",
                type: "image",
                label: "Overlay Sprite",
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
              {
                id: "force_foil",
                type: "switch",
                label: "Force Foil",
                description: "Always spawns as Foil",
              },
              {
                id: "force_holographic",
                type: "switch",
                label: "Force Holographic",
                description: "Always spawns as Holographic",
              },
              {
                id: "force_polychrome",
                type: "switch",
                label: "Force Polychrome",
                description: "Always spawns as Polychrome",
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
                  ...unlockTriggerOptions,
                ],
                hidden: (item) => item.unlocked,
              },
              {
                id: "unlockOperator",
                type: "select",
                label: "Operator",
                options: unlockOperatorOptions,
                hidden: (item) => item.unlocked || !item.unlockTrigger,
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
                  const addPropertyHidden =
                    (currentTrigger === "career_stat" && props.length > 0) ||
                    !currentTrigger ||
                    currentTrigger === "chip_score";

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
                                onChange(
                                  props.filter(
                                    (_: any, i: number) => i !== idx,
                                  ),
                                )
                              }
                            >
                              <Minus className="h-4 w-4" weight="bold" />
                            </Button>
                          </div>
                        );
                      })}
                      {!addPropertyHidden && (
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
                      )}
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
                hidden: (item) => Number(item.rarity) !== 4,
              },
              {
                id: "cardAppearance.wra",
                type: "switch",
                label: "The Wraith",
                description: "From The Wraith Spectral",
                hidden: (item) => Number(item.rarity) !== 3,
              },
              {
                id: "cardAppearance.rif",
                type: "switch",
                label: "Riff Raff",
                description: "From Riff Raff",
                hidden: (item) => Number(item.rarity) !== 1,
              },
              {
                id: "cardAppearance.rta",
                type: "switch",
                label: "Rare Tag",
                description: "From Rare Tag",
                hidden: (item) => Number(item.rarity) !== 3,
              },
              {
                id: "cardAppearance.uta",
                type: "switch",
                label: "Uncommon Tag",
                description: "From Uncommon Tag",
                hidden: (item) => Number(item.rarity) !== 2,
              },
            ],
          },
          {
            id: "flags",
            label: "Flags",
            fields: [
              {
                id: "appearFlags",
                type: "list",
                label: "Flags Required",
                placeholder: "custom_flag1, not custom_flag2",
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
                type: "list",
                label: "Pools",
                placeholder: "pool_one, pool_two",
                lockedValues: modPrefix.trim() ? [automaticPool] : [],
                description:
                  "The locked pool is included automatically. You can add optional extra pools; the mod prefix is added during export.",
              },
            ],
          },
          {
            id: "queues_config",
            label: "Info Queues",
            fields: [
              {
                id: "info_queues",
                type: "list",
                placeholder: "j_joker, c_tarot, v_voucher",
              },
            ],
          },
          {
            id: "dependencies",
            label: "Mod Dependencies",
            fields: [
              {
                id: "card_dependencies",
                type: "list",
                placeholder: "Cryptid, Bunco, MoreFluff",
              },
            ],
          },
        ],
      },
    ],
    [automaticPool, processJokerImage, rarityOptions, unlockOperatorOptions],
  );

  const renderPreview = useCallback((item: JokerData | null) => {
    if (!item) return null;
    return (
      <BalatroCard
        type="joker"
        data={item}
        rarityName={getRarityDisplayName(item.rarity)}
        rarityColor={getRarityBadgeColor(item.rarity)}
      />
    );
  }, []);

  return (
    <GenericItemDialog
      open={!!editingItem}
      onOpenChange={(open) => !open && setEditingItem(null)}
      item={editingItem}
      title={`Edit ${editingItem?.name || "Joker"}`}
      description="Modify the properties of your custom Joker."
      tabs={jokerDialogTabs}
      onSave={onSave}
      renderPreview={renderPreview}
      showPlaceholderPicker
      placeholderCategory="joker"
    />
  );
}
