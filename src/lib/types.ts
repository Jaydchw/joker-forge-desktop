export type ParameterValue = string | number | boolean | string[];

export interface NodeParams {
  [key: string]: ParameterValue;
}

export interface LogicNode {
  id: string;
  params: NodeParams;
}

export interface RuleTrigger {
  id: string;
  params?: NodeParams;
}

export interface Rule {
  id: string;
  trigger: RuleTrigger;
  conditions: LogicNode[];
  effects: LogicNode[];
}

export interface UserVariable {
  id: string;
  name: string;
  type: "number" | "suit" | "rank" | "pokerhand" | "key" | "text";
  description?: string;
  initialValue?: number | string;
  initialSuit?: "Spades" | "Hearts" | "Diamonds" | "Clubs";
  initialRank?:
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7"
    | "8"
    | "9"
    | "10"
    | "Jack"
    | "Queen"
    | "King"
    | "Ace";
  initialPokerHand?: string;
  initialKey?: string;
  initialText?: string;
}

export interface BaseGameObject {
  id: string;
  objectType: string;
  objectKey: string;
  name: string;
  description: string;
  image: string;
  overlayImage?: string;
  hasUserUploadedImage?: boolean;
  placeholderCreditIndex?: number;
  orderValue: number;
  unlocked: boolean;
  discovered: boolean;
  rules?: Rule[];
  userVariables?: UserVariable[];
}

export interface UnlockProperty {
  category: string;
  property: string;
}

export interface CardAppearance {
  jud?: boolean;
  sou?: boolean;
  wra?: boolean;
  buf?: boolean;
  rif?: boolean;
  rta?: boolean;
  uta?: boolean;
}

export interface JokerData extends BaseGameObject {
  objectType: "joker";
  rarity: number | string;
  cost: number;
  blueprint_compat: boolean;
  eternal_compat: boolean;
  perishable_compat?: boolean;
  appears_in_shop: boolean;
  cardAppearance: CardAppearance;
  appearFlags?: string;
  pools?: string[];
  scale_w?: number;
  scale_h?: number;
  force_eternal?: boolean;
  force_perishable?: boolean;
  force_rental?: boolean;
  force_foil?: boolean;
  force_holographic?: boolean;
  force_polychrome?: boolean;
  force_negative?: boolean;
  ignoreSlotLimit?: boolean;
  info_queues?: string[];
  card_dependencies?: string[];
  unlockTrigger?: string;
  unlockOperator?: string;
  unlockCount?: number;
  unlockProperties?: UnlockProperty[];
  unlockDescription?: string;
  locVars?: { vars: string[] };
}

export interface ConsumableData extends BaseGameObject {
  objectType: "consumable";
  set: "Tarot" | "Planet" | "Spectral" | string;
  cost: number;
  hidden?: boolean;
  can_repeat_soul?: boolean;
}

export interface DeckData extends BaseGameObject {
  objectType: "deck";
  Config_consumables?: string[];
  Config_vouchers?: string[];
  no_collection?: boolean;
  no_interest?: boolean;
  no_faces?: boolean;
  erratic_deck?: boolean;
}

export interface VoucherData extends BaseGameObject {
  objectType: "voucher";
  cost: number;
  no_collection?: boolean;
  requires?: string;
  requires_activetor?: boolean;
  can_repeat_soul?: boolean;
  draw_shader_sprite?: string | false;
  unlockTrigger?: string;
  unlockOperator?: string;
  unlockCount?: number;
  unlockProperties?: UnlockProperty[];
  unlockDescription?: string;
}

export type BoosterType = "joker" | "consumable" | "playing_card" | "voucher";

export interface BoosterConfig {
  extra?: number;
  choose?: number;
}

export interface BoosterCardRule {
  weight: number;
  set?: string;
  suit?: string;
  rank?: string;
  pool?: string;
  rarity?: string;
  edition?: string;
  enhancement?: string;
  seal?: string;
  specific_type?: "consumable" | "joker" | "voucher" | null;
  specific_key?: string;
}

export interface BoosterData extends BaseGameObject {
  objectType: "booster";
  booster_type: BoosterType;
  cost: number;
  weight: number;
  draw_hand: boolean;
  instant_use: boolean;
  config: BoosterConfig;
  card_rules: BoosterCardRule[];
  group_key?: string;
  kind?: string;
  background_colour?: string;
  special_colour?: string;
  hidden?: boolean;
  atlas?: string;
  pos?: { x: number; y: number };
}

export interface EnhancementData extends BaseGameObject {
  objectType: "enhancement";
  weight: number;
  no_collection?: boolean;
  any_suit?: boolean;
  replace_base_card?: boolean;
  no_rank?: boolean;
  no_suit?: boolean;
  always_scores?: boolean;
  atlas?: string;
  pos?: { x: number; y: number };
}

export interface SealData extends BaseGameObject {
  objectType: "seal";
  badge_colour: string;
  no_collection?: boolean;
  sound?: string;
  pitch?: number;
  volume?: number;
  atlas?: string;
  pos?: { x: number; y: number };
}

export interface EditionData extends BaseGameObject {
  objectType: "edition";
  weight: number;
  shader?: string | false;
  extra_cost?: number;
  badge_colour?: string;
  sound?: string;
  pitch?: number;
  volume?: number;
  disable_shadow?: boolean;
  disable_base_shader?: boolean;
  in_shop?: boolean;
  no_collection?: boolean;
  apply_to_float?: boolean;
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
  shop_rate: number;
  collection_rows: number[];
  collection_name: string;
  default_card?: any;
}

export interface ModMetadata {
  id: string;
  name: string;
  display_name: string;
  description: string;
  author: string[];
  version: string;
  prefix: string;
  priority: number;
  main_file: string;
  disable_vanilla?: boolean;
  badge_colour: string;
  badge_text_colour: string;
  iconImage: string;
  gameImage: string;
  hasUserUploadedIcon: boolean;
  hasUserUploadedGameIcon: boolean;
  dependencies: string[];
  conflicts: string[];
  provides: string[];
}

export interface Mod {
  metadata: ModMetadata;
  jokers: JokerData[];
  consumables: ConsumableData[];
  decks: DeckData[];
  vouchers: VoucherData[];
  boosters: BoosterData[];
  enhancements: EnhancementData[];
  seals: SealData[];
  editions: EditionData[];
  sounds: SoundData[];
  rarities: RarityData[];
  consumableSets: ConsumableSetData[];
}

export interface UserSettings {
  darkMode: boolean;
  sidebarPinned: boolean;
  defaultAutoFormat: boolean;
  defaultGridSnap?: boolean;
}

export interface User {
  mods: Mod[];
  settings: UserSettings;
}
