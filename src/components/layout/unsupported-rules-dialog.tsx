import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WarningCircle } from "@phosphor-icons/react";

interface UnsupportedRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unsupportedParts: string[];
  onExportAnyway: () => void;
}

function toDisplayName(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseParts(parts: string[]): {
  triggers: string[];
  conditions: string[];
  effects: string[];
} {
  const triggers: string[] = [];
  const conditions: string[] = [];
  const effects: string[] = [];

  for (const part of parts) {
    const [prefix, ...rest] = part.split(":");
    const name = rest.join(":");
    if (prefix === "trigger") triggers.push(name);
    else if (prefix === "condition") conditions.push(name);
    else if (prefix === "effect") effects.push(name);
  }

  return { triggers, conditions, effects };
}

function Section({
  label,
  items,
  color,
}: {
  label: string;
  items: string[];
  color: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${color}`}
          >
            {toDisplayName(item)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function UnsupportedRulesDialog({
  open,
  onOpenChange,
  unsupportedParts,
  onExportAnyway,
}: UnsupportedRulesDialogProps) {
  const { triggers, conditions, effects } = parseParts(unsupportedParts);
  const totalCount = triggers.length + conditions.length + effects.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg sm:px-8">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <WarningCircle className="h-6 w-6 text-amber-500 shrink-0" weight="fill" />
            <div>
              <DialogTitle className="text-lg font-black tracking-tight text-foreground">
                Unsupported Rules Detected
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {totalCount} rule{totalCount !== 1 ? "s" : ""} in your mod
                {totalCount !== 1 ? " are" : " is"} not yet supported by the
                code generator and will be skipped.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <Section
            label="Triggers"
            items={triggers}
            color="border-balatro-money/40 bg-balatro-money/10 text-balatro-money"
          />
          <Section
            label="Conditions"
            items={conditions}
            color="border-balatro-blue/40 bg-balatro-blue/10 text-balatro-blue"
          />
          <Section
            label="Effects"
            items={effects}
            color="border-balatro-green/40 bg-balatro-green/10 text-balatro-green"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="cursor-pointer flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="cursor-pointer flex-1"
            onClick={() => {
              onOpenChange(false);
              onExportAnyway();
            }}
          >
            Export Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
