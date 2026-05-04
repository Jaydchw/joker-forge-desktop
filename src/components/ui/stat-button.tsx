import { Button } from "@/components/ui/button";

interface StatButtonProps {
  title: string;
  count: number;
  icon: any;
  colorClass: string;
  href: string;
  reforged?: boolean;
}

export function StatButton({
  title,
  count,
  icon: Icon,
  colorClass,
  href,
  reforged = false,
}: StatButtonProps) {
  return (
    <Button
      variant="outline"
      className={`h-24 flex flex-col items-start justify-center gap-2 border-dashed border-2 border-border hover:border-primary hover:bg-primary/5 dark:hover:border-primary dark:hover:bg-primary/10 w-full relative group overflow-hidden cursor-pointer transition-all duration-200 rounded-md bg-linear-to-br from-primary/5 via-card to-card ${
        reforged ? "border-primary/40" : ""
      }`}
      onClick={() => (window.location.href = href)}
    >
      {reforged && (
        <span className="absolute top-2 right-2 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 border border-primary/30">
          Reforged
        </span>
      )}
      <Icon
        className={`absolute -right-8 -bottom-8 size-48 transition-all duration-500 rotate-12 group-hover:rotate-0 group-hover:scale-110 opacity-25 group-hover:opacity-100 group-hover:saturate-200 ${colorClass}`}
        weight="duotone"
      />

      <div className="flex flex-col items-start pl-1 relative z-10">
        <span className="text-3xl font-bold font-game group-hover:text-primary transition-colors">
          {count}
        </span>
        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground/80">
          {title}
        </span>
      </div>
    </Button>
  );
}
