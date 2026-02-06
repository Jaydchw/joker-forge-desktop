import { useState } from "react";
import {
  Smiley,
  Flask,
  Cards,
  Star,
  Stamp,
  Palette,
  Package,
  Ticket,
  Pencil,
  Check,
  X,
  Plus,
  DownloadSimple,
  CaretDown,
  Book,
  GithubLogo,
  DiscordLogo,
  Heart,
  Key,
  ArrowUUpLeft,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useProjectData } from "@/lib/storage";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { StatButton } from "@/components/ui/stat-button";
import { ActionButton } from "@/components/ui/action-button";
import { ResourceLink } from "@/components/ui/resource-link";

export function OverviewPage() {
  const { data, updateMetadata } = useProjectData();
  const { stats, metadata } = data;

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(metadata);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

  const [projects] = useState([
    { id: "my_custom_mod", name: "My Custom Mod", version: "1.0.0" },
    { id: "balatro_expanded", name: "Balatro Expanded", version: "0.5.2" },
    { id: "joker_pack_v1", name: "Joker Pack Vol.1", version: "2.1.0" },
  ]);

  const handleSaveMetadata = () => {
    updateMetadata(editForm);
    setIsEditing(false);
  };

  const handleCancelMetadata = () => {
    setEditForm(metadata);
    setIsEditing(false);
  };

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
                        onClick={() => setIsProjectMenuOpen(false)}
                      >
                        <span
                          className={`font-medium ${proj.id === metadata.id ? "text-primary" : "text-foreground"}`}
                        >
                          {proj.name}
                        </span>
                        <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded border border-border">
                          v{proj.version}
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
            <ActionButton label="New Project" icon={Plus} />
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
          {isEditing ? (
            <div className="space-y-6 max-w-3xl p-6 border border-primary/30 bg-primary/5 rounded-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-primary">
                  Edit Metadata
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelMetadata}
                  className="cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold text-muted-foreground">
                    Mod Name
                  </label>
                  <Input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    className="text-xl font-bold h-auto py-2 cursor-text bg-background"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-bold text-muted-foreground">
                      Author
                    </label>
                    <Input
                      value={editForm.author}
                      onChange={(e) =>
                        setEditForm({ ...editForm, author: [e.target.value] })
                      }
                      className="cursor-text bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-bold text-muted-foreground">
                      Version
                    </label>
                    <Input
                      value={editForm.version}
                      onChange={(e) =>
                        setEditForm({ ...editForm, version: e.target.value })
                      }
                      className="cursor-text bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-bold text-muted-foreground">
                      Prefix
                    </label>
                    <Input
                      value={editForm.prefix}
                      onChange={(e) =>
                        setEditForm({ ...editForm, prefix: e.target.value })
                      }
                      className="cursor-text bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold text-muted-foreground">
                    Description
                  </label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    className="resize-none cursor-text bg-background min-h-25"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSaveMetadata}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
                  >
                    <Check className="mr-2 h-4 w-4" /> Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelMetadata}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl space-y-6">
              <div className="flex items-center gap-4">
                <h1 className="text-5xl font-bold tracking-tight text-foreground">
                  {metadata.name}
                </h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing(true)}
                  className="opacity-50 hover:opacity-100 cursor-pointer hover:bg-accent"
                >
                  <Pencil className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground/40">ID:</span>
                  <code className="bg-accent px-1.5 py-0.5 rounded text-foreground font-mono">
                    {metadata.id}
                  </code>
                </div>
                <div className="w-1 h-1 rounded-full bg-border" />
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground/40">Prefix:</span>
                  <code className="bg-accent px-1.5 py-0.5 rounded text-foreground font-mono">
                    {metadata.prefix}
                  </code>
                </div>
                <div className="w-1 h-1 rounded-full bg-border" />
                <span>v{metadata.version}</span>
                <div className="w-1 h-1 rounded-full bg-border" />
                <span>
                  by <span className="text-foreground">{metadata.author}</span>
                </span>
              </div>

              <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl border-l-4 border-primary/20 pl-4 py-1">
                {metadata.description}
              </p>
            </div>
          )}
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
    </div>
  );
}
