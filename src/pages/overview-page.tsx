import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Smiley,
  Flask,
  Cards,
  Star,
  Stamp,
  Palette,
  Package,
  Ticket,
  Plus,
  DownloadSimple,
  CaretDown,
  Book,
  GithubLogo,
  DiscordLogo,
  Heart,
  Key,
  ArrowUUpLeft,
  Trash,
} from "@phosphor-icons/react";
import { useProjectData } from "@/lib/storage";
import { motion, AnimatePresence } from "framer-motion";
import { StatButton } from "@/components/ui/stat-button";
import { ActionButton } from "@/components/ui/action-button";
import { ResourceLink } from "@/components/ui/resource-link";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";

export function OverviewPage() {
  const {
    data,
    updateMetadata,
    projects,
    currentProjectId,
    switchProject,
    createProject,
    deleteProject,
  } = useProjectData();
  const { stats, metadata } = data;

  const [editingField, setEditingField] = useState<
    "none" | "name" | "id" | "prefix" | "version" | "author" | "description"
  >("none");
  const [tempValue, setTempValue] = useState("");
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const identifierRegex = /^[A-Za-z0-9_]+$/;
  const versionRegex = /^\d+\.\d+\.\d+$/;

  const createUniqueProjectName = (baseName: string) => {
    const existingNames = new Set(
      projects.map((project) => project.name.toLowerCase()),
    );
    if (!existingNames.has(baseName.toLowerCase())) return baseName;
    let suffix = 2;
    let candidate = `${baseName} ${suffix}`;
    while (existingNames.has(candidate.toLowerCase())) {
      suffix += 1;
      candidate = `${baseName} ${suffix}`;
    }
    return candidate;
  };

  const handleCreateProject = () => {
    const baseName = createUniqueProjectName("New Project");
    const nextId = generateModIdFromName(baseName);
    const nextPrefix = generatePrefixFromId(nextId);
    createProject({ name: baseName, id: nextId, prefix: nextPrefix });
    setIsProjectMenuOpen(false);
  };

  const handleDeleteProject = (projectId: string) => {
    deleteProject(projectId);
    setIsProjectMenuOpen(false);
  };

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDeleteProject);

  useEffect(() => {
    if (editingField !== "none" && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [editingField]);

  const generateModIdFromName = (name: string) => {
    const sanitized = name
      .toLowerCase()
      .replace(/[^a-z0-9_\s]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    return sanitized || "my_custom_mod";
  };

  const generatePrefixFromId = (id: string) => id.toLowerCase().slice(0, 8);

  const sanitizeIdentifier = (value: string) =>
    value.replace(/[^A-Za-z0-9_]/g, "");

  const sanitizeVersionInput = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".").slice(0, 3);
    return parts.join(".");
  };

  const startEdit = (
    field: "name" | "id" | "prefix" | "version" | "author" | "description",
    value: string,
  ) => {
    setEditingField(field);
    setTempValue(value);
  };

  const cancelEdit = () => {
    setEditingField("none");
    setTempValue("");
  };

  const saveEdit = () => {
    const nextValue = tempValue.trim();
    if (editingField === "name") {
      if (nextValue) {
        const nextId = generateModIdFromName(nextValue);
        const nextPrefix = generatePrefixFromId(nextId);
        updateMetadata({ name: nextValue, id: nextId, prefix: nextPrefix });
      }
    } else if (editingField === "id") {
      const sanitized = sanitizeIdentifier(nextValue);
      if (sanitized && identifierRegex.test(sanitized)) {
        updateMetadata({ id: sanitized });
      }
    } else if (editingField === "prefix") {
      const sanitized = sanitizeIdentifier(nextValue);
      if (sanitized && identifierRegex.test(sanitized)) {
        updateMetadata({ prefix: sanitized });
      }
    } else if (editingField === "version") {
      if (versionRegex.test(nextValue)) {
        updateMetadata({ version: nextValue });
      }
    } else if (editingField === "author") {
      if (nextValue) updateMetadata({ author: [nextValue] });
    } else if (editingField === "description") {
      updateMetadata({ description: tempValue });
    }

    setEditingField("none");
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      saveEdit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  const authorLabel = Array.isArray(metadata.author)
    ? metadata.author.join(", ")
    : String(metadata.author ?? "");

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            Project Workspace
          </h2>

          <div className="relative">
            <button
              onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
              className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer text-left"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                  <Package className="h-6 w-6" weight="fill" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-0.5">
                    Current Project
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {metadata.name}
                  </div>
                </div>
              </div>
              <CaretDown
                className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isProjectMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {isProjectMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 right-0 mt-2 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
                >
                  <div className="p-2 space-y-1">
                    <div className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Switch Project
                    </div>
                    {projects.map((proj) => (
                      <button
                        key={proj.id}
                        className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-accent transition-colors text-left group cursor-pointer"
                        onClick={() => {
                          switchProject(proj.id);
                          setIsProjectMenuOpen(false);
                        }}
                      >
                        <span
                          className={`font-medium ${proj.id === currentProjectId ? "text-primary" : "text-foreground"}`}
                        >
                          {proj.name}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded border border-border">
                            v{proj.version}
                          </span>
                          <span className="h-5 w-px bg-border" />
                          <button
                            type="button"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/60 hover:bg-destructive/10 transition-colors cursor-pointer"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setIsProjectMenuOpen(false);
                              requestDelete(proj.id, proj.name);
                            }}
                            aria-label={`Delete ${proj.name}`}
                          >
                            <Trash className="h-4 w-4" weight="bold" />
                          </button>
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <ActionButton
              label="New Project"
              icon={Plus}
              onClick={handleCreateProject}
            />
            <ActionButton
              label="Import JSON / JokerForge"
              icon={DownloadSimple}
            />
          </div>
        </div>
      </div>

      <div className="border-b border-border w-full" />

      <div className="relative overflow-hidden">
        <div className="relative z-10">
          <div className="max-w-4xl space-y-6">
            <div className="flex items-center gap-4">
              {editingField === "name" ? (
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  value={tempValue}
                  onChange={(event) => setTempValue(event.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleKeyDown}
                  className="text-5xl font-bold tracking-tight text-foreground bg-transparent border-none p-0 outline-none focus:outline-none w-full"
                />
              ) : (
                <h1
                  className="text-5xl font-bold tracking-tight text-foreground cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => startEdit("name", metadata.name)}
                >
                  {metadata.name}
                </h1>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
              <div className="flex items-center gap-1.5">
                <span className="text-foreground/40">ID:</span>
                {editingField === "id" ? (
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    value={tempValue}
                    onChange={(event) =>
                      setTempValue(sanitizeIdentifier(event.target.value))
                    }
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    className="bg-accent px-1.5 py-0.5 rounded text-foreground font-mono border-none outline-none focus:outline-none"
                  />
                ) : (
                  <code
                    className="bg-accent px-1.5 py-0.5 rounded text-foreground font-mono cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => startEdit("id", metadata.id)}
                  >
                    {metadata.id}
                  </code>
                )}
              </div>
              <div className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-foreground/40">Prefix:</span>
                {editingField === "prefix" ? (
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    value={tempValue}
                    onChange={(event) =>
                      setTempValue(sanitizeIdentifier(event.target.value))
                    }
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    className="bg-accent px-1.5 py-0.5 rounded text-foreground font-mono border-none outline-none focus:outline-none"
                  />
                ) : (
                  <code
                    className="bg-accent px-1.5 py-0.5 rounded text-foreground font-mono cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => startEdit("prefix", metadata.prefix)}
                  >
                    {metadata.prefix}
                  </code>
                )}
              </div>
              <div className="w-1 h-1 rounded-full bg-border" />
              {editingField === "version" ? (
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  value={tempValue}
                  onChange={(event) =>
                    setTempValue(sanitizeVersionInput(event.target.value))
                  }
                  onBlur={saveEdit}
                  onKeyDown={handleKeyDown}
                  placeholder="x.y.z"
                  className="bg-transparent border-none p-0 outline-none focus:outline-none text-sm text-muted-foreground font-medium"
                />
              ) : (
                <span
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => startEdit("version", metadata.version)}
                >
                  v{metadata.version}
                </span>
              )}
              <div className="w-1 h-1 rounded-full bg-border" />
              <span className="flex items-center gap-1">
                by
                {editingField === "author" ? (
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    value={tempValue}
                    onChange={(event) => setTempValue(event.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent border-none p-0 outline-none focus:outline-none text-foreground text-sm font-medium"
                  />
                ) : (
                  <span
                    className="text-foreground cursor-pointer hover:text-primary transition-colors"
                    onClick={() => startEdit("author", authorLabel)}
                  >
                    {authorLabel}
                  </span>
                )}
              </span>
            </div>

            {editingField === "description" ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={tempValue}
                onChange={(event) => setTempValue(event.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                className="text-lg text-muted-foreground leading-relaxed max-w-3xl border-l-4 border-primary/20 pl-4 py-1 bg-transparent resize-none w-full outline-none focus:outline-none"
              />
            ) : (
              <p
                className="text-lg text-muted-foreground leading-relaxed max-w-3xl border-l-4 border-primary/20 pl-4 py-1 cursor-pointer hover:text-foreground transition-colors"
                onClick={() =>
                  startEdit("description", metadata.description || "")
                }
              >
                {metadata.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 text-foreground/80">
            <Cards className="h-5 w-5 text-primary" />
            Components
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatButton
            title="Jokers"
            count={stats.jokers}
            icon={Smiley}
            href="/jokers"
            colorClass="text-joker-primary"
          />
          <StatButton
            title="Consumables"
            count={stats.consumables}
            icon={Flask}
            href="/consumables"
            colorClass="text-consumable-primary"
          />
          <StatButton
            title="Vouchers"
            count={stats.vouchers}
            icon={Ticket}
            href="/vouchers"
            colorClass="text-voucher-primary"
          />
          <StatButton
            title="Decks"
            count={stats.decks}
            icon={Cards}
            href="/decks"
            colorClass="text-deck-primary"
          />
          <StatButton
            title="Enhancements"
            count={stats.enhancements}
            icon={Star}
            href="/enhancements"
            colorClass="text-enhancement-primary"
          />
          <StatButton
            title="Seals"
            count={stats.seals}
            icon={Stamp}
            href="/seals"
            colorClass="text-seal-primary"
          />
          <StatButton
            title="Editions"
            count={stats.editions}
            icon={Palette}
            href="/editions"
            colorClass="text-edition-primary"
          />
          <StatButton
            title="Boosters"
            count={stats.boosters}
            icon={Package}
            href="/boosters"
            colorClass="text-booster-primary"
          />
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <h3 className="text-lg font-bold tracking-tight text-foreground/80 flex items-center gap-2">
            <ArrowUUpLeft className="h-5 w-5 text-primary" />
            Recent Activity
          </h3>
          <div className="bg-card border border-border rounded-xl p-1 shadow-sm">
            {data.recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 hover:bg-accent/50 rounded-lg transition-colors group cursor-default border-b border-border/50 last:border-0"
              >
                <div className="h-2 w-2 rounded-full bg-muted-foreground/50 group-hover:bg-primary transition-colors" />
                <p className="text-sm font-medium leading-none text-foreground/80 group-hover:text-foreground transition-colors">
                  {activity}
                </p>
                <span className="ml-auto text-xs text-muted-foreground opacity-50">
                  Just now
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold tracking-tight text-foreground/80 flex items-center gap-2">
            <Book className="h-5 w-5 text-primary" />
            Resources
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ResourceLink
              label="Documentation"
              icon={Book}
              href="https://github.com/Jayd-H/joker-forge/wiki"
              colorClass="text-blue-400"
            />
            <ResourceLink
              label="GitHub Repository"
              icon={GithubLogo}
              href="https://github.com/Jayd-H/joker-forge"
            />
            <ResourceLink
              label="Discord Server"
              icon={DiscordLogo}
              href="https://discord.gg/eRBByq9AZX"
              colorClass="text-indigo-400"
            />
            <ResourceLink
              label="Acknowledgements"
              icon={Heart}
              href="/acknowledgements"
              colorClass="text-pink-400"
            />
            <ResourceLink
              label="Keys Reference"
              icon={Key}
              href="/keys"
              colorClass="text-yellow-400"
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        title="Delete this project?"
        description={
          <>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this project"}
            </span>
            . This cannot be undone.
          </>
        }
        confirmLabel="Delete Project"
        confirmVariant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
