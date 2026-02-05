import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Gear, Monitor } from "@phosphor-icons/react";

export function SettingsPopover() {
  const [scale, setScale] = useState("1");

  useEffect(() => {
    const storedScale = localStorage.getItem("app-ui-scale") || "1";
    setScale(storedScale);
    applyScale(storedScale);
  }, []);

  const applyScale = (value: string) => {
    const root = document.documentElement;
    root.style.fontSize = `${parseFloat(value) * 16}px`;
    document.body.style.transform = "";
    document.body.style.width = "";
    document.body.style.height = "";
    document.body.style.transformOrigin = "";
  };

  const handleScaleChange = (value: string) => {
    setScale(value);
    localStorage.setItem("app-ui-scale", value);
    applyScale(value);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
        >
          <Gear className="h-5 w-5" weight="duotone" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Settings</h4>
            <p className="text-sm text-muted-foreground">
              Customize your application experience.
            </p>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ui-scale" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                UI Scaling
              </Label>
              <Select value={scale} onValueChange={handleScaleChange}>
                <SelectTrigger id="ui-scale" className="w-35 h-9">
                  <SelectValue placeholder="Select scale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.85">Small</SelectItem>
                  <SelectItem value="1">Medium</SelectItem>
                  <SelectItem value="1.25">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
