export type Rule = any;

export type BoosterType = "joker" | "consumable" | "playing_card" | "voucher";

export interface ModMetadata {
  id: string;
  name: string;
  author: string[];
  description: string;
  prefix: string;
  main_file: string;
  version: string;
  priority: number;
  badge_colour: string;
  badge_text_colour: string;
  display_name: string;
  dependencies: string[];
  conflicts: string[];
  provides: string[];
  gameImage: string;
  iconImage: string;
  hasUserUploadedIcon: boolean;
  hasUserUploadedGameIcon: boolean;
  disable_vanilla?: boolean;
}

export interface CardAppearance {
  jud?: boolean;
  buf?: boolean;
  rif?: boolean;
  rta?: boolean;
  sou?: boolean;
  uta?: boolean;
  wra?: boolean;
}

export interface UnlockProperty {
  category: string;
  property: string;
}

export interface JokerData {
  objectType: "joker";
  id: string;
  name: string;
  description: string;
  unlockDescription?: string;
  imagePreview: string;
  overlayImagePreview?: string;
  rarity: number | string;
  cost: number;
  blueprint_compat: boolean;
  eternal_compat: boolean;
  perishable_compat?: boolean;
  unlocked: boolean;
  discovered: boolean;
  rules: Rule[];
  orderValue: number;
  placeholderCreditIndex?: number;
  appears_in_shop: boolean;
  cardAppearance: CardAppearance;
  appearFlags?: string;
  pools?: string[];
  objectKey: string;
  force_eternal?: boolean;
  force_perishable?: boolean;
  force_rental?: boolean;
  ignoreSlotLimit?: boolean;
  info_queues?: string[];
  card_dependencies?: string[];
  hasUserUploadedImage?: boolean;
  unlockTrigger?: string;
  unlockOperator?: string;
  unlockCount?: number;
  unlockProperties?: UnlockProperty[];
  locVars?: { vars: string[] };
  force_foil?: boolean;
  force_holographic?: boolean;
  force_polychrome?: boolean;
  force_negative?: boolean;
  scale_w?: number;
  scale_h?: number;
}

export interface ConsumableData {
  objectType: "consumable";
  id: string;
  name: string;
  description: string;
  imagePreview: string;
  overlayImagePreview?: string;
  orderValue: number;
  set: string;
  cost: number;
  unlocked: boolean;
  discovered: boolean;
  hidden?: boolean;
  rules: Rule[];
  placeholderCreditIndex?: number;
  objectKey: string;
  can_repeat_soul?: boolean;
  hasUserUploadedImage?: boolean;
}

export interface DeckData {
  objectType: "deck";
  id: string;
  name: string;
  description: string;
  imagePreview: string;
  objectKey: string;
  unlocked: boolean;
  discovered: boolean;
  rules: Rule[];
  placeholderCreditIndex?: number;
  orderValue: number;
  Config_consumables?: string[];
  Config_vouchers?: string[];
  no_collection?: boolean;
  no_interest?: boolean;
  no_faces?: boolean;
  erratic_deck?: boolean;
  hasUserUploadedImage?: boolean;
}

export interface VoucherData {
  objectType: "voucher";
  id: string;
  name: string;
  description: string;
  unlockDescription?: string;
  imagePreview: string;
  overlayImagePreview?: string;
  objectKey: string;
  unlocked: boolean;
  discovered: boolean;
  cost: number;
  rules: Rule[];
  placeholderCreditIndex?: number;
  orderValue: number;
  no_collection?: boolean;
  requires?: string;
  requires_activetor?: boolean;
  can_repeat_soul?: boolean;
  draw_shader_sprite?: string | false;
  unlockTrigger?: string;
  unlockOperator?: string;
  unlockCount?: number;
  unlockProperties?: UnlockProperty[];
  hasUserUploadedImage?: boolean;
}

export interface BoosterConfig {
  extra?: number;
  choose?: number;
}

export interface BoosterCardRule {
  weight: number;
  set?: string;
  suit?: string;
  specific_type?: "consumable" | "joker" | "voucher" | null;
  specific_key?: string;
  pool?: string;
  rarity?: string;
  edition?: string;
  rank?: string;
  enhancement?: string;
  seal?: string;
}

export interface BoosterData {
  id: string;
  name: string;
  description: string;
  orderValue: number;
  imagePreview: string;
  cost: number;
  weight: number;
  draw_hand: boolean;
  instant_use: boolean;
  booster_type: BoosterType;
  config: BoosterConfig;
  card_rules: BoosterCardRule[];
  discovered: boolean;
  objectKey: string;
  objectType: "booster";
  placeholderCreditIndex?: number;
  group_key?: string;
  kind?: string;
  hidden?: boolean;
  background_colour?: string;
  special_colour?: string;
  hasUserUploadedImage?: boolean;
}

export interface SealData {
  objectType: "seal";
  id: string;
  name: string;
  description: string;
  imagePreview: string;
  objectKey: string;
  badge_colour: string;
  unlocked: boolean;
  discovered: boolean;
  sound?: string;
  rules: Rule[];
  placeholderCreditIndex?: number;
  orderValue: number;
  no_collection?: boolean;
  pitch?: number;
  volume?: number;
  hasUserUploadedImage?: boolean;
}

export interface EditionData {
  objectType: "edition";
  id: string;
  name: string;
  description: string;
  objectKey: string;
  shader?: string | false;
  unlocked: boolean;
  discovered: boolean;
  rules: Rule[];
  weight: number;
  sound: string;
  orderValue: number;
  extra_cost?: number;
  no_collection?: boolean;
  in_shop?: boolean;
  apply_to_float?: boolean;
  disable_shadow?: boolean;
  disable_base_shader?: boolean;
  badge_colour?: string;
}

export interface EnhancementData {
  objectType: "enhancement";
  id: string;
  name: string;
  description: string;
  imagePreview: string;
  overlayImagePreview?: string;
  objectKey: string;
  unlocked: boolean;
  discovered: boolean;
  rules: Rule[];
  placeholderCreditIndex?: number;
  weight: number;
  orderValue: number;
  no_collection?: boolean;
  any_suit?: boolean;
  replace_base_card?: boolean;
  no_rank?: boolean;
  no_suit?: boolean;
  always_scores?: boolean;
  hasUserUploadedImage?: boolean;
}

export interface SoundData {
  id: string;
  key: string;
  soundString: string;
  volume?: number;
  pitch?: number;
  replace?: string;
}

export interface RarityData {
  id: string;
  key: string;
  name: string;
  badge_colour: string;
  default_weight: number;
  isCustom?: boolean;
}

export interface ConsumableSetData {
  id: string;
  key: string;
  name: string;
  primary_colour: string;
  secondary_colour: string;
  collection_rows: number[];
  shop_rate: number;
  collection_name: string;
  default_card?: any;
}

export interface UserVariable {
  type: string;
  initialSuit?: string;
  initialRank?: string;
  initialText?: string;
  initialKey?: string;
  initialPokerHand?: string;
  initialValue?: number | string;
}

export interface Mod {
  metadata: ModMetadata;
  jokers: JokerData[];
  consumables: ConsumableData[];
  boosters: BoosterData[];
  decks: DeckData[];
  vouchers: VoucherData[];
  seals: SealData[];
  editions: EditionData[];
  enhancements: EnhancementData[];
  sounds: SoundData[];
  rarities: RarityData[];
  consumableSets: ConsumableSetData[];
}

export interface UserSettings {
  darkMode: boolean;
  sidebarPinned: boolean;
  defaultAutoFormat: boolean;
}

export interface User {
  mods: Mod[];
  settings: UserSettings;
}