import React from "react";
import {
  Palette,
  Terminal,
  ChartPieSlice,
  Cube,
  BracketsCurly,
  ClockCounterClockwise,
  MusicNotes,
} from "@phosphor-icons/react";
import IconButton from "@/components/ui/icon-button";

interface PanelState {
  id: string;
  isVisible: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface FloatingDockProps {
  panels: Record<string, PanelState>;
  onTogglePanel: (panelId: string) => void;
}

const FloatingDock: React.FC<FloatingDockProps> = ({
  panels,
  onTogglePanel,
}) => {
  const allDockItems = [
    {
      id: "blockPalette",
      icon: Palette,
      label: "Block Palette",
      shortcut: "B",
    },
    {
      id: "variables",
      icon: Terminal,
      label: "Variables",
      shortcut: "V",
    },
    {
      id: "gameVariables",
      icon: Cube,
      label: "Game Variables",
      shortcut: "G",
    },
    {
      id: "inspector",
      icon: ChartPieSlice,
      label: "Inspector",
      shortcut: "P",
    },
    {
      id: "liveCode",
      icon: BracketsCurly,
      label: "Live Code",
      shortcut: "L",
    },
    {
      id: "history",
      icon: ClockCounterClockwise,
      label: "History",
      shortcut: "H",
    },
    {
      id: "sounds",
      icon: MusicNotes,
      label: "Sounds",
      shortcut: "N",
    },
  ];

  return (
    <div
      className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50"
      data-rb-panel="true"
    >
      <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl px-3 py-2 shadow-lg">
        <div className="flex items-center gap-2">
          {allDockItems.map((item) => {
            const Icon = item.icon;
            const isActive = panels[item.id]?.isVisible;

            return (
              <div key={item.id} className="relative">
                <IconButton
                  icon={Icon}
                  onClick={() => onTogglePanel(item.id)}
                  tooltip={item.label}
                  shortcut={item.shortcut}
                  isActive={isActive}
                  iconOnly
                  className="rounded-xl"
                  iconClassName="h-5 w-5"
                />
                {isActive && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-card"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FloatingDock;
