import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { VoucherData } from "@/lib/types";
import { Ticket, PencilSimple, Sparkle, Trash } from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";

export default function VouchersPage() {
  const { data, updateVouchers } = useProjectData();
  const modName = useModName();

  const handleUpdate = (id: string, updates: Partial<VoucherData>) => {
    updateVouchers(
      data.vouchers.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    );
  };

  const handleCreate = () => {
    const newVoucher: VoucherData = {
      id: crypto.randomUUID(),
      objectType: "voucher",
      name: "New Voucher",
      description: "Effect",
      image: "",
      objectKey: "new_voucher",
      unlocked: true,
      discovered: true,
      cost: 10,
      rules: [],
      orderValue: data.vouchers.length + 1,
    };
    updateVouchers([...data.vouchers, newVoucher]);
  };

  const handleDelete = (id: string) =>
    updateVouchers(data.vouchers.filter((v) => v.id !== id));

  return (
    <GenericItemPage<VoucherData>
      title="Vouchers"
      subtitle={modName}
      items={data.vouchers}
      onAddNew={handleCreate}
      addNewLabel="Create Voucher"
      searchProps={{
        searchFn: (item, term) => item.name.toLowerCase().includes(term),
      }}
      sortOptions={[
        {
          label: "Name",
          value: "name",
          sortFn: (a, b) => a.name.localeCompare(b.name),
        },
        { label: "Cost", value: "cost", sortFn: (a, b) => a.cost - b.cost },
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
              <Ticket className="h-20 w-20 text-muted-foreground/20" />
            )
          }
          actions={[
            {
              id: "edit",
              label: "Edit",
              icon: <PencilSimple className="h-4 w-4" />,
              onClick: () => {},
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
  );
}
