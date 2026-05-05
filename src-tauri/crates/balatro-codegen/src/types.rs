use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Top-level mod configuration
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModConfig {
    pub mod_prefix: String,
    pub mod_id: String,
    pub mod_name: String,
    pub mod_version: String,
    pub mod_author: String,
}

// ---------------------------------------------------------------------------
// Game object definitions
// ---------------------------------------------------------------------------

/// The type of game object being compiled.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObjectType {
    Joker,
    Consumable,
    ConsumableType,
    Enhancement,
    Seal,
    Edition,
    Rarity,
    Voucher,
    Deck,
    Booster,
}

impl ObjectType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ObjectType::Joker => "joker",
            ObjectType::Consumable => "consumable",
            ObjectType::ConsumableType => "consumable_type",
            ObjectType::Enhancement => "enhancement",
            ObjectType::Seal => "seal",
            ObjectType::Edition => "edition",
            ObjectType::Rarity => "rarity",
            ObjectType::Voucher => "voucher",
            ObjectType::Deck => "deck",
            ObjectType::Booster => "booster",
        }
    }

    /// The Lua path prefix to access config variables for this object type.
    pub fn ability_path(&self) -> &'static str {
        match self {
            ObjectType::Deck => "back.ability.extra",
            ObjectType::Seal => "card.ability.seal.extra",
            _ => "card.ability.extra",
        }
    }

    /// The SMODS API name used for table-call generation.
    pub fn smods_type(&self) -> &'static str {
        match self {
            ObjectType::Joker => "SMODS.Joker",
            ObjectType::Consumable => "SMODS.Consumable",
            ObjectType::ConsumableType => "SMODS.ConsumableType",
            ObjectType::Enhancement => "SMODS.Enhancement",
            ObjectType::Seal => "SMODS.Seal",
            ObjectType::Edition => "SMODS.Edition",
            ObjectType::Rarity => "SMODS.Rarity",
            ObjectType::Voucher => "SMODS.Voucher",
            ObjectType::Deck => "SMODS.Back",
            ObjectType::Booster => "SMODS.Booster",
        }
    }
}

// ---------------------------------------------------------------------------
// Joker definition
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JokerDef {
    pub key: String,
    pub name: String,
    pub description: Vec<String>,
    pub cost: i32,
    pub rarity: String,
    pub blueprint_compat: bool,
    pub eternal_compat: bool,
    pub perishable_compat: bool,
    pub unlocked: bool,
    pub discovered: bool,
    pub atlas: String,
    pub pos: AtlasPos,
    #[serde(default)]
    pub soul_pos: Option<AtlasPos>,
    #[serde(default)]
    pub display_size: Option<DisplaySize>,
    pub rules: Vec<RuleDef>,
    #[serde(default)]
    pub appearance: Option<AppearanceDef>,
    #[serde(default)]
    pub unlock: Option<UnlockDef>,
    #[serde(default)]
    pub user_variables: Vec<UserVariableDef>,
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
    #[serde(default)]
    pub ignore_slot_limit: bool,
    #[serde(default)]
    pub info_queues: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtlasPos {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplaySize {
    pub w: f64,
    pub h: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceDef {
    #[serde(default)]
    pub appears_in: Vec<String>,
    #[serde(default)]
    pub not_appears_in: Vec<String>,
    #[serde(default)]
    pub appear_flags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnlockDef {
    pub condition: String,
    pub description: Vec<String>,
}

// ---------------------------------------------------------------------------
// Consumable definition
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsumableDef {
    pub key: String,
    pub name: String,
    pub description: Vec<String>,
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
    pub atlas: String,
    pub pos: AtlasPos,
    #[serde(default)]
    pub soul_pos: Option<AtlasPos>,
    pub rules: Vec<RuleDef>,
    #[serde(default)]
    pub user_variables: Vec<UserVariableDef>,
}

// ---------------------------------------------------------------------------
// ConsumableType definition (custom consumable sets)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsumableTypeDef {
    pub key: String,
    pub name: String,
    #[serde(default)]
    pub collection_name: Option<String>,
    pub primary_colour: String,
    pub secondary_colour: String,
    pub collection_rows: (i32, i32),
    #[serde(default)]
    pub default_card: Option<String>,
    #[serde(default)]
    pub shop_rate: Option<f64>,
}

// ---------------------------------------------------------------------------
// Enhancement definition
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancementDef {
    pub key: String,
    pub name: String,
    pub description: Vec<String>,
    pub atlas: String,
    pub pos: AtlasPos,
    pub rules: Vec<RuleDef>,
    #[serde(default)]
    pub user_variables: Vec<UserVariableDef>,
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
}

// ---------------------------------------------------------------------------
// Seal definition
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SealDef {
    pub key: String,
    pub name: String,
    pub description: Vec<String>,
    pub atlas: String,
    pub pos: AtlasPos,
    pub rules: Vec<RuleDef>,
    #[serde(default)]
    pub user_variables: Vec<UserVariableDef>,
    #[serde(default)]
    pub badge_colour: Option<String>,
    #[serde(default)]
    pub unlocked: Option<bool>,
    #[serde(default)]
    pub discovered: Option<bool>,
    #[serde(default)]
    pub no_collection: Option<bool>,
    #[serde(default = "default_seal_sound")]
    pub sound: String,
    #[serde(default)]
    pub pitch: Option<f64>,
    #[serde(default)]
    pub volume: Option<f64>,
}

fn default_seal_sound() -> String {
    "gold_seal".to_string()
}

// ---------------------------------------------------------------------------
// Edition definition
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditionDef {
    pub key: String,
    pub name: String,
    pub description: Vec<String>,
    pub rules: Vec<RuleDef>,
    #[serde(default)]
    pub user_variables: Vec<UserVariableDef>,
    #[serde(default)]
    pub shader: Option<String>,
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

// ---------------------------------------------------------------------------
// Rarity definition
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RarityDef {
    pub key: String,
    pub name: String,
    pub badge_colour: String,
    #[serde(default = "default_rarity_weight")]
    pub default_weight: f64,
}

fn default_rarity_weight() -> f64 {
    1.0
}

// ---------------------------------------------------------------------------
// Voucher definition
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoucherDef {
    pub key: String,
    pub name: String,
    pub description: Vec<String>,
    #[serde(default)]
    pub unlock_description: Vec<String>,
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
    pub atlas: String,
    pub pos: AtlasPos,
    #[serde(default)]
    pub soul_pos: Option<AtlasPos>,
    pub rules: Vec<RuleDef>,
    #[serde(default)]
    pub user_variables: Vec<UserVariableDef>,
    #[serde(default)]
    pub draw_shader_sprite: Option<String>,
}

// ---------------------------------------------------------------------------
// Deck definition
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeckDef {
    pub key: String,
    pub name: String,
    pub description: Vec<String>,
    pub atlas: String,
    pub pos: AtlasPos,
    pub rules: Vec<RuleDef>,
    #[serde(default)]
    pub user_variables: Vec<UserVariableDef>,
    #[serde(default)]
    pub unlocked: Option<bool>,
    #[serde(default)]
    pub discovered: Option<bool>,
    #[serde(default)]
    pub no_collection: Option<bool>,
    /// Voucher keys to include with this deck (e.g.: "v_seed_money").
    #[serde(default)]
    pub config_vouchers: Vec<String>,
    /// Consumable keys to include with this deck (e.g.: "c_fool").
    #[serde(default)]
    pub config_consumables: Vec<String>,
    #[serde(default)]
    pub no_interest: bool,
    #[serde(default)]
    pub no_faces: bool,
    #[serde(default)]
    pub erratic_deck: bool,
}

// ---------------------------------------------------------------------------
// Booster definition
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoosterDef {
    pub key: String,
    pub name: String,
    pub description: Vec<String>,
    pub atlas: String,
    pub pos: AtlasPos,
    #[serde(default)]
    pub cost: Option<i32>,
    #[serde(default)]
    pub weight: Option<f64>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub draw: Option<i32>,
    #[serde(default)]
    pub extra: Option<i32>,
    #[serde(default)]
    pub discovered: Option<bool>,
    pub rules: Vec<RuleDef>,
}

// ---------------------------------------------------------------------------
// User variables
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserVariableDef {
    pub name: String,
    pub var_type: UserVarType,
    pub initial_value: ParamValue,
    #[serde(default)]
    pub is_global: bool,
    #[serde(default)]
    pub is_persistent: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UserVarType {
    Number,
    Suit,
    Rank,
    PokerHand,
    Key,
    Text,
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleDef {
    pub id: String,
    pub trigger: String,
    #[serde(default)]
    pub retrigger: bool,
    #[serde(default)]
    pub destroy: bool,
    #[serde(default)]
    pub condition_groups: Vec<ConditionGroupDef>,
    #[serde(default)]
    pub effects: Vec<EffectDef>,
    #[serde(default)]
    pub random_groups: Vec<RandomGroupDef>,
    #[serde(default)]
    pub loop_groups: Vec<LoopGroupDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionGroupDef {
    #[serde(default = "default_logic_op")]
    pub logic_operator: LogicOp,
    pub conditions: Vec<ConditionDef>,
}

fn default_logic_op() -> LogicOp {
    LogicOp::And
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogicOp {
    And,
    Or,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionDef {
    pub condition_type: String,
    #[serde(default)]
    pub negate: bool,
    #[serde(default)]
    pub operator: Option<LogicOp>,
    #[serde(default)]
    pub params: HashMap<String, ParamValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectDef {
    pub effect_type: String,
    #[serde(default)]
    pub params: HashMap<String, ParamValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RandomGroupDef {
    pub id: String,
    pub chance_numerator: ParamValue,
    pub chance_denominator: ParamValue,
    pub effects: Vec<EffectDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoopGroupDef {
    pub id: String,
    pub count: ParamValue,
    pub effects: Vec<EffectDef>,
}

// ---------------------------------------------------------------------------
// Parameter values, flexible value type
// ---------------------------------------------------------------------------

/// A parameter value from the editor. Can be a plain literal or a dynamic
/// reference (game variable, user variable: range).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ParamValue {
    Int(i64),
    Float(f64),
    Bool(bool),
    Str(String),
    /// Complex value with type annotation
    Typed(TypedValue),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypedValue {
    pub value: serde_json::Value,
    #[serde(rename = "valueType")]
    pub value_type: String,
}

impl ParamValue {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            ParamValue::Str(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_i64(&self) -> Option<i64> {
        match self {
            ParamValue::Int(n) => Some(*n),
            ParamValue::Float(n) => Some(*n as i64),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            ParamValue::Float(n) => Some(*n),
            ParamValue::Int(n) => Some(*n as f64),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            ParamValue::Bool(b) => Some(*b),
            _ => None,
        }
    }

    /// Get string value, trying string first: then converting other types.
    pub fn to_string_lossy(&self) -> String {
        match self {
            ParamValue::Str(s) => s.clone(),
            ParamValue::Int(n) => n.to_string(),
            ParamValue::Float(n) => n.to_string(),
            ParamValue::Bool(b) => b.to_string(),
            ParamValue::Typed(t) => t.value.as_str().map(|s| s.to_string()).unwrap_or_default(),
        }
    }
}

// ---------------------------------------------------------------------------
// Config variable, tracked during compilation
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct ConfigVar {
    pub name: String,
    pub value: ConfigValue,
}

#[derive(Debug, Clone)]
pub enum ConfigValue {
    Number(f64),
    Int(i64),
    Str(String),
    Bool(bool),
}

impl ConfigValue {
    pub fn to_lua_expr(&self) -> crate::lua_ast::Expr {
        use crate::lua_ast;
        match self {
            ConfigValue::Number(n) => lua_ast::lua_num(*n),
            ConfigValue::Int(n) => lua_ast::lua_int(*n),
            ConfigValue::Str(s) => lua_ast::lua_str(s),
            ConfigValue::Bool(b) => lua_ast::lua_bool(*b),
        }
    }
}

