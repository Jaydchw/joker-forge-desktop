import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAllRarities, getRarityBadgeColor } from "@/lib/balatro-utils";
import { cn } from "@/lib/utils";

interface RaritySelectProps {
  value: string | number;
  onChange: (value: string) => void;
  className?: string;
}

export function RaritySelect({
  value,
  onChange,
  className,
}: RaritySelectProps) {
  const rarities = getAllRarities();
  const currentRarity = rarities.find(
    (r) => r.value.toString() === value.toString(),
  );

  const currentColor = currentRarity
    ? getRarityBadgeColor(currentRarity.value)
    : "#009dff";

  return (
    <Select value={value.toString()} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          "h-8 font-bold uppercase tracking-wider border-2 cursor-pointer transition-colors focus:ring-0 focus:ring-offset-0 bg-popover!",
          className,
        )}
        style={{
          borderColor: currentColor,
          color: currentColor,
          backgroundColor: `${currentColor}20`,
        }}
      >
        <SelectValue placeholder="Select Rarity" />
      </SelectTrigger>
      <SelectContent className="border-none bg-popover p-2 shadow-xl">
        {rarities.map((rarity) => {
          const color = getRarityBadgeColor(rarity.value);
          return (
            <SelectItem
              key={rarity.key}
              value={rarity.value.toString()}
              className="font-bold uppercase tracking-wider cursor-pointer my-2 border-2 transition-all hover:scale-105 focus:scale-105 focus:bg-transparent"
              style={{
                borderColor: color,
                color: color,
                backgroundColor: `${color}20`,
              }}
            >
              {rarity.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
