import { useCallback, useState } from "react";

export interface PanelState {
  id: string;
  isVisible: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  positionSet: boolean;
}

const createInitialPanels = (): Record<string, PanelState> => {
  const basePanels = {
    blockPalette: {
      id: "blockPalette",
      isVisible: true,
      position: { x: 20, y: 20 },
      size: { width: 320, height: 1200 },
      positionSet: true,
    },
    jokerInfo: {
      id: "jokerInfo",
      isVisible: false,
      position: { x: 0, y: 0 },
      size: { width: 320, height: 200 },
      positionSet: false,
    },
    gameVariables: {
      id: "gameVariables",
      isVisible: false,
      position: { x: 20, y: 20 },
      size: { width: 320, height: 500 },
      positionSet: true,
    },
    inspector: {
      id: "inspector",
      isVisible: false,
      position: { x: 0, y: 0 },
      size: { width: 384, height: 600 },
      positionSet: false,
    },
    liveCode: {
      id: "liveCode",
      isVisible: false,
      position: { x: 0, y: 0 },
      size: { width: 640, height: 600 },
      positionSet: false,
    },
    history: {
      id: "history",
      isVisible: false,
      position: { x: 0, y: 0 },
      size: { width: 320, height: 360 },
      positionSet: false,
    },
    sounds: {
      id: "sounds",
      isVisible: false,
      position: { x: 0, y: 0 },
      size: { width: 384, height: 520 },
      positionSet: false,
    },
  };

  return {
    ...basePanels,
    variables: {
      id: "variables",
      isVisible: false,
      position: { x: 0, y: 0 },
      size: { width: 320, height: 300 },
      positionSet: false,
    },
  };
};

const findPosition = (
  panels: Record<string, PanelState>,
  targetPanelId: string,
): { x: number; y: number } => {
  const panelSize = panels[targetPanelId].size;
  const padding = 20;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight - 100;

  const blockPalettePanel = panels.blockPalette;
  const variablesPanel = panels.variables;
  const gameVariablesPanel = panels.gameVariables;

  const blockPaletteX = 20;
  const blockPaletteWidth = 320;
  const variablesHeight = 300;

  if (targetPanelId === "variables") {
    const baseX = blockPalettePanel?.isVisible
      ? blockPaletteX + blockPaletteWidth + padding
      : blockPaletteX;

    return {
      x: baseX,
      y: blockPaletteX,
    };
  }

  if (targetPanelId === "gameVariables") {
    const baseX = blockPalettePanel?.isVisible
      ? blockPaletteX + blockPaletteWidth + padding
      : blockPaletteX;

    return {
      x: baseX,
      y: blockPaletteX + variablesHeight + padding,
    };
  }

  if (targetPanelId === "blockPalette") {
    const variablesAtBlockPaletteX =
      variablesPanel?.isVisible && variablesPanel.position.x === blockPaletteX;
    const gameVariablesAtBlockPaletteX =
      gameVariablesPanel?.isVisible &&
      gameVariablesPanel.position.x === blockPaletteX;

    if (variablesAtBlockPaletteX || gameVariablesAtBlockPaletteX) {
      return {
        x: blockPaletteX + blockPaletteWidth + padding,
        y: blockPaletteX,
      };
    }

    return {
      x: blockPaletteX,
      y: blockPaletteX,
    };
  }

  const positions = [
    { x: viewportWidth - panelSize.width - padding, y: padding },
    { x: padding, y: padding },
    {
      x: viewportWidth - panelSize.width - padding,
      y: viewportHeight - panelSize.height - padding,
    },
    { x: viewportWidth / 2 - panelSize.width / 2, y: padding },
    {
      x: viewportWidth / 2 - panelSize.width / 2,
      y: viewportHeight / 2 - panelSize.height / 2,
    },
  ];

  const hasOverlap = (
    position: { x: number; y: number },
    size: { width: number; height: number },
    excludePanelId: string,
  ): boolean => {
    const rect1 = {
      left: position.x,
      top: position.y,
      right: position.x + size.width,
      bottom: position.y + size.height,
    };

    return Object.values(panels).some((panel) => {
      if (panel.id === excludePanelId || !panel.isVisible) {
        return false;
      }

      const rect2 = {
        left: panel.position.x,
        top: panel.position.y,
        right: panel.position.x + panel.size.width,
        bottom: panel.position.y + panel.size.height,
      };

      return !(
        rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom
      );
    });
  };

  for (const position of positions) {
    if (!hasOverlap(position, panelSize, targetPanelId)) {
      return position;
    }
  }

  return {
    x: Math.random() * 200 + padding,
    y: Math.random() * 200 + padding,
  };
};

export const usePanelState = () => {
  const [panels, setPanels] = useState<Record<string, PanelState>>(() =>
    createInitialPanels(),
  );

  const togglePanel = useCallback(
    (panelId: string) => {
      setPanels((prev) => {
        const panel = prev[panelId];

        if (!panel) {
          return prev;
        }

        return {
          ...prev,
          [panelId]: {
            ...panel,
            isVisible: !panel.isVisible,
            position:
              panel.isVisible || panel.positionSet
                ? panel.position
                : findPosition(prev, panelId),
            positionSet: panel.positionSet || !panel.isVisible,
          },
        };
      });
    },
    [],
  );

  const updatePanelPosition = useCallback(
    (panelId: string, position: { x: number; y: number }) => {
      setPanels((prev) => ({
        ...prev,
        [panelId]: {
          ...prev[panelId],
          position,
          positionSet: true,
        },
      }));
    },
    [],
  );

  return {
    panels,
    togglePanel,
    updatePanelPosition,
  };
};
