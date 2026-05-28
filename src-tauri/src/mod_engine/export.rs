//! Input types that mirror the TypeScript `JokerData` interface and a mapper
//! that converts them into the canonical `balatro_codegen::types::JokerDef`.
//!
//! This module is the *single source of truth* for the `JokerData → JokerDef`
//! conversion. Previously this logic lived in the TypeScript `mapJokerToRustDef`
//! function; having it here means adding a new effect/variable type only requires
//! updating Rust, not both the TypeScript mapper and the Rust codegen.

use balatro_codegen::types::{
    AppearanceDef, AtlasPos, ConditionDef, ConditionGroupDef, ConsumableDef, ConsumableTypeDef,
    DeckDef, DisplaySize, EditionDef, EffectDef, EnhancementDef, JokerDef, LogicOp, LoopGroupDef,
    ParamValue, RandomGroupDef, RarityDef, RuleDef, SealDef, TypedValue, UnlockDef, UserVarType,
    UserVariableDef, VoucherDef,
};
use serde::de::Deserializer;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};

// ---------------------------------------------------------------------------
// Input types, match the TypeScript `JokerData` / `Rule` shapes exactly
// ---------------------------------------------------------------------------

/// Atlas position sent alongside joker data at export time.
#[derive(Debug, Clone, Deserialize)]
pub struct AtlasPosInput {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LocalizationEntryInput {
    pub language: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
}

/// Mirrors the TypeScript `JokerData` interface.
///
/// Fields use their original TypeScript names (mix of camelCase and snake_case)
/// via individual `#[serde(rename)]` attributes where needed.
#[derive(Debug, Deserialize)]
pub struct JokerDataInput {
    #[serde(rename = "objectKey")]
    pub object_key: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub localizations: Vec<LocalizationEntryInput>,
    pub cost: i32,
    /// Can be a number (1–4) or string ("common" | "uncommon" | "rare" | "legendary").
    pub rarity: Value,
    #[serde(default)]
    pub blueprint_compat: Option<bool>,
    #[serde(default)]
    pub eternal_compat: Option<bool>,
    #[serde(default)]
    pub perishable_compat: Option<bool>,
    #[serde(default)]
    pub unlocked: Option<bool>,
    #[serde(default)]
    pub discovered: Option<bool>,
    /// Scale width as a percentage (100 = 1×). Used to compute `display_size`.
    #[serde(default)]
    pub scale_w: Option<f64>,
    /// Scale height as a percentage (100 = 1×).
    #[serde(default)]
    pub scale_h: Option<f64>,
    #[serde(default)]
    pub rules: Vec<RuleInput>,
    #[serde(rename = "userVariables", default)]
    pub user_variables: Vec<UserVariableInput>,
    #[serde(default)]
    pub force_eternal: bool,
    #[serde(default)]
    pub force_perishable: bool,
    #[serde(default)]
    pub force_rental: bool,
    #[serde(default)]
    pub force_foil: bool,
    #[serde(default)]
    pub force_holographic: bool,
    #[serde(default)]
    pub force_polychrome: bool,
    #[serde(default)]
    pub force_negative: bool,
    #[serde(default, rename = "ignoreSlotLimit")]
    pub ignore_slot_limit: bool,
    #[serde(default)]
    pub info_queues: Vec<String>,
    #[serde(default)]
    pub pools: Vec<String>,
    #[serde(default)]
    pub appears_in_shop: Option<bool>,
    #[serde(default)]
    pub appear_flags: Option<String>,
    #[serde(default, rename = "unlockTrigger")]
    pub unlock_trigger: Option<String>,
    #[serde(default, rename = "unlockDescription")]
    pub unlock_description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConsumableDataInput {
    #[serde(rename = "objectKey")]
    pub object_key: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub localizations: Vec<LocalizationEntryInput>,
    pub set: String,
    #[serde(default)]
    pub cost: Option<i32>,
    #[serde(default)]
    pub unlocked: Option<bool>,
    #[serde(default)]
    pub discovered: Option<bool>,
    #[serde(default)]
    pub hidden: Option<bool>,
    #[serde(default)]
    pub can_repeat_soul: Option<bool>,
    #[serde(default)]
    pub rules: Vec<RuleInput>,
    #[serde(rename = "userVariables", default)]
    pub user_variables: Vec<UserVariableInput>,
    #[serde(default)]
    pub atlas: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EnhancementDataInput {
    #[serde(rename = "objectKey")]
    pub object_key: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub localizations: Vec<LocalizationEntryInput>,
    #[serde(default)]
    pub rules: Vec<RuleInput>,
    #[serde(rename = "userVariables", default)]
    pub user_variables: Vec<UserVariableInput>,
    #[serde(default)]
    pub any_suit: Option<bool>,
    #[serde(default)]
    pub replace_base_card: Option<bool>,
    #[serde(default)]
    pub no_rank: Option<bool>,
    #[serde(default)]
    pub no_suit: Option<bool>,
    #[serde(default)]
    pub always_scores: Option<bool>,
    #[serde(default)]
    pub unlocked: Option<bool>,
    #[serde(default)]
    pub discovered: Option<bool>,
    #[serde(default)]
    pub no_collection: Option<bool>,
    #[serde(default)]
    pub weight: Option<f64>,
    #[serde(default)]
    pub atlas: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SealDataInput {
    #[serde(rename = "objectKey")]
    pub object_key: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub localizations: Vec<LocalizationEntryInput>,
    #[serde(default)]
    pub rules: Vec<RuleInput>,
    #[serde(rename = "userVariables", default)]
    pub user_variables: Vec<UserVariableInput>,
    #[serde(default)]
    pub badge_colour: Option<String>,
    #[serde(default)]
    pub unlocked: Option<bool>,
    #[serde(default)]
    pub discovered: Option<bool>,
    #[serde(default)]
    pub no_collection: Option<bool>,
    #[serde(default)]
    pub sound: Option<String>,
    #[serde(default)]
    pub pitch: Option<f64>,
    #[serde(default)]
    pub volume: Option<f64>,
    #[serde(default)]
    pub atlas: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EditionDataInput {
    #[serde(rename = "objectKey")]
    pub object_key: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub localizations: Vec<LocalizationEntryInput>,
    #[serde(default)]
    pub rules: Vec<RuleInput>,
    #[serde(rename = "userVariables", default)]
    pub user_variables: Vec<UserVariableInput>,
    #[serde(default)]
    pub shader: Option<Value>,
    #[serde(default)]
    pub in_shop: Option<bool>,
    #[serde(default)]
    pub weight: Option<f64>,
    #[serde(default)]
    pub extra_cost: Option<i32>,
    #[serde(default)]
    pub apply_to_float: Option<bool>,
    #[serde(default)]
    pub badge_colour: Option<String>,
    #[serde(default)]
    pub sound: Option<String>,
    #[serde(default)]
    pub pitch: Option<f64>,
    #[serde(default)]
    pub volume: Option<f64>,
    #[serde(default)]
    pub disable_shadow: Option<bool>,
    #[serde(default)]
    pub disable_base_shader: Option<bool>,
    #[serde(default)]
    pub unlocked: Option<bool>,
    #[serde(default)]
    pub discovered: Option<bool>,
    #[serde(default)]
    pub no_collection: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct VoucherDataInput {
    #[serde(rename = "objectKey")]
    pub object_key: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub localizations: Vec<LocalizationEntryInput>,
    #[serde(default, rename = "unlockDescription")]
    pub unlock_description: Option<String>,
    #[serde(default)]
    pub cost: Option<i32>,
    #[serde(default)]
    pub unlocked: Option<bool>,
    #[serde(default)]
    pub discovered: Option<bool>,
    #[serde(default)]
    pub no_collection: Option<bool>,
    #[serde(default)]
    pub can_repeat_soul: Option<bool>,
    #[serde(default)]
    pub requires: Option<String>,
    #[serde(default)]
    pub rules: Vec<RuleInput>,
    #[serde(rename = "userVariables", default)]
    pub user_variables: Vec<UserVariableInput>,
    #[serde(default)]
    pub draw_shader_sprite: Option<Value>,
    #[serde(default)]
    pub atlas: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeckDataInput {
    #[serde(rename = "objectKey")]
    pub object_key: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub localizations: Vec<LocalizationEntryInput>,
    #[serde(default)]
    pub rules: Vec<RuleInput>,
    #[serde(rename = "userVariables", default)]
    pub user_variables: Vec<UserVariableInput>,
    #[serde(default)]
    pub unlocked: Option<bool>,
    #[serde(default)]
    pub discovered: Option<bool>,
    #[serde(default)]
    pub no_collection: Option<bool>,
    #[serde(default, rename = "Config_vouchers")]
    pub config_vouchers: Vec<String>,
    #[serde(default, rename = "Config_consumables")]
    pub config_consumables: Vec<String>,
    #[serde(default)]
    pub no_interest: bool,
    #[serde(default)]
    pub no_faces: bool,
    #[serde(default)]
    pub erratic_deck: bool,
    #[serde(default)]
    pub atlas: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RarityDataInput {
    pub key: String,
    pub name: String,
    pub badge_colour: String,
    #[serde(default)]
    pub default_weight: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct ConsumableSetDataInput {
    pub key: String,
    pub name: String,
    pub primary_colour: String,
    pub secondary_colour: String,
    #[serde(default)]
    pub shop_rate: Option<f64>,
    pub collection_rows: [i32; 2],
    pub collection_name: String,
    #[serde(default)]
    pub default_card: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundDataInput {
    pub key: String,
    pub sound_string: String,
    #[serde(default)]
    pub audio_bytes: Option<Vec<u8>>,
    #[serde(default)]
    pub volume: Option<f64>,
    #[serde(default)]
    pub pitch: Option<f64>,
    #[serde(default)]
    pub replace: Option<String>,
}

/// Mirrors the TypeScript `Rule` interface.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleInput {
    pub id: String,
    pub trigger: String,
    #[serde(default)]
    pub condition_groups: Vec<ConditionGroupInput>,
    #[serde(default)]
    pub effects: Vec<EffectInput>,
    #[serde(default)]
    pub random_groups: Vec<RandomGroupInput>,
    /// TypeScript field is `loops`: not `loopGroups`.
    #[serde(default)]
    pub loops: Vec<LoopGroupInput>,
}

/// Mirrors the TypeScript `ConditionGroup` interface.
#[derive(Debug, Deserialize)]
pub struct ConditionGroupInput {
    /// `"and"` | `"or"`
    pub operator: String,
    #[serde(default)]
    pub conditions: Vec<ConditionInput>,
}

/// Mirrors the TypeScript `Condition` interface.
#[derive(Debug, Deserialize)]
pub struct ConditionInput {
    #[serde(default)]
    pub id: String,
    #[serde(rename = "type")]
    pub condition_type: String,
    #[serde(default)]
    pub negate: bool,
    #[serde(default)]
    pub operator: Option<String>,
    #[serde(default)]
    pub params: HashMap<String, WrappedParamInput>,
}

/// Mirrors the TypeScript `Effect` interface.
#[derive(Debug, Deserialize)]
pub struct EffectInput {
    #[serde(default)]
    pub id: String,
    #[serde(rename = "type")]
    pub effect_type: String,
    #[serde(default)]
    pub params: HashMap<String, WrappedParamInput>,
}

/// Mirrors the TypeScript `RandomGroup` interface.
#[derive(Debug, Deserialize)]
pub struct RandomGroupInput {
    pub id: String,
    pub chance_numerator: WrappedParamInput,
    pub chance_denominator: WrappedParamInput,
    #[serde(default)]
    pub effects: Vec<EffectInput>,
}

/// Mirrors the TypeScript `LoopGroup` interface.
#[derive(Debug, Deserialize)]
pub struct LoopGroupInput {
    pub id: String,
    /// TypeScript field is `repetitions`.
    pub repetitions: WrappedParamInput,
    #[serde(default)]
    pub effects: Vec<EffectInput>,
}

/// A raw TypeScript param value: `{ value: T, valueType?: string }`.
///
/// The TypeScript frontend stores all effect/condition params in this
/// wrapped form. `valueType` is present only for dynamic values
/// (game variables, user variables, ranges: etc.).
#[derive(Debug)]
pub struct WrappedParamInput {
    pub value: Value,
    pub value_type: Option<String>,
}

impl<'de> Deserialize<'de> for WrappedParamInput {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum WrappedOrRaw {
            Wrapped {
                value: Value,
                #[serde(rename = "valueType", default)]
                value_type: Option<String>,
            },
            Raw(Value),
        }

        match WrappedOrRaw::deserialize(deserializer)? {
            WrappedOrRaw::Wrapped { value, value_type } => Ok(Self { value, value_type }),
            WrappedOrRaw::Raw(value) => Ok(Self {
                value,
                value_type: None,
            }),
        }
    }
}

/// Mirrors the TypeScript `UserVariable` interface.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserVariableInput {
    pub name: String,
    #[serde(rename = "type", default)]
    pub var_type: String,
    #[serde(default)]
    pub is_global: bool,
    #[serde(default)]
    pub is_persistent: bool,
    pub initial_value: Option<f64>,
    pub initial_suit: Option<String>,
    pub initial_rank: Option<String>,
    pub initial_poker_hand: Option<String>,
    pub initial_key: Option<String>,
    pub initial_text: Option<String>,
}

/// A joker entry for `batch_export_jokers`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchJokerEntry {
    pub joker_data: JokerDataInput,
    pub pos: AtlasPosInput,
    pub soul_pos: Option<AtlasPosInput>,
    /// Filename to write: e.g. `"j_my_joker.lua"`.
    pub file_name: String,
    /// Optional custom Lua code. When present, skip compilation and use this.
    #[serde(default)]
    pub custom_lua: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchConsumableEntry {
    pub consumable_data: ConsumableDataInput,
    pub pos: AtlasPosInput,
    #[serde(default)]
    pub soul_pos: Option<AtlasPosInput>,
    pub file_name: String,
    #[serde(default)]
    pub custom_lua: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchVoucherEntry {
    pub voucher_data: VoucherDataInput,
    pub pos: AtlasPosInput,
    #[serde(default)]
    pub soul_pos: Option<AtlasPosInput>,
    pub file_name: String,
    #[serde(default)]
    pub custom_lua: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDeckEntry {
    pub deck_data: DeckDataInput,
    pub pos: AtlasPosInput,
    pub file_name: String,
    #[serde(default)]
    pub custom_lua: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchEnhancementEntry {
    pub enhancement_data: EnhancementDataInput,
    pub pos: AtlasPosInput,
    pub file_name: String,
    #[serde(default)]
    pub custom_lua: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchSealEntry {
    pub seal_data: SealDataInput,
    pub pos: AtlasPosInput,
    pub file_name: String,
    #[serde(default)]
    pub custom_lua: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchEditionEntry {
    pub edition_data: EditionDataInput,
    pub file_name: String,
    #[serde(default)]
    pub custom_lua: Option<String>,
}

/// Mirrors the TypeScript `ModMetadata` interface for package export.
#[derive(Debug, Clone, Deserialize)]
pub struct ModMetadataInput {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub author: Vec<String>,
    pub description: String,
    pub prefix: String,
    pub main_file: String,
    pub version: String,
    pub priority: i64,
    pub badge_colour: String,
    pub badge_text_colour: String,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub conflicts: Vec<String>,
    #[serde(default)]
    pub provides: Vec<String>,
}

// ---------------------------------------------------------------------------
// Conversion, JokerDataInput → JokerDef
// ---------------------------------------------------------------------------

/// Convert raw `JokerDataInput` (from the TypeScript frontend) into a canonical
/// `JokerDef` suitable for `balatro_codegen::compile_joker_with_options`.
pub fn joker_data_to_def(
    input: &JokerDataInput,
    mod_prefix: &str,
    pos: AtlasPosInput,
    soul_pos: Option<AtlasPosInput>,
) -> JokerDef {
    let appearance = map_appearance(input);
    let unlock = map_unlock(input);

    JokerDef {
        key: input.object_key.clone(),
        name: input.name.clone(),
        description: split_description(&input.description),
        cost: input.cost,
        rarity: normalize_rarity(&input.rarity, mod_prefix),
        blueprint_compat: input.blueprint_compat.unwrap_or(false),
        eternal_compat: input.eternal_compat.unwrap_or(false),
        perishable_compat: input.perishable_compat.unwrap_or(true),
        unlocked: input.unlocked.unwrap_or(true),
        discovered: input.discovered.unwrap_or(true),
        atlas: "CustomJokers".to_string(),
        pos: AtlasPos { x: pos.x, y: pos.y },
        soul_pos: soul_pos.map(|sp| AtlasPos { x: sp.x, y: sp.y }),
        display_size: compute_display_size(input.scale_w, input.scale_h),
        rules: input.rules.iter().map(map_rule).collect(),
        appearance,
        unlock,
        user_variables: input.user_variables.iter().map(map_user_variable).collect(),
        force_eternal: input.force_eternal,
        force_perishable: input.force_perishable,
        force_rental: input.force_rental,
        force_foil: input.force_foil,
        force_holographic: input.force_holographic,
        force_polychrome: input.force_polychrome,
        force_negative: input.force_negative,
        ignore_slot_limit: input.ignore_slot_limit,
        info_queues: input.info_queues.clone(),
    }
}

pub fn consumable_data_to_def(
    input: &ConsumableDataInput,
    pos: AtlasPosInput,
    soul_pos: Option<AtlasPosInput>,
) -> ConsumableDef {
    ConsumableDef {
        key: input.object_key.clone(),
        name: input.name.clone(),
        description: split_description(&input.description),
        set: input.set.clone(),
        cost: input.cost,
        unlocked: input.unlocked,
        discovered: input.discovered,
        hidden: input.hidden,
        can_repeat_soul: input.can_repeat_soul,
        atlas: input
            .atlas
            .clone()
            .unwrap_or_else(|| "Consumables".to_string()),
        pos: AtlasPos { x: pos.x, y: pos.y },
        soul_pos: soul_pos.map(|sp| AtlasPos { x: sp.x, y: sp.y }),
        rules: input.rules.iter().map(map_rule).collect(),
        user_variables: input.user_variables.iter().map(map_user_variable).collect(),
    }
}

pub fn enhancement_data_to_def(input: &EnhancementDataInput, pos: AtlasPosInput) -> EnhancementDef {
    EnhancementDef {
        key: input.object_key.clone(),
        name: input.name.clone(),
        description: split_description(&input.description),
        atlas: input
            .atlas
            .clone()
            .unwrap_or_else(|| "CustomEnhancements".to_string()),
        pos: AtlasPos { x: pos.x, y: pos.y },
        rules: input.rules.iter().map(map_rule).collect(),
        user_variables: input.user_variables.iter().map(map_user_variable).collect(),
        any_suit: input.any_suit,
        replace_base_card: input.replace_base_card,
        no_rank: input.no_rank,
        no_suit: input.no_suit,
        always_scores: input.always_scores,
        unlocked: input.unlocked,
        discovered: input.discovered,
        no_collection: input.no_collection,
        weight: input.weight,
    }
}

pub fn seal_data_to_def(input: &SealDataInput, pos: AtlasPosInput) -> SealDef {
    SealDef {
        key: input.object_key.clone(),
        name: input.name.clone(),
        description: split_description(&input.description),
        atlas: input
            .atlas
            .clone()
            .unwrap_or_else(|| "CustomSeals".to_string()),
        pos: AtlasPos { x: pos.x, y: pos.y },
        rules: input.rules.iter().map(map_rule).collect(),
        user_variables: input.user_variables.iter().map(map_user_variable).collect(),
        badge_colour: input.badge_colour.clone(),
        unlocked: input.unlocked,
        discovered: input.discovered,
        no_collection: input.no_collection,
        sound: input
            .sound
            .clone()
            .unwrap_or_else(|| "gold_seal".to_string()),
        pitch: input.pitch,
        volume: input.volume,
    }
}

pub fn edition_data_to_def(input: &EditionDataInput) -> EditionDef {
    EditionDef {
        key: input.object_key.clone(),
        name: input.name.clone(),
        description: split_description(&input.description),
        rules: input.rules.iter().map(map_rule).collect(),
        user_variables: input.user_variables.iter().map(map_user_variable).collect(),
        shader: option_value_to_string(input.shader.as_ref()),
        in_shop: input.in_shop,
        weight: input.weight,
        extra_cost: input.extra_cost,
        apply_to_float: input.apply_to_float,
        badge_colour: input.badge_colour.clone(),
        sound: input.sound.clone(),
        pitch: input.pitch,
        volume: input.volume,
        disable_shadow: input.disable_shadow,
        disable_base_shader: input.disable_base_shader,
        unlocked: input.unlocked,
        discovered: input.discovered,
        no_collection: input.no_collection,
    }
}

pub fn voucher_data_to_def(
    input: &VoucherDataInput,
    pos: AtlasPosInput,
    soul_pos: Option<AtlasPosInput>,
) -> VoucherDef {
    VoucherDef {
        key: input.object_key.clone(),
        name: input.name.clone(),
        description: split_description(&input.description),
        unlock_description: split_description(input.unlock_description.as_deref().unwrap_or("")),
        cost: input.cost,
        unlocked: input.unlocked,
        discovered: input.discovered,
        no_collection: input.no_collection,
        can_repeat_soul: input.can_repeat_soul,
        requires: input.requires.clone(),
        atlas: input.atlas.clone().unwrap_or_else(|| "Voucher".to_string()),
        pos: AtlasPos { x: pos.x, y: pos.y },
        soul_pos: soul_pos.map(|sp| AtlasPos { x: sp.x, y: sp.y }),
        rules: input.rules.iter().map(map_rule).collect(),
        user_variables: input.user_variables.iter().map(map_user_variable).collect(),
        draw_shader_sprite: option_value_to_string(input.draw_shader_sprite.as_ref()),
    }
}

pub fn deck_data_to_def(input: &DeckDataInput, pos: AtlasPosInput) -> DeckDef {
    DeckDef {
        key: input.object_key.clone(),
        name: input.name.clone(),
        description: split_description(&input.description),
        atlas: input
            .atlas
            .clone()
            .unwrap_or_else(|| "Enhancers".to_string()),
        pos: AtlasPos { x: pos.x, y: pos.y },
        rules: input.rules.iter().map(map_rule).collect(),
        user_variables: input.user_variables.iter().map(map_user_variable).collect(),
        unlocked: input.unlocked,
        discovered: input.discovered,
        no_collection: input.no_collection,
        config_vouchers: input.config_vouchers.clone(),
        config_consumables: input.config_consumables.clone(),
        no_interest: input.no_interest,
        no_faces: input.no_faces,
        erratic_deck: input.erratic_deck,
    }
}

pub fn rarity_data_to_def(input: &RarityDataInput) -> RarityDef {
    RarityDef {
        key: input.key.trim().to_ascii_lowercase(),
        name: input.name.clone(),
        badge_colour: input.badge_colour.clone(),
        default_weight: input.default_weight.unwrap_or(1.0),
    }
}

pub fn consumable_set_data_to_def(input: &ConsumableSetDataInput) -> ConsumableTypeDef {
    ConsumableTypeDef {
        key: input.key.trim().to_ascii_lowercase(),
        name: input.name.clone(),
        collection_name: Some(input.collection_name.clone()),
        primary_colour: input.primary_colour.clone(),
        secondary_colour: input.secondary_colour.clone(),
        collection_rows: (input.collection_rows[0], input.collection_rows[1]),
        default_card: option_value_to_string(input.default_card.as_ref()),
        shop_rate: input.shop_rate,
    }
}

// ---------------------------------------------------------------------------
// Rule / condition / effect mappers
// ---------------------------------------------------------------------------

fn map_rule(rule: &RuleInput) -> RuleDef {
    let (retrigger, destroy) = compute_rule_flags(rule);

    RuleDef {
        id: rule.id.clone(),
        trigger: rule.trigger.clone(),
        retrigger,
        destroy,
        condition_groups: rule
            .condition_groups
            .iter()
            .map(map_condition_group)
            .collect(),
        effects: rule.effects.iter().map(map_effect).collect(),
        random_groups: rule.random_groups.iter().map(map_random_group).collect(),
        loop_groups: rule.loops.iter().map(map_loop_group).collect(),
    }
}

fn map_condition_group(cg: &ConditionGroupInput) -> ConditionGroupDef {
    ConditionGroupDef {
        logic_operator: if cg.operator.eq_ignore_ascii_case("or") {
            LogicOp::Or
        } else {
            LogicOp::And
        },
        conditions: cg.conditions.iter().map(map_condition).collect(),
    }
}

fn map_condition(c: &ConditionInput) -> ConditionDef {
    ConditionDef {
        id: c.id.clone(),
        condition_type: c.condition_type.clone(),
        negate: c.negate,
        operator: c.operator.as_deref().and_then(parse_logic_op),
        params: map_params(&c.params),
    }
}

fn map_effect(e: &EffectInput) -> EffectDef {
    EffectDef {
        id: e.id.clone(),
        effect_type: e.effect_type.clone(),
        params: map_params(&e.params),
    }
}

fn map_random_group(rg: &RandomGroupInput) -> RandomGroupDef {
    RandomGroupDef {
        id: rg.id.clone(),
        chance_numerator: wrapped_to_param(&rg.chance_numerator),
        chance_denominator: wrapped_to_param(&rg.chance_denominator),
        effects: rg.effects.iter().map(map_effect).collect(),
    }
}

fn map_loop_group(lg: &LoopGroupInput) -> LoopGroupDef {
    LoopGroupDef {
        id: lg.id.clone(),
        count: wrapped_to_param(&lg.repetitions),
        effects: lg.effects.iter().map(map_effect).collect(),
    }
}

fn map_params(params: &HashMap<String, WrappedParamInput>) -> HashMap<String, ParamValue> {
    params
        .iter()
        .map(|(k, v)| (k.clone(), wrapped_to_param(v)))
        .collect()
}

// ---------------------------------------------------------------------------
// User variable mapper
// ---------------------------------------------------------------------------

fn map_user_variable(v: &UserVariableInput) -> UserVariableDef {
    let var_type = match v.var_type.as_str() {
        "suit" => UserVarType::Suit,
        "rank" => UserVarType::Rank,
        "pokerhand" => UserVarType::PokerHand,
        "key" => UserVarType::Key,
        "text" => UserVarType::Text,
        _ => UserVarType::Number,
    };

    let initial_value = match v.var_type.as_str() {
        "suit" => ParamValue::Str(v.initial_suit.clone().unwrap_or_else(|| "Spades".into())),
        "rank" => ParamValue::Str(v.initial_rank.clone().unwrap_or_else(|| "Ace".into())),
        "pokerhand" => ParamValue::Str(
            v.initial_poker_hand
                .clone()
                .unwrap_or_else(|| "High Card".into()),
        ),
        "key" => ParamValue::Str(v.initial_key.clone().unwrap_or_else(|| "none".into())),
        "text" => ParamValue::Str(v.initial_text.clone().unwrap_or_default()),
        _ => ParamValue::Float(v.initial_value.unwrap_or(0.0)),
    };

    UserVariableDef {
        name: v.name.clone(),
        var_type,
        initial_value,
        is_global: v.is_global,
        is_persistent: v.is_persistent,
    }
}

pub fn map_user_variable_inputs(values: &[UserVariableInput]) -> Vec<UserVariableDef> {
    values.iter().map(map_user_variable).collect()
}

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/// Convert a `{ value: valueType? }` wrapped param into a `ParamValue`.
fn wrapped_to_param(w: &WrappedParamInput) -> ParamValue {
    if let Some(ref vt) = w.value_type {
        return ParamValue::Typed(TypedValue {
            value: w.value.clone(),
            value_type: vt.clone(),
        });
    }
    json_value_to_param(&w.value)
}

/// Convert a bare `serde_json::Value` to `ParamValue`.
fn json_value_to_param(v: &Value) -> ParamValue {
    match v {
        Value::Number(n) => n
            .as_i64()
            .map(ParamValue::Int)
            .unwrap_or_else(|| ParamValue::Float(n.as_f64().unwrap_or(0.0))),
        Value::Bool(b) => ParamValue::Bool(*b),
        Value::String(s) => ParamValue::Str(s.clone()),
        _ => ParamValue::Str(v.to_string()),
    }
}

fn option_value_to_string(v: Option<&Value>) -> Option<String> {
    match v {
        Some(Value::String(s)) => Some(s.clone()),
        _ => None,
    }
}

/// Map a rarity value that is either a number (1–4) or a string to the
/// canonical lowercase string used by `balatro_codegen`.
///
/// Custom rarity strings are normalized to include the mod prefix so the
/// generated joker rarity key matches the pool created by `SMODS.Rarity`.
fn normalize_rarity(rarity: &Value, mod_prefix: &str) -> String {
    match rarity {
        Value::String(s) => {
            let normalized = s.trim().to_ascii_lowercase();
            if normalized.is_empty() {
                return "common".to_string();
            }

            if is_vanilla_rarity_key(&normalized) {
                return normalized;
            }

            let prefix = mod_prefix.trim().to_ascii_lowercase();
            if prefix.is_empty() || normalized.starts_with(&format!("{}_", prefix)) {
                normalized
            } else {
                format!("{}_{}", prefix, normalized)
            }
        }
        Value::Number(n) => match n.as_u64().unwrap_or(1) {
            2 => "uncommon",
            3 => "rare",
            4 => "legendary",
            _ => "common",
        }
        .to_string(),
        _ => "common".to_string(),
    }
}

fn is_vanilla_rarity_key(value: &str) -> bool {
    matches!(value, "common" | "uncommon" | "rare" | "legendary")
}

/// Split an HTML-formatted description string into individual lines.
///
/// Mirrors the TypeScript `splitDescription` helper: replaces `<br>` variants
/// with newlines, trims each line: and filters empties. Falls back to
/// `["No description"]` if the result would be empty.
fn split_description(desc: &str) -> Vec<String> {
    // Handle common <br> variants case-insensitively without pulling in a regex dep
    let normalized = desc
        .replace("<br />", "\n")
        .replace("<br/>", "\n")
        .replace("<br>", "\n")
        .replace("<BR />", "\n")
        .replace("<BR/>", "\n")
        .replace("<BR>", "\n")
        .replace("[s]", "\n");

    let lines: Vec<String> = normalized
        .split('\n')
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    if lines.is_empty() {
        vec!["No description".to_string()]
    } else {
        lines
    }
}

/// Compute an optional `DisplaySize` from `scale_w` / `scale_h` percentage values.
///
/// Returns `None` when both are effectively 1× (within floating-point epsilon),
/// matching the TypeScript `getDisplaySizeOverride` behaviour.
fn compute_display_size(scale_w: Option<f64>, scale_h: Option<f64>) -> Option<DisplaySize> {
    let w = scale_w.map(|v| v / 100.0).unwrap_or(1.0);
    let h = scale_h.map(|v| v / 100.0).unwrap_or(1.0);
    if (w - 1.0).abs() < 0.0001 && (h - 1.0).abs() < 0.0001 {
        None
    } else {
        Some(DisplaySize { w, h })
    }
}

fn parse_logic_op(operator: &str) -> Option<LogicOp> {
    match operator.trim().to_ascii_lowercase().as_str() {
        "or" => Some(LogicOp::Or),
        "and" => Some(LogicOp::And),
        _ => None,
    }
}

fn compute_rule_flags(rule: &RuleInput) -> (bool, bool) {
    let mut retrigger = false;
    let mut destroy = false;

    for effect in &rule.effects {
        update_rule_flags_from_effect(&effect.effect_type, &mut retrigger, &mut destroy);
    }
    for group in &rule.random_groups {
        for effect in &group.effects {
            update_rule_flags_from_effect(&effect.effect_type, &mut retrigger, &mut destroy);
        }
    }
    for group in &rule.loops {
        for effect in &group.effects {
            update_rule_flags_from_effect(&effect.effect_type, &mut retrigger, &mut destroy);
        }
    }

    (retrigger, destroy)
}

fn update_rule_flags_from_effect(effect_type: &str, retrigger: &mut bool, destroy: &mut bool) {
    match effect_type {
        "retrigger_playing_card" | "retrigger_cards" | "retrigger" => {
            *retrigger = true;
        }
        "destroy_playing_card" | "destroy_card" => {
            *destroy = true;
        }
        _ => {}
    }
}

fn map_appearance(input: &JokerDataInput) -> Option<AppearanceDef> {
    let mut appears_in = input.pools.clone();
    let mut not_appears_in = Vec::new();
    let mut appear_flags = Vec::new();

    if input.appears_in_shop == Some(false) {
        not_appears_in.push("sho".to_string());
    }

    if let Some(flags) = &input.appear_flags {
        for flag in flags.split(',').map(str::trim).filter(|f| !f.is_empty()) {
            appear_flags.push(flag.to_string());
        }
    }

    appears_in.sort();
    appears_in.dedup();

    if appears_in.is_empty() && not_appears_in.is_empty() && appear_flags.is_empty() {
        None
    } else {
        Some(AppearanceDef {
            appears_in,
            not_appears_in,
            appear_flags,
        })
    }
}

fn map_unlock(input: &JokerDataInput) -> Option<UnlockDef> {
    let condition = input
        .unlock_trigger
        .as_ref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())?
        .to_string();

    let description = split_description(
        input
            .unlock_description
            .as_deref()
            .unwrap_or("Unlocked by default."),
    );

    Some(UnlockDef {
        condition,
        description,
    })
}

// ---------------------------------------------------------------------------
// Rust-side package text builders (entry.ts parity)
// ---------------------------------------------------------------------------

fn escape_lua_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\'', "\\'")
}

fn normalize_mod_prefixed_key(mod_prefix: &str, object_key: &str) -> String {
    let raw = object_key.trim();
    let prefix = mod_prefix.trim();
    if raw.is_empty() {
        return raw.to_string();
    }
    if prefix.is_empty() || raw.starts_with(&format!("{}_", prefix)) {
        return raw.to_string();
    }
    format!("{}_{}", prefix, raw)
}

fn normalize_class_prefixed_key(mod_prefix: &str, class_prefix: &str, object_key: &str) -> String {
    let raw = object_key.trim();
    let mod_prefix = mod_prefix.trim();
    let class_prefix = class_prefix.trim();
    if raw.is_empty() {
        return raw.to_string();
    }
    if class_prefix.is_empty() {
        return normalize_mod_prefixed_key(mod_prefix, raw);
    }

    let class_prefix_with_sep = format!("{}_", class_prefix);
    if let Some(rest) = raw.strip_prefix(&class_prefix_with_sep) {
        if mod_prefix.is_empty() || rest.starts_with(&format!("{}_", mod_prefix)) {
            return raw.to_string();
        }
        return format!("{}_{}_{}", class_prefix, mod_prefix, rest);
    }

    if mod_prefix.is_empty() {
        format!("{}_{}", class_prefix, raw)
    } else {
        format!("{}_{}_{}", class_prefix, mod_prefix, raw)
    }
}

fn build_lua_string_array(lines: &[String], indent_level: usize) -> String {
    if lines.is_empty() {
        return "{}".to_string();
    }

    let line_indent = "  ".repeat(indent_level + 1);
    let closing_indent = "  ".repeat(indent_level);
    let mut out = String::from("{\n");
    for (idx, line) in lines.iter().enumerate() {
        let escaped = escape_lua_string(line);
        out.push_str(&format!("{}[{}] = '{}'", line_indent, idx + 1, escaped));
        if idx + 1 != lines.len() {
            out.push_str(",\n");
        } else {
            out.push('\n');
        }
    }
    out.push_str(&format!("{}}}", closing_indent));
    out
}

fn split_optional_description(desc: Option<&str>) -> Option<Vec<String>> {
    let raw = desc.unwrap_or("").trim();
    if raw.is_empty() {
        None
    } else {
        Some(split_description(raw))
    }
}

#[derive(Clone)]
struct LocalizationDescriptionEntry {
    name: String,
    text: Vec<String>,
    unlock: Option<Vec<String>>,
}

type LocalizationSetMap = BTreeMap<String, LocalizationDescriptionEntry>;
type LocalizationDescriptions = BTreeMap<String, LocalizationSetMap>;
type LocalizationByLocale = BTreeMap<String, LocalizationDescriptions>;

fn insert_localization_entry(
    locales: &mut LocalizationByLocale,
    locale: &str,
    set: &str,
    key: &str,
    name: &str,
    text: &[String],
    unlock: Option<&Vec<String>>,
) {
    let locale_key = locale.trim();
    if locale_key.is_empty() {
        return;
    }

    let set_map = locales
        .entry(locale_key.to_string())
        .or_default()
        .entry(set.to_string())
        .or_default();

    set_map.insert(
        key.to_string(),
        LocalizationDescriptionEntry {
            name: name.to_string(),
            text: text.to_vec(),
            unlock: unlock.cloned(),
        },
    );
}

fn insert_item_localizations(
    locales: &mut LocalizationByLocale,
    base_locale: &str,
    set: &str,
    key: &str,
    base_name: &str,
    base_description: &str,
    base_unlock: Option<&str>,
    localizations: &[LocalizationEntryInput],
) {
    let base_text = split_description(base_description);
    let base_unlock_lines = split_optional_description(base_unlock);
    insert_localization_entry(
        locales,
        base_locale,
        set,
        key,
        base_name,
        &base_text,
        base_unlock_lines.as_ref(),
    );

    for localization in localizations {
        let locale = localization.language.trim();
        if locale.is_empty() {
            continue;
        }

        let localized_name = if localization.name.trim().is_empty() {
            base_name
        } else {
            localization.name.as_str()
        };
        let localized_description = if localization.description.trim().is_empty() {
            base_description
        } else {
            localization.description.as_str()
        };
        let localized_text = split_description(localized_description);

        insert_localization_entry(
            locales,
            locale,
            set,
            key,
            localized_name,
            &localized_text,
            base_unlock_lines.as_ref(),
        );
    }
}

fn render_localization_lua(descriptions: &LocalizationDescriptions) -> String {
    let mut out = String::from("return {\n  descriptions = {\n");

    let mut set_iter = descriptions.iter().peekable();
    while let Some((set, entries)) = set_iter.next() {
        out.push_str(&format!("    ['{}'] = {{\n", escape_lua_string(set)));

        let mut entry_iter = entries.iter().peekable();
        while let Some((key, entry)) = entry_iter.next() {
            out.push_str(&format!("      ['{}'] = {{\n", escape_lua_string(key)));
            out.push_str(&format!(
                "        name = '{}',\n",
                escape_lua_string(&entry.name)
            ));
            out.push_str(&format!(
                "        text = {}",
                build_lua_string_array(&entry.text, 4)
            ));

            if let Some(unlock) = &entry.unlock {
                out.push_str(&format!(",\n        unlock = {}", build_lua_string_array(unlock, 4)));
            }

            out.push_str("\n      }");
            if entry_iter.peek().is_some() {
                out.push_str(",\n");
            } else {
                out.push('\n');
            }
        }

        out.push_str("    }");
        if set_iter.peek().is_some() {
            out.push_str(",\n");
        } else {
            out.push('\n');
        }
    }

    out.push_str("  }\n}\n");
    out
}

pub fn build_localization_lua_files(
    mod_prefix: &str,
    base_locale: &str,
    jokers: &[BatchJokerEntry],
    consumables: &[BatchConsumableEntry],
    vouchers: &[BatchVoucherEntry],
    decks: &[BatchDeckEntry],
    enhancements: &[BatchEnhancementEntry],
    seals: &[BatchSealEntry],
    editions: &[BatchEditionEntry],
) -> BTreeMap<String, String> {
    let mut locales: LocalizationByLocale = BTreeMap::new();

    for entry in jokers {
        let data = &entry.joker_data;
        let key = normalize_class_prefixed_key(mod_prefix, "j", &data.object_key);
        insert_item_localizations(
            &mut locales,
            base_locale,
            "Joker",
            &key,
            &data.name,
            &data.description,
            data.unlock_description.as_deref(),
            &data.localizations,
        );
    }

    for entry in consumables {
        let data = &entry.consumable_data;
        let key = normalize_class_prefixed_key(mod_prefix, "c", &data.object_key);
        insert_item_localizations(
            &mut locales,
            base_locale,
            &data.set,
            &key,
            &data.name,
            &data.description,
            None,
            &data.localizations,
        );
    }

    for entry in vouchers {
        let data = &entry.voucher_data;
        let key = normalize_class_prefixed_key(mod_prefix, "v", &data.object_key);
        insert_item_localizations(
            &mut locales,
            base_locale,
            "Voucher",
            &key,
            &data.name,
            &data.description,
            data.unlock_description.as_deref(),
            &data.localizations,
        );
    }

    for entry in decks {
        let data = &entry.deck_data;
        let key = normalize_class_prefixed_key(mod_prefix, "b", &data.object_key);
        insert_item_localizations(
            &mut locales,
            base_locale,
            "Back",
            &key,
            &data.name,
            &data.description,
            None,
            &data.localizations,
        );
    }

    for entry in enhancements {
        let data = &entry.enhancement_data;
        let key = normalize_class_prefixed_key(mod_prefix, "m", &data.object_key);
        insert_item_localizations(
            &mut locales,
            base_locale,
            "Enhanced",
            &key,
            &data.name,
            &data.description,
            None,
            &data.localizations,
        );
    }

    for entry in seals {
        let data = &entry.seal_data;
        let normalized_key = normalize_mod_prefixed_key(mod_prefix, &data.object_key);
        let key = format!("{}_seal", normalized_key.to_ascii_lowercase());
        insert_item_localizations(
            &mut locales,
            base_locale,
            "Other",
            &key,
            &data.name,
            &data.description,
            None,
            &data.localizations,
        );
    }

    for entry in editions {
        let data = &entry.edition_data;
        let key = normalize_class_prefixed_key(mod_prefix, "e", &data.object_key);
        insert_item_localizations(
            &mut locales,
            base_locale,
            "Edition",
            &key,
            &data.name,
            &data.description,
            None,
            &data.localizations,
        );
    }

    locales
        .into_iter()
        .map(|(locale, descriptions)| (locale, render_localization_lua(&descriptions)))
        .collect()
}

fn param_value_to_lua_literal(value: &ParamValue) -> String {
    match value {
        ParamValue::Int(n) => n.to_string(),
        ParamValue::Float(n) => n.to_string(),
        ParamValue::Bool(b) => {
            if *b {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        ParamValue::Str(s) => format!("'{}'", escape_lua_string(s)),
        ParamValue::Typed(t) => {
            if let Some(n) = t.value.as_i64() {
                return n.to_string();
            }
            if let Some(n) = t.value.as_f64() {
                return n.to_string();
            }
            if let Some(b) = t.value.as_bool() {
                return if b { "true" } else { "false" }.to_string();
            }
            if let Some(s) = t.value.as_str() {
                return format!("'{}'", escape_lua_string(s));
            }
            "nil".to_string()
        }
    }
}

fn register_globals_from_input(
    vars: &[UserVariableInput],
    out: &mut BTreeMap<String, UserVariableDef>,
    persistent_only: bool,
) {
    for var in vars {
        if !var.is_global || var.name.trim().is_empty() {
            continue;
        }
        if persistent_only && !var.is_persistent {
            continue;
        }
        let normalized = var.name.trim().to_ascii_lowercase();
        out.entry(normalized)
            .or_insert_with(|| map_user_variable(var));
    }
}

pub fn collect_global_user_variables(
    jokers: &[BatchJokerEntry],
    consumables: &[BatchConsumableEntry],
    vouchers: &[BatchVoucherEntry],
    decks: &[BatchDeckEntry],
    enhancements: &[BatchEnhancementEntry],
    seals: &[BatchSealEntry],
    editions: &[BatchEditionEntry],
) -> Vec<UserVariableDef> {
    let mut by_name: BTreeMap<String, UserVariableDef> = BTreeMap::new();

    for entry in jokers {
        register_globals_from_input(&entry.joker_data.user_variables, &mut by_name, false);
    }
    for entry in consumables {
        register_globals_from_input(&entry.consumable_data.user_variables, &mut by_name, false);
    }
    for entry in vouchers {
        register_globals_from_input(&entry.voucher_data.user_variables, &mut by_name, false);
    }
    for entry in decks {
        register_globals_from_input(&entry.deck_data.user_variables, &mut by_name, false);
    }
    for entry in enhancements {
        register_globals_from_input(&entry.enhancement_data.user_variables, &mut by_name, false);
    }
    for entry in seals {
        register_globals_from_input(&entry.seal_data.user_variables, &mut by_name, false);
    }
    for entry in editions {
        register_globals_from_input(&entry.edition_data.user_variables, &mut by_name, false);
    }

    by_name.into_values().collect()
}

pub fn collect_persistent_global_user_variables(
    jokers: &[BatchJokerEntry],
    consumables: &[BatchConsumableEntry],
    vouchers: &[BatchVoucherEntry],
    decks: &[BatchDeckEntry],
    enhancements: &[BatchEnhancementEntry],
    seals: &[BatchSealEntry],
    editions: &[BatchEditionEntry],
) -> Vec<UserVariableDef> {
    let mut by_name: BTreeMap<String, UserVariableDef> = BTreeMap::new();

    for entry in jokers {
        register_globals_from_input(&entry.joker_data.user_variables, &mut by_name, true);
    }
    for entry in consumables {
        register_globals_from_input(&entry.consumable_data.user_variables, &mut by_name, true);
    }
    for entry in vouchers {
        register_globals_from_input(&entry.voucher_data.user_variables, &mut by_name, true);
    }
    for entry in decks {
        register_globals_from_input(&entry.deck_data.user_variables, &mut by_name, true);
    }
    for entry in enhancements {
        register_globals_from_input(&entry.enhancement_data.user_variables, &mut by_name, true);
    }
    for entry in seals {
        register_globals_from_input(&entry.seal_data.user_variables, &mut by_name, true);
    }
    for entry in editions {
        register_globals_from_input(&entry.edition_data.user_variables, &mut by_name, true);
    }

    by_name.into_values().collect()
}

pub fn collect_run_scoped_global_user_variables(
    jokers: &[BatchJokerEntry],
    consumables: &[BatchConsumableEntry],
    vouchers: &[BatchVoucherEntry],
    decks: &[BatchDeckEntry],
    enhancements: &[BatchEnhancementEntry],
    seals: &[BatchSealEntry],
    editions: &[BatchEditionEntry],
) -> Vec<UserVariableDef> {
    let mut by_name: BTreeMap<String, UserVariableDef> = BTreeMap::new();

    let mut register_run_scoped = |vars: &[UserVariableInput]| {
        for var in vars {
            if !var.is_global || var.is_persistent || var.name.trim().is_empty() {
                continue;
            }
            let normalized = var.name.trim().to_ascii_lowercase();
            by_name
                .entry(normalized)
                .or_insert_with(|| map_user_variable(var));
        }
    };

    for entry in jokers {
        register_run_scoped(&entry.joker_data.user_variables);
    }
    for entry in consumables {
        register_run_scoped(&entry.consumable_data.user_variables);
    }
    for entry in vouchers {
        register_run_scoped(&entry.voucher_data.user_variables);
    }
    for entry in decks {
        register_run_scoped(&entry.deck_data.user_variables);
    }
    for entry in enhancements {
        register_run_scoped(&entry.enhancement_data.user_variables);
    }
    for entry in seals {
        register_run_scoped(&entry.seal_data.user_variables);
    }
    for entry in editions {
        register_run_scoped(&entry.edition_data.user_variables);
    }

    by_name.into_values().collect()
}

pub fn build_globals_lua(global_vars: &[UserVariableDef]) -> String {
    if global_vars.is_empty() {
        return "return {}\n".to_string();
    }

    let mut lines = Vec::new();
    for var in global_vars {
        lines.push(format!(
            "  ['{}'] = {}",
            escape_lua_string(&var.name),
            param_value_to_lua_literal(&var.initial_value)
        ));
    }

    format!("return {{\n{}\n}}\n", lines.join(",\n"))
}

pub fn build_main_lua(
    jokers: &[BatchJokerEntry],
    consumables: &[BatchConsumableEntry],
    vouchers: &[BatchVoucherEntry],
    decks: &[BatchDeckEntry],
    enhancements: &[BatchEnhancementEntry],
    seals: &[BatchSealEntry],
    editions: &[BatchEditionEntry],
    load_rarities: bool,
    load_consumable_sets: bool,
    load_sounds: bool,
    load_globals: bool,
    run_scoped_globals: &[UserVariableDef],
) -> String {
    let mut sorted_jokers: Vec<&BatchJokerEntry> = jokers.iter().collect();
    sorted_jokers.sort_by(|a, b| a.joker_data.object_key.cmp(&b.joker_data.object_key));

    let mut sorted_consumables: Vec<&BatchConsumableEntry> = consumables.iter().collect();
    sorted_consumables.sort_by(|a, b| {
        a.consumable_data
            .object_key
            .cmp(&b.consumable_data.object_key)
    });

    let mut sorted_vouchers: Vec<&BatchVoucherEntry> = vouchers.iter().collect();
    sorted_vouchers.sort_by(|a, b| a.voucher_data.object_key.cmp(&b.voucher_data.object_key));

    let mut sorted_decks: Vec<&BatchDeckEntry> = decks.iter().collect();
    sorted_decks.sort_by(|a, b| a.deck_data.object_key.cmp(&b.deck_data.object_key));

    let mut sorted_enhancements: Vec<&BatchEnhancementEntry> = enhancements.iter().collect();
    sorted_enhancements.sort_by(|a, b| {
        a.enhancement_data
            .object_key
            .cmp(&b.enhancement_data.object_key)
    });

    let mut sorted_seals: Vec<&BatchSealEntry> = seals.iter().collect();
    sorted_seals.sort_by(|a, b| a.seal_data.object_key.cmp(&b.seal_data.object_key));

    let mut sorted_editions: Vec<&BatchEditionEntry> = editions.iter().collect();
    sorted_editions.sort_by(|a, b| a.edition_data.object_key.cmp(&b.edition_data.object_key));

    let mut atlas_decls = String::new();
    if !sorted_jokers.is_empty() {
        atlas_decls.push_str("SMODS.Atlas({\n    key = \"CustomJokers\",\n    path = \"CustomJokers.png\",\n    px = 71,\n    py = 95,\n    atlas_table = \"ASSET_ATLAS\"\n})\n\n");
    }
    if !sorted_consumables.is_empty() {
        atlas_decls.push_str("SMODS.Atlas({\n    key = \"CustomConsumables\",\n    path = \"CustomConsumables.png\",\n    px = 71,\n    py = 95,\n    atlas_table = \"ASSET_ATLAS\"\n})\n\n");
    }
    if !sorted_enhancements.is_empty() {
        atlas_decls.push_str("SMODS.Atlas({\n    key = \"CustomEnhancements\",\n    path = \"CustomEnhancements.png\",\n    px = 71,\n    py = 95,\n    atlas_table = \"ASSET_ATLAS\"\n})\n\n");
    }
    if !sorted_seals.is_empty() {
        atlas_decls.push_str("SMODS.Atlas({\n    key = \"CustomSeals\",\n    path = \"CustomSeals.png\",\n    px = 71,\n    py = 95,\n    atlas_table = \"ASSET_ATLAS\"\n}):register()\n\n");
    }
    if !sorted_vouchers.is_empty() {
        atlas_decls.push_str("SMODS.Atlas({\n    key = \"CustomVouchers\",\n    path = \"CustomVouchers.png\",\n    px = 71,\n    py = 95,\n    atlas_table = \"ASSET_ATLAS\"\n})\n\n");
    }
    if !sorted_decks.is_empty() {
        atlas_decls.push_str("SMODS.Atlas({\n    key = \"CustomDecks\",\n    path = \"CustomDecks.png\",\n    px = 71,\n    py = 95,\n    atlas_table = \"ASSET_ATLAS\"\n})\n\n");
    }

    let mut requires = String::new();
    if load_rarities {
        requires.push_str("assert(SMODS.load_file(\"rarities.lua\"))()\n");
    }
    if load_consumable_sets {
        requires.push_str("assert(SMODS.load_file(\"consumables/sets.lua\"))()\n");
    }
    if load_sounds {
        requires.push_str("assert(SMODS.load_file(\"sounds.lua\"))()\n");
    }
    for j in &sorted_jokers {
        requires.push_str(&format!(
            "assert(SMODS.load_file(\"jokers/{}\"))()\n",
            j.file_name
        ));
    }
    for c in &sorted_consumables {
        requires.push_str(&format!(
            "assert(SMODS.load_file(\"consumables/{}\"))()\n",
            c.file_name
        ));
    }
    for e in &sorted_enhancements {
        requires.push_str(&format!(
            "assert(SMODS.load_file(\"enhancements/{}\"))()\n",
            e.file_name
        ));
    }
    for s in &sorted_seals {
        requires.push_str(&format!(
            "assert(SMODS.load_file(\"seals/{}\"))()\n",
            s.file_name
        ));
    }
    for ed in &sorted_editions {
        requires.push_str(&format!(
            "assert(SMODS.load_file(\"editions/{}\"))()\n",
            ed.file_name
        ));
    }
    for v in &sorted_vouchers {
        requires.push_str(&format!(
            "assert(SMODS.load_file(\"vouchers/{}\"))()\n",
            v.file_name
        ));
    }
    for d in &sorted_decks {
        requires.push_str(&format!(
            "assert(SMODS.load_file(\"decks/{}\"))()\n",
            d.file_name
        ));
    }

    let globals_load = if load_globals {
        "local jf_global_defaults = assert(SMODS.load_file(\"globals.lua\"))()\n\
local jf_profile = (G.PROFILES and G.SETTINGS and G.SETTINGS.profile and G.PROFILES[G.SETTINGS.profile]) or nil\n\
if jf_profile then\n\
    jf_profile.jf_global_vars = jf_profile.jf_global_vars or {}\n\
    local jf_profile_globals = jf_profile.jf_global_vars\n\
    local jf_defaults_applied = false\n\
    for k, v in pairs(jf_global_defaults or {}) do\n\
        if jf_profile_globals[k] == nil then\n\
            jf_profile_globals[k] = v\n\
            jf_defaults_applied = true\n\
        end\n\
    end\n\
    if jf_defaults_applied and G and G.save_progress then\n\
        G:save_progress()\n\
    end\n\
    JF_GLOBALS = setmetatable({}, {\n\
        __index = jf_profile_globals,\n\
        __newindex = function(_, key, value)\n\
            jf_profile_globals[key] = value\n\
            if G and G.save_progress then\n\
                G:save_progress()\n\
            end\n\
        end,\n\
    })\n\
else\n\
    JF_GLOBALS = JF_GLOBALS or {}\n\
    for k, v in pairs(jf_global_defaults or {}) do\n\
        if JF_GLOBALS[k] == nil then\n\
            JF_GLOBALS[k] = v\n\
        end\n\
    end\n\
end\n"
    } else {
        "JF_GLOBALS = JF_GLOBALS or {}\n"
    };

    let run_scoped_global_reset = if run_scoped_globals.is_empty() {
        String::new()
    } else {
        let mut assignments = String::new();
        for variable in run_scoped_globals {
            assignments.push_str(&format!(
                "    jf_run_globals['{}'] = {}\n",
                escape_lua_string(&variable.name),
                param_value_to_lua_literal(&variable.initial_value)
            ));
        }
        format!(
            "SMODS.current_mod = SMODS.current_mod or {{}}\n\
SMODS.current_mod.reset_game_globals = function(run_start)\n\
    if not G or not G.GAME then return end\n\
    G.GAME.jf_global_vars = G.GAME.jf_global_vars or {{}}\n\
    local jf_run_globals = G.GAME.jf_global_vars\n\
{}end\n",
            assignments
        )
    };

    format!(
        "{}local NFS = require(\"nativefs\")\nto_big = to_big or function(a) return a end\nlenient_bignum = lenient_bignum or function(a) return a end\n{}\n{}{}\n",
        atlas_decls, globals_load, run_scoped_global_reset, requires
    )
}

pub fn build_sounds_lua(sounds: &[SoundDataInput]) -> String {
    let mut sorted_sounds: Vec<&SoundDataInput> = sounds.iter().collect();
    sorted_sounds.sort_by(|a, b| a.key.trim().to_ascii_lowercase().cmp(&b.key.trim().to_ascii_lowercase()));

    let mut lines: Vec<String> = Vec::new();
    for sound in sorted_sounds {
        let key = sound.key.trim();
        if key.is_empty() {
            continue;
        }
        let path = sound.sound_string.trim();
        if path.is_empty() {
            continue;
        }
        let mut block = vec![
            "SMODS.Sound({".to_string(),
            format!("    key = '{}',", escape_lua_string(key)),
            format!("    path = '{}',", escape_lua_string(&format!("sounds/{}", path))),
            format!("    pitch = {},", sound.pitch.unwrap_or(1.0)),
            format!("    volume = {},", sound.volume.unwrap_or(1.0)),
        ];
        if let Some(replace) = sound.replace.as_deref() {
            let replace = replace.trim();
            if !replace.is_empty() {
                block.push(format!("    replace = '{}',", escape_lua_string(replace)));
            }
        }
        block.push("})".to_string());
        lines.push(block.join("\n"));
    }

    lines.join("\n\n")
}

#[derive(Serialize)]
struct ModJsonPayload<'a> {
    id: &'a str,
    name: &'a str,
    display_name: &'a str,
    author: &'a [String],
    description: &'a str,
    prefix: &'a str,
    main_file: &'a str,
    version: &'a str,
    priority: i64,
    badge_colour: &'a str,
    badge_text_colour: &'a str,
    dependencies: &'a [String],
    conflicts: &'a [String],
    provides: &'a [String],
}

pub fn build_mod_json(metadata: &ModMetadataInput) -> Result<String, String> {
    let payload = ModJsonPayload {
        id: &metadata.id,
        name: &metadata.name,
        display_name: &metadata.display_name,
        author: &metadata.author,
        description: &metadata.description,
        prefix: &metadata.prefix,
        main_file: &metadata.main_file,
        version: &metadata.version,
        priority: metadata.priority,
        badge_colour: &metadata.badge_colour,
        badge_text_colour: &metadata.badge_text_colour,
        dependencies: &metadata.dependencies,
        conflicts: &metadata.conflicts,
        provides: &metadata.provides,
    };

    serde_json::to_string_pretty(&payload)
        .map_err(|e| format!("Failed to serialize mod metadata: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_global_var(name: &str, is_persistent: bool) -> UserVariableInput {
        UserVariableInput {
            name: name.to_string(),
            var_type: "number".to_string(),
            is_global: true,
            is_persistent,
            initial_value: Some(1.0),
            initial_suit: None,
            initial_rank: None,
            initial_poker_hand: None,
            initial_key: None,
            initial_text: None,
        }
    }

    fn make_joker_entry(vars: Vec<UserVariableInput>) -> BatchJokerEntry {
        BatchJokerEntry {
            joker_data: JokerDataInput {
                object_key: "j_test".to_string(),
                name: "Test Joker".to_string(),
                description: "Test".to_string(),
                localizations: vec![],
                cost: 4,
                rarity: serde_json::json!("common"),
                blueprint_compat: Some(true),
                eternal_compat: Some(true),
                perishable_compat: Some(true),
                unlocked: Some(true),
                discovered: Some(true),
                scale_w: None,
                scale_h: None,
                rules: vec![],
                user_variables: vars,
                force_eternal: false,
                force_perishable: false,
                force_rental: false,
                force_foil: false,
                force_holographic: false,
                force_polychrome: false,
                force_negative: false,
                ignore_slot_limit: false,
                info_queues: vec![],
                pools: vec![],
                appears_in_shop: Some(true),
                appear_flags: None,
                unlock_trigger: None,
                unlock_description: None,
            },
            pos: AtlasPosInput { x: 0, y: 0 },
            soul_pos: None,
            file_name: "j_test.lua".to_string(),
            custom_lua: None,
        }
    }

    #[test]
    fn wrapped_param_input_accepts_wrapped_shape() {
        let parsed: WrappedParamInput =
            serde_json::from_str(r#"{"value": 7, "valueType": "number"}"#)
                .expect("wrapped param should deserialize");

        assert_eq!(parsed.value, serde_json::json!(7));
        assert_eq!(parsed.value_type.as_deref(), Some("number"));
    }

    #[test]
    fn wrapped_param_input_accepts_raw_number_shape() {
        let parsed: WrappedParamInput =
            serde_json::from_str("12").expect("raw number param should deserialize");

        assert_eq!(parsed.value, serde_json::json!(12));
        assert_eq!(parsed.value_type, None);
    }

    #[test]
    fn wrapped_param_input_accepts_raw_string_shape() {
        let parsed: WrappedParamInput =
            serde_json::from_str(r#""hello""#).expect("raw string param should deserialize");

        assert_eq!(parsed.value, serde_json::json!("hello"));
        assert_eq!(parsed.value_type, None);
    }

    #[test]
    fn mixed_wrapped_and_raw_params_map_correctly() {
        let effect: EffectInput = serde_json::from_value(serde_json::json!({
            "type": "add_chips",
            "params": {
                "raw_num": 5,
                "wrapped_num": { "value": 10 },
                "wrapped_typed": { "value": "$money", "valueType": "game_variable" }
            }
        }))
        .expect("effect should deserialize with mixed param shapes");

        let mapped = map_params(&effect.params);

        match mapped.get("raw_num") {
            Some(ParamValue::Int(5)) => {}
            other => panic!("expected raw_num Int(5), got {other:?}"),
        }

        match mapped.get("wrapped_num") {
            Some(ParamValue::Int(10)) => {}
            other => panic!("expected wrapped_num Int(10), got {other:?}"),
        }

        match mapped.get("wrapped_typed") {
            Some(ParamValue::Typed(tv)) => {
                assert_eq!(tv.value, serde_json::json!("$money"));
                assert_eq!(tv.value_type, "game_variable");
            }
            other => panic!("expected wrapped_typed Typed(...), got {other:?}"),
        }
    }

    #[test]
    fn normalize_rarity_preserves_vanilla_string_rarity() {
        let rarity = normalize_rarity(&serde_json::json!("rare"), "jkr");
        assert_eq!(rarity, "rare");
    }

    #[test]
    fn normalize_rarity_prefixes_custom_rarity() {
        let rarity = normalize_rarity(&serde_json::json!("superrare"), "jkr");
        assert_eq!(rarity, "jkr_superrare");
    }

    #[test]
    fn normalize_rarity_does_not_double_prefix_custom_rarity() {
        let rarity = normalize_rarity(&serde_json::json!("jkr_superrare"), "jkr");
        assert_eq!(rarity, "jkr_superrare");
    }

    #[test]
    fn collect_global_user_variables_includes_non_persistent_globals() {
        let jokers = vec![
            make_joker_entry(vec![make_global_var("global_non_persistent", false)]),
            make_joker_entry(vec![make_global_var("global_persistent", true)]),
        ];

        let globals = collect_global_user_variables(&jokers, &[], &[], &[], &[], &[], &[]);

        let names: Vec<&str> = globals.iter().map(|value| value.name.as_str()).collect();
        assert!(names.contains(&"global_non_persistent"));
        assert!(names.contains(&"global_persistent"));
    }

    #[test]
    fn collect_persistent_global_user_variables_filters_non_persistent() {
        let jokers = vec![
            make_joker_entry(vec![make_global_var("global_non_persistent", false)]),
            make_joker_entry(vec![make_global_var("global_persistent", true)]),
        ];

        let globals =
            collect_persistent_global_user_variables(&jokers, &[], &[], &[], &[], &[], &[]);

        let names: Vec<&str> = globals.iter().map(|value| value.name.as_str()).collect();
        assert!(!names.contains(&"global_non_persistent"));
        assert!(names.contains(&"global_persistent"));
    }

    #[test]
    fn collect_run_scoped_global_user_variables_only_includes_non_persistent() {
        let jokers = vec![
            make_joker_entry(vec![make_global_var("global_non_persistent", false)]),
            make_joker_entry(vec![make_global_var("global_persistent", true)]),
        ];

        let globals =
            collect_run_scoped_global_user_variables(&jokers, &[], &[], &[], &[], &[], &[]);

        let names: Vec<&str> = globals.iter().map(|value| value.name.as_str()).collect();
        assert!(names.contains(&"global_non_persistent"));
        assert!(!names.contains(&"global_persistent"));
    }

    #[test]
    fn build_main_lua_registers_reset_game_globals_for_run_scoped_globals() {
        let run_scoped = vec![UserVariableDef {
            name: "global_non_persistent".to_string(),
            var_type: UserVarType::Number,
            initial_value: ParamValue::Int(7),
            is_global: true,
            is_persistent: false,
        }];

        let lua = build_main_lua(
            &[],
            &[],
            &[],
            &[],
            &[],
            &[],
            &[],
            false,
            false,
            false,
            false,
            &run_scoped,
        );

        assert!(lua.contains("SMODS.current_mod.reset_game_globals = function(run_start)"));
        assert!(lua.contains("G.GAME.jf_global_vars = G.GAME.jf_global_vars or {}"));
        assert!(lua.contains("jf_run_globals['global_non_persistent'] = 7"));
    }
}
