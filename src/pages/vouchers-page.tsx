import { useState } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { VoucherData } from "@/lib/types";
import {
  Ticket,
  PencilSimple,
  Sparkle,
  Trash,
  Image as ImageIcon,
  TextT,
  LockKey,
} from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { BalatroCard } from "@/components/balatro/balatro-card";

export default function VouchersPage() {
  const { data, updateVouchers } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<VoucherData | null>(null);

  const processVoucherImage = (file: File): Promise<string> => {
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

  const voucherDialogTabs: DialogTab<VoucherData>[] = [
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
              processFile: processVoucherImage,
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
              placeholder: "Voucher Name",
              className: "col-span-2",
              validate: (val) => (!val ? "Name is required" : null),
            },
            {
              id: "objectKey",
              type: "text",
              label: "Object Key",
              placeholder: "v_name",
              className: "col-span-2",
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
              id: "requires_activetor",
              type: "switch",
              label: "Requires Voucher",
            },
          ],
        },
        {
          id: "req_voucher",
          label: "Requirement",
          fields: [
            {
              id: "requires",
              type: "text",
              label: "Required Voucher ID",
              placeholder: "v_overstock_norm",
              hidden: (item) => !item.requires_activetor,
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
      id: "settings",
      label: "Advanced",
      icon: LockKey,
      groups: [
        {
          id: "shader",
          label: "Custom Shader",
          fields: [
            {
              id: "draw_shader_sprite",
              type: "select",
              label: "Shader",
              options: [
                { value: "", label: "None" },
                { value: "holographic", label: "Holographic" },
                { value: "foil", label: "Foil" },
                { value: "polychrome", label: "Polychrome" },
                { value: "negative", label: "Negative" },
              ],
              description: "Applies shader effect to the sprite",
            },
          ],
        },
      ],
    },
  ];

  return (
    <>
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
        title={`Edit ${editingItem?.name || "Voucher"}`}
        description="Modify voucher properties."
        tabs={voucherDialogTabs}
        onSave={handleUpdate}
        renderPreview={(item) => (
          <BalatroCard type="voucher" data={item} size="lg" />
        )}
      />
    </>
  );
}
