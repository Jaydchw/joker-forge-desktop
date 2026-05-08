import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { getItemLocVarsFromUserVariables } from "@/lib/description-loc-vars";
import { RuleBuilder } from "@/components/rule-builder";
import { useProjectData } from "@/lib/storage";
import { useVanillaReforgedData } from "@/lib/vanilla-reforged";
import { VoucherData } from "@/lib/types";
import { fuzzyMatchAny } from "@/lib/search";
import { slugify } from "@/lib/balatro-utils";
import {
  Copy,
  Eye,
  EyeSlash,
  Lock,
  LockOpen,
  Prohibit,
  Sparkle,
} from "@phosphor-icons/react";

export default function VanillaReforgedVouchersPage() {
  const navigate = useNavigate();
  const { data: reforged, isLoading, error } = useVanillaReforgedData();
  const { data, updateVouchers } = useProjectData();
  const [ruleViewingItem, setRuleViewingItem] = useState<VoucherData | null>(
    null,
  );

  const items = reforged?.vouchers ?? [];
  const subtitle = reforged?.metadata?.display_name || "Vanilla Reforged";

  const handleCopy = useCallback(
    (item: VoucherData) => {
      const baseKey = item.objectKey || slugify(item.name);
      const duplicated: VoucherData = {
        ...item,
        id: crypto.randomUUID(),
        name: `${item.name} (Copy)`,
        objectKey: `${baseKey}_copy`,
        orderValue: data.vouchers.length + 1,
      };
      updateVouchers([...data.vouchers, duplicated]);
      navigate("/vouchers");
    },
    [data.vouchers, navigate, updateVouchers],
  );

  const searchProps = useMemo(
    () => ({
      placeholder: "Search vanilla vouchers...",
      searchFn: (item: VoucherData, term: string) =>
        fuzzyMatchAny([item.name, item.description], term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Order",
        value: "order",
        sortFn: (a: VoucherData, b: VoucherData) => a.orderValue - b.orderValue,
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: VoucherData, b: VoucherData) =>
          a.name.localeCompare(b.name),
      },
      {
        label: "Cost",
        value: "cost",
        sortFn: (a: VoucherData, b: VoucherData) =>
          (a.cost || 0) - (b.cost || 0),
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: VoucherData) => (
      <GenericItemCard
        key={item.id}
        reforged
        name={item.name}
        description={item.description}
        locVars={getItemLocVarsFromUserVariables(item)}
        cost={item.cost}
        idValue={item.orderValue}
        onUpdate={() => {}}
        image={
          item.image ? (
            <img
              src={item.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
              alt={item.name}
            />
          ) : (
            <div className="text-muted-foreground/30 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border p-4 rounded-lg">
              No Image
            </div>
          )
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
            onClick: () => {},
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
            onClick: () => {},
          },
          {
            id: "no_collection",
            label: item.no_collection ? "Hidden Collection" : "In Collection",
            icon: <Prohibit className="h-4 w-4" weight="regular" />,
            isActive: item.no_collection === true,
            variant: "default",
            onClick: () => {},
          },
        ]}
        actions={[
          {
            id: "rules",
            label: "View Rules",
            icon: <Sparkle className="h-4 w-4" />,
            badgeCount: item.rules?.length ?? 0,
            variant: "outline",
            onClick: () => setRuleViewingItem(item),
          },
          {
            id: "duplicate",
            label: "Copy to Project",
            icon: <Copy className="h-4 w-4" />,
            onClick: () => handleCopy(item),
          },
        ]}
      />
    ),
    [handleCopy],
  );

  if (error) {
    return (
      <div className="max-w-7xl mx-auto pb-20 text-destructive">{error}</div>
    );
  }

  return (
    <>
      <GenericItemPage<VoucherData>
        isLoading={isLoading}
        title="Vanilla Vouchers"
        subtitle={subtitle}
        items={items}
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        reforged
      />
      {ruleViewingItem && (
        <RuleBuilder
          isOpen={true}
          onClose={() => setRuleViewingItem(null)}
          existingRules={ruleViewingItem.rules ?? []}
          onSave={() => {}}
          item={ruleViewingItem}
          onUpdateItem={() => {}}
          itemType="voucher"
          reforged
        />
      )}
    </>
  );
}



