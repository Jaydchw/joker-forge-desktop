import { useCallback, useState } from "react";
import { getConfirmDeleteEnabled } from "@/lib/storage";

export const useConfirmDelete = (onDelete: (id: string) => void) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);

  const requestDelete = useCallback(
    (id: string, label?: string) => {
      if (!getConfirmDeleteEnabled()) {
        onDelete(id);
        return;
      }
      setPendingId(id);
      setPendingLabel(label || null);
      setIsDialogOpen(true);
    },
    [onDelete],
  );

  const confirmDelete = useCallback(() => {
    if (pendingId) {
      onDelete(pendingId);
    }
    setPendingId(null);
    setPendingLabel(null);
    setIsDialogOpen(false);
  }, [onDelete, pendingId]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setPendingId(null);
      setPendingLabel(null);
    }
    setIsDialogOpen(open);
  }, []);

  return {
    isDialogOpen,
    pendingId,
    pendingLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange,
  };
};
