import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface NodeVisualState {
  id: string;
  x: number;
  y: number;
}

export interface CanvasState {
  nodes: NodeVisualState[];
  zoom: number;
}

export interface EntityMetadata {
  internal_id: string;
  base_cost: number;
  rarity_tier: string;
  blueprint_compatible: boolean;
}

export interface NodeState {
  id: string;
  node_type: string;
  values: Record<string, unknown>;
}

export interface EdgeState {
  source_id: string;
  target_id: string;
}

export interface StateSyncPayload {
  entity_type: string;
  metadata: EntityMetadata;
  nodes: NodeState[];
  edges: EdgeState[];
}

export interface SnippetResponse {
  code: string;
  description: string;
}

export interface RuleCatalogPayload {
  triggers: unknown[];
  conditions: unknown[];
  effects: unknown[];
  generic_triggers: string[];
  all_objects: string[];
  trigger_groups?: Record<string, string[]>;
  option_sources?: Record<string, string>;
  option_sets?: Record<string, unknown[]>;
}

export interface EntityBridgeHandlers {
  onStateSync: (payload: StateSyncPayload) => void;
  onLiveCodeUpdate: (code: string) => void;
}

export const entityBridge = {
  initEntity(entityType: string) {
    return invoke<StateSyncPayload>("init_entity", { entityType });
  },
  addNode(nodeType: string, id: string) {
    return invoke<StateSyncPayload>("add_node", { nodeType, id });
  },
  removeNode(id: string) {
    return invoke<StateSyncPayload>("remove_node", { id });
  },
  connectNodes(sourceId: string, targetId: string) {
    return invoke<StateSyncPayload>("connect_nodes", { sourceId, targetId });
  },
  disconnectNodes(sourceId: string, targetId: string) {
    return invoke<StateSyncPayload>("disconnect_nodes", { sourceId, targetId });
  },
  updateNodeValue(id: string, field: string, value: unknown) {
    return invoke<StateSyncPayload>("update_node_value", { id, field, value });
  },
  getNodeSnippet(nodeId: string) {
    return invoke<SnippetResponse>("get_node_snippet", { nodeId });
  },
  getRulebuilderCatalog<T extends RuleCatalogPayload>() {
    return invoke<T>("get_rulebuilder_catalog");
  },
  async subscribe(handlers: EntityBridgeHandlers): Promise<() => void> {
    const unlistenState = await listen<StateSyncPayload>(
      "state_sync",
      (event) => {
        handlers.onStateSync(event.payload);
      },
    );
    const unlistenCode = await listen<string>("live_code_update", (event) => {
      handlers.onLiveCodeUpdate(event.payload);
    });

    return () => {
      unlistenState();
      unlistenCode();
    };
  },
};

export type EntityBridgeUnlisten = UnlistenFn;
