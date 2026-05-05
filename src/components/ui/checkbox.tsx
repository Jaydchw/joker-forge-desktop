"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckboxProps = Omit<
  React.ComponentProps<typeof CheckboxPrimitive.Root>,
  "onChange"
> & {
  label?: string;
  onChange?: (checked: boolean) => void;
};

function Checkbox({
  id,
  label,
  checked,
  onCheckedChange,
  onChange,
  className,
  ...props
}: CheckboxProps) {
  const checkboxNode = (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={(next) => {
        onCheckedChange?.(next);
        onChange?.(next === true);
      }}
      data-slot="checkbox"
      className={cn(
        "peer cursor-pointer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-lg border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) {
    return checkboxNode;
  }

  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 cursor-pointer select-none"
    >
      {checkboxNode}
      <span className="text-sm text-zinc-100">{label}</span>
    </label>
  );
}

export { Checkbox };
