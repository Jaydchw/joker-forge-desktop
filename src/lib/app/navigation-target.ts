export type NavigationEditor = "info" | "rules";

export interface NavigationTarget {
  path: string;
  itemId?: string;
  editor?: NavigationEditor;
}
