export type AceSelection =
  | "none"
  | "HC_A_hearts"
  | "HC_A_diamonds"
  | "HC_A_clubs"
  | "HC_A_spades";

export const DEFAULT_ACE_SELECTION: AceSelection = "HC_A_hearts";

export const getAceImagePath = (
  ace: Exclude<AceSelection, "none">,
  folder: "aces" | "acesbg" = "aces",
): string => `/images/${folder}/${ace}.png`;

