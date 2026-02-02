import { Button } from "@/components/ui/button";

interface ActionButtonProps {
  label: string;
  icon: any;
  onClick?: () => void;
}

export function ActionButton({
  label,
  icon: Icon,
  onClick,
}: ActionButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="h-20 flex flex-col items-center justify-center gap-2 border-dashed border-2 border-border hover:border-primary hover:bg-primary/5 dark:hover:border-primary dark:hover:bg-primary/10 cursor-pointer transition-colors duration-200 rounded-xl"
    >
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-xs font-bold">{label}</span>
    </Button>
  );
}
