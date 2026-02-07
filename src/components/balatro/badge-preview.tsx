import { cn } from "@/lib/utils";

interface BadgePreviewProps {
  label: string;
  color: string;
  textColor?: string;
  className?: string;
  size?: "sm" | "md";
}

export function BadgePreview({
  label,
  color,
  textColor = "#ffffff",
  className,
  size = "md",
}: BadgePreviewProps) {
  const sizeClasses = size === "sm" ? "px-3 py-1 text-xs" : "px-6 py-2 text-sm";

  return (
    <div className={cn("relative inline-flex", className)}>
      <div
        className="absolute inset-0 translate-y-1 rounded-xl opacity-80"
        style={{ backgroundColor: color }}
      />
      <div
        className={cn(
          "relative rounded-xl font-bold uppercase tracking-wider",
          sizeClasses,
        )}
        style={{ backgroundColor: color, color: textColor }}
      >
        {label}
      </div>
    </div>
  );
}
