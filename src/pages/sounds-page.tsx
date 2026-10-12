import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MusicNotes, PencilSimple, Trash } from "@phosphor-icons/react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { EditSoundDialog } from "@/components/edit-dialogs/edit-sound-dialog";
import { SoundFileControl } from "@/components/sounds/sound-file-control";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { useModName, useProjectData } from "@/lib/services/storage";
import { fuzzyMatchAny } from "@/lib/core/search";
import { getNextSoundKey } from "@/lib/sounds/sound-editor-utils";
import type { SoundData } from "@/lib/core/types";

export default function SoundsPage() {
  const { data, updateSounds, isHydrating, currentProjectId } = useProjectData();
  const modName = useModName();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingItem = data.sounds.find((sound) => sound.id === editingId) ?? null;

  const handleUpdate = useCallback((id: string, updates: Partial<SoundData>) => {
    updateSounds((previous) => previous.map((sound) => sound.id === id ? { ...sound, ...updates } : sound));
  }, [updateSounds]);

  const handleCreate = useCallback(() => {
    const id = crypto.randomUUID();
    updateSounds((previous) => [...previous, {
      id, key: getNextSoundKey(previous), soundString: "", audioDataUrl: "", volume: 1, pitch: 1,
    }]);
    setEditingId(id);
  }, [updateSounds]);

  const handleDelete = useCallback((id: string) => {
    updateSounds((previous) => previous.filter((sound) => sound.id !== id));
    setEditingId((previous) => previous === id ? null : previous);
  }, [updateSounds]);
  const deleteConfirmation = useConfirmDelete(handleDelete);

  useEffect(() => {
    setEditingId(null);
    deleteConfirmation.handleOpenChange(false);
  }, [currentProjectId, deleteConfirmation.handleOpenChange]);

  useEffect(() => {
    if (isHydrating) return;
    const targetId = searchParams.get("activityItemId");
    if (!targetId || searchParams.get("activityEditor") !== "info") return;
    if (!data.sounds.some((sound) => sound.id === targetId)) return;
    setEditingId(targetId);
    const next = new URLSearchParams(searchParams);
    next.delete("activityItemId");
    next.delete("activityEditor");
    setSearchParams(next, { replace: true });
  }, [data.sounds, isHydrating, searchParams, setSearchParams]);

  const sortOptions = useMemo(() => [
    { label: "Key", value: "key", sortFn: (a: SoundData, b: SoundData) => a.key.localeCompare(b.key) },
    { label: "Filename", value: "filename", sortFn: (a: SoundData, b: SoundData) => a.soundString.localeCompare(b.soundString) },
  ], []);
  const searchProps = useMemo(() => ({
    placeholder: "Search sounds by key or filename...",
    searchFn: (sound: SoundData, term: string) => fuzzyMatchAny([sound.key, sound.soundString, sound.replace ?? ""], term),
  }), []);

  const renderCard = useCallback((sound: SoundData) => (
    <div key={`${currentProjectId}:${sound.id}`} className="rounded-2xl bg-card/95 p-4 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <MusicNotes className="h-5 w-5 shrink-0 text-muted-foreground" />
          <h2 className="truncate font-semibold text-foreground" title={sound.key}>{sound.key || "Unnamed sound"}</h2>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => deleteConfirmation.requestDelete(sound.id, sound.key)} aria-label={`Delete ${sound.key || "sound"}`} className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10">
          <Trash className="h-4 w-4" />
        </Button>
      </div>
      <SoundFileControl sound={sound} onUpload={(upload) => handleUpdate(sound.id, upload)} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Volume {sound.volume ?? 1}</span>
        <span>Pitch {sound.pitch ?? 1}</span>
        {sound.replace && <span className="truncate" title={sound.replace}>Replaces {sound.replace}</span>}
      </div>
      <div className="flex justify-end border-t border-border/50 pt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(sound.id)} className="cursor-pointer">
          <PencilSimple className="mr-1.5 h-4 w-4" />Edit sound
        </Button>
      </div>
    </div>
  ), [currentProjectId, deleteConfirmation.requestDelete, handleUpdate]);

  return (
    <>
      <GenericItemPage<SoundData>
        key={currentProjectId}
        title="Sounds"
        subtitle={modName}
        items={data.sounds}
        isLoading={isHydrating}
        onAddNew={isHydrating ? undefined : handleCreate}
        addNewLabel="Add Sound"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
      />
      <EditSoundDialog key={currentProjectId} mode="project" editingItem={editingItem} setEditingItem={(sound) => setEditingId(sound?.id ?? null)} sounds={data.sounds} modPrefix={data.metadata.prefix} onSave={handleUpdate} />
      <ConfirmDialog open={deleteConfirmation.isDialogOpen} onOpenChange={deleteConfirmation.handleOpenChange} title="Delete this sound?" description={`Delete ${deleteConfirmation.pendingLabel || "this sound"} and its uploaded audio?`} confirmLabel="Delete sound" onConfirm={deleteConfirmation.confirmDelete} />
    </>
  );
}
