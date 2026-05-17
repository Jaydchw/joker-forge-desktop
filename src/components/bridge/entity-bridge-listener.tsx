import { useEffect } from "react";
import { entityBridge, type StateSyncPayload } from "@/lib/services/entity-bridge";

export function EntityBridgeListener() {
  useEffect(() => {
    let dispose: (() => void) | undefined;

    const setup = async () => {
      dispose = await entityBridge.subscribe({
        onStateSync: (payload: StateSyncPayload) => {
          window.dispatchEvent(
            new CustomEvent("entity-state-sync", { detail: payload }),
          );
        },
        onLiveCodeUpdate: (code: string) => {
          window.dispatchEvent(
            new CustomEvent("entity-live-code-update", { detail: code }),
          );
        },
      });
    };

    setup();

    return () => {
      if (dispose) {
        dispose();
      }
    };
  }, []);

  return null;
}
