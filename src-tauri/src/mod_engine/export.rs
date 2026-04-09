//! Input types that mirror the TypeScript `JokerData` interface and a mapper
//! that converts them into the canonical `balatro_codegen::types::JokerDef`.
//!
//! This module is the *single source of truth* for the `JokerData → JokerDef`
//! conversion. Previously this logic lived in the TypeScript `mapJokerToRustDef`
//! function; having it here means adding a new effect/variable type only requires
//! updating Rust, not both the TypeScript mapper and the Rust codegen.

use balatro_codegen::types::{
    AppearanceDef, AtlasPos, ConditionDef, ConditionGroupDef, ConsumableDef, DeckDef, DisplaySize,
    EditionDef, EffectDef, EnhancementDef, JokerDef, LogicOp, LoopGroupDef, ParamValue,
    RandomGroupDef, RuleDef, SealDef, TypedValue, UnlockDef, UserVarType, UserVariableDef,
    VoucherDef,
};
use serde::de::Deserializer;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Input types, match the TypeScript `JokerData` / `Rule` shapes exactly
// ---------------------------------------------------------------------------

/// Atlas position sent alongside joker data at export time.
#[derive(Debug, Clone, Deserialize)]
pub struct AtlasPosInput {
    pub x: i32,
    pub y: i32,
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
        rarity: normalize_rarity(&input.rarity),
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
        atlas: input.atlas.clone().unwrap_or_else(|| "centers".to_string()),
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
        atlas: input.atlas.clone().unwrap_or_else(|| "centers".to_string()),
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
        condition_type: c.condition_type.clone(),
        negate: c.negate,
        operator: c.operator.as_deref().and_then(parse_logic_op),
        params: map_params(&c.params),
    }
}

fn map_effect(e: &EffectInput) -> EffectDef {
    EffectDef {
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
    }
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
fn normalize_rarity(rarity: &Value) -> String {
    match rarity {
        Value::String(s) => s.to_lowercase(),
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

fn normalize_joker_loc_key(prefix: &str, object_key: &str) -> String {
    let raw = object_key.strip_prefix("j_").unwrap_or(object_key);
    format!("j_{}_{}", prefix, raw)
}

fn build_lua_string_array(lines: &[String]) -> String {
    if lines.is_empty() {
        return "{}".to_string();
    }

    let mut out = String::from("{\n");
    for (idx, line) in lines.iter().enumerate() {
        let escaped = escape_lua_string(line);
        out.push_str(&format!("        [{}] = '{}'", idx + 1, escaped));
        if idx + 1 != lines.len() {
            out.push_str(",\n");
        }
    }
    out.push_str("\n      }");
    out
}

pub fn build_localization_lua(mod_prefix: &str, jokers: &[BatchJokerEntry]) -> String {
    let mut sorted: Vec<&BatchJokerEntry> = jokers.iter().collect();
    sorted.sort_by(|a, b| a.joker_data.object_key.cmp(&b.joker_data.object_key));

    let mut entries = Vec::new();
    for entry in sorted {
        let data = &entry.joker_data;
        let key = normalize_joker_loc_key(mod_prefix, &data.object_key);
        let text = split_description(&data.description);
        let unlock_text = split_description(data.unlock_description.as_deref().unwrap_or(""));

        let mut block = format!(
            "    {} = {{\n      name = '{}',\n      text = {}",
            key,
            escape_lua_string(&data.name),
            build_lua_string_array(&text)
        );

        if !unlock_text.is_empty() {
            block.push_str(&format!(
                ",\n      unlock = {}",
                build_lua_string_array(&unlock_text)
            ));
        }
        block.push_str("\n    }");
        entries.push(block);
    }

    format!(
        "return {{\n  descriptions = {{\n    Joker = {{\n{}\n    }}\n  }}\n}}\n",
        entries.join(",\n")
    )
}

pub fn build_main_lua(
    jokers: &[BatchJokerEntry],
    consumables: &[BatchConsumableEntry],
    vouchers: &[BatchVoucherEntry],
    decks: &[BatchDeckEntry],
    enhancements: &[BatchEnhancementEntry],
    seals: &[BatchSealEntry],
    editions: &[BatchEditionEntry],
) -> String {
    let mut sorted_jokers: Vec<&BatchJokerEntry> = jokers.iter().collect();
    sorted_jokers.sort_by(|a, b| a.joker_data.object_key.cmp(&b.joker_data.object_key));

    let mut sorted_consumables: Vec<&BatchConsumableEntry> = consumables.iter().collect();
    sorted_consumables.sort_by(|a, b| a.consumable_data.object_key.cmp(&b.consumable_data.object_key));

    let mut sorted_vouchers: Vec<&BatchVoucherEntry> = vouchers.iter().collect();
    sorted_vouchers.sort_by(|a, b| a.voucher_data.object_key.cmp(&b.voucher_data.object_key));

    let mut sorted_decks: Vec<&BatchDeckEntry> = decks.iter().collect();
    sorted_decks.sort_by(|a, b| a.deck_data.object_key.cmp(&b.deck_data.object_key));

    let mut sorted_enhancements: Vec<&BatchEnhancementEntry> = enhancements.iter().collect();
    sorted_enhancements.sort_by(|a, b| a.enhancement_data.object_key.cmp(&b.enhancement_data.object_key));

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
    for j in &sorted_jokers {
        requires.push_str(&format!("assert(SMODS.load_file(\"jokers/{}\"))()\n", j.file_name));
    }
    for c in &sorted_consumables {
        requires.push_str(&format!("assert(SMODS.load_file(\"consumables/{}\"))()\n", c.file_name));
    }
    for e in &sorted_enhancements {
        requires.push_str(&format!("assert(SMODS.load_file(\"enhancements/{}\"))()\n", e.file_name));
    }
    for s in &sorted_seals {
        requires.push_str(&format!("assert(SMODS.load_file(\"seals/{}\"))()\n", s.file_name));
    }
    for ed in &sorted_editions {
        requires.push_str(&format!("assert(SMODS.load_file(\"editions/{}\"))()\n", ed.file_name));
    }
    for v in &sorted_vouchers {
        requires.push_str(&format!("assert(SMODS.load_file(\"vouchers/{}\"))()\n", v.file_name));
    }
    for d in &sorted_decks {
        requires.push_str(&format!("assert(SMODS.load_file(\"decks/{}\"))()\n", d.file_name));
    }

    format!(
        "{}local NFS = require(\"nativefs\")\nto_big = to_big or function(a) return a end\nlenient_bignum = lenient_bignum or function(a) return a end\n\n{}\n",
        atlas_decls, requires
    )
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
}
