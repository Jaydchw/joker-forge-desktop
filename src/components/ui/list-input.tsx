import { memo, useCallback, useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";

interface ListInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export const ListInput = memo(function ListInput({
  value,
  onChange,
  placeholder,
}: ListInputProps) {
  const [draft, setDraft] = useState("");

  const addItems = useCallback(
    (raw: string) => {
      const items = raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (items.length === 0) return;
      onChange([...(value || []), ...items]);
    },
    [onChange, value],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;

      if (next.includes(",")) {
        const parts = next.split(",");
        const readyItems = parts
          .slice(0, -1)
          .map((item) => item.trim())
          .filter(Boolean);

        if (readyItems.length > 0) {
          onChange([...(value || []), ...readyItems]);
        }

        setDraft(parts[parts.length - 1].trimStart());
        return;
      }

      setDraft(next);
    },
    [onChange, value],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addItems(draft);
        setDraft("");
      }
    },
    [addItems, draft],
  );

  const handleBlur = useCallback(() => {
    if (!draft.trim()) return;
    addItems(draft);
    setDraft("");
  }, [addItems, draft]);

  const handleRemove = useCallback(
    (index: number) => {
      const next = value.filter((_, idx) => idx !== index);
      onChange(next);
    },
    [onChange, value],
  );

  return (
    <div className="space-y-3">
      <Input
        value={draft}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="cursor-text"
      />
      {value.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {value.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className={[
                "group",
                "flex items-center justify-between gap-2",
                "rounded-lg border border-border bg-card",
                "px-3 py-2 text-xs font-semibold text-foreground/80",
                "shadow-sm transition-colors cursor-pointer",
                "hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive",
              ].join(" ")}
              role="button"
              tabIndex={0}
              onClick={() => handleRemove(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleRemove(index);
                }
              }}
              title={`Remove ${item}`}
            >
              <span className="truncate">{item}</span>
              <Trash className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-destructive" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
