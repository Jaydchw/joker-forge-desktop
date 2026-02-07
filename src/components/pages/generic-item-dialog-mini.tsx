import {
  GenericItemDialog,
  type GenericItemDialogProps,
} from "@/components/pages/generic-item-dialog";

export function GenericItemDialogMini<T extends { id: string }>(
  props: Omit<GenericItemDialogProps<T>, "variant" | "renderPreview"> & {
    renderPreview?: never;
  },
) {
  return <GenericItemDialog {...props} variant="mini" />;
}
