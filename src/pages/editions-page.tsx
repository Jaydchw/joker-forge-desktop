import { useCallback, useMemo } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { EditionData } from "@/lib/types";
import {
  Palette,
  PencilSimple,
  Sparkle,
  Trash,
  LockOpen,
  Lock,
  Eye,
  EyeSlash,
  Prohibit,
  ShoppingBag,
} from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";

export default function EditionsPage() {
  const { data, updateEditions } = useProjectData();
  const modName = useModName();

  const handleUpdate = useCallback(
    (id: string, updates: Partial<EditionData>) => {
      updateEditions(
        data.editions.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      );
    },
    [data.editions, updateEditions],
  );

  const handleCreate = useCallback(() => {
    const newEdition: EditionData = {
      id: crypto.randomUUID(),
      objectType: "edition",
      name: "New Edition",
      description: "Effect",
      objectKey: "new_edition",
      unlocked: true,
      discovered: true,
      rules: [],
      weight: 10,
      sound: "",
      orderValue: data.editions.length + 1,
      image: "",
    };
    updateEditions([...data.editions, newEdition]);
  }, [data.editions, updateEditions]);

  const handleDelete = useCallback(
    (id: string) => updateEditions(data.editions.filter((e) => e.id !== id)),
    [data.editions, updateEditions],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: EditionData, term: string) =>
        item.name.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: EditionData, b: EditionData) =>
          a.name.localeCompare(b.name),
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: EditionData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={formatBalatroText(item.description)}
        idValue={item.orderValue}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        image={<Palette className="h-20 w-20 text-muted-foreground/20" />}
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
          {
            id: "no_collection",
            label: item.no_collection ? "Hidden Collection" : "In Collection",
            icon: <Prohibit className="h-4 w-4" weight="regular" />,
            isActive: item.no_collection === true,
            variant: "default",
            onClick: () =>
              handleUpdate(item.id, { no_collection: !item.no_collection }),
          },
          {
            id: "in_shop",
            label: item.in_shop ? "In Shop" : "Not in Shop",
            icon: <ShoppingBag className="h-4 w-4" weight="regular" />,
            isActive: item.in_shop === true,
            variant: "success",
            onClick: () => handleUpdate(item.id, { in_shop: !item.in_shop }),
          },
          {
            id: "shader",
            label: item.shader ? "Shader" : "No Shader",
            icon: <Sparkle className="h-4 w-4" weight="regular" />,
            isActive: !!item.shader,
            variant: "purple",
            onClick: () => {},
          },
        ]}
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
    ),
    [handleUpdate, handleDelete],
  );

  return (
    <GenericItemPage<EditionData>
      title="Editions"
      subtitle={modName}
      items={data.editions}
      onAddNew={handleCreate}
      addNewLabel="Create Edition"
      searchProps={searchProps}
      sortOptions={sortOptions}
      renderCard={renderCard}
    />
  );
}
