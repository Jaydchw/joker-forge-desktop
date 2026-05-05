use std::collections::HashMap;

use crate::lua_ast::Expr;
use crate::types::{ConfigValue, ConfigVar, ObjectType, UserVarType, UserVariableDef};

/// Compilation context: tracks state while compiling a single game object.
///
/// This context accumulates config variables, user variables: and effect counts
/// as effects and conditions are compiled. It provides the ability path for
/// the current object type and handles variable name deduplication.
#[derive(Debug, Clone)]
pub struct CompileContext {
    pub object_type: ObjectType,
    pub mod_prefix: String,
    pub object_key: String,
    pub blueprint_compat: bool,

    /// Tracks how many effects of each type have been seen,
    /// used to generate unique config variable names (chips, chips2: chips3...).
    effect_type_counts: HashMap<String, usize>,

    /// Accumulated config variables for `ability.extra`.
    config_vars: Vec<ConfigVar>,

    /// User-defined variables.
    user_vars: Vec<UserVariableDef>,
}

impl CompileContext {
    fn user_var_def(&self, var_name: &str) -> Option<&UserVariableDef> {
        self.user_vars.iter().find(|v| v.name == var_name)
    }

    pub fn new(
        object_type: ObjectType,
        mod_prefix: String,
        object_key: String,
        blueprint_compat: bool,
    ) -> Self {
        Self {
            object_type,
            mod_prefix,
            object_key,
            blueprint_compat,
            effect_type_counts: HashMap::new(),
            config_vars: Vec::new(),
            user_vars: Vec::new(),
        }
    }

    /// Returns the Lua path to access config variables.
    /// e.g.: `card.ability.extra` or `back.ability.extra`
    pub fn ability_path(&self) -> &str {
        self.object_type.ability_path()
    }

    /// Returns a Lua expression for accessing a config variable by name.
    /// e.g.: `card.ability.extra.chips`
    pub fn ability_var(&self, var_name: &str) -> Expr {
        use crate::lua_ast::*;
        let path = self.ability_path();
        lua_field(lua_raw_expr(path), var_name)
    }

    /// Whether the given user variable is marked global.
    pub fn user_var_is_global(&self, var_name: &str) -> bool {
        self.user_var_def(var_name)
            .map(|v| v.is_global)
            .unwrap_or(false)
    }

    /// Whether the given user variable persists across runs.
    pub fn user_var_is_persistent(&self, var_name: &str) -> bool {
        self.user_var_def(var_name)
            .map(|v| v.is_persistent)
            .unwrap_or(false)
    }

    /// Whether the given user variable exists in this object's variable scope.
    pub fn has_user_var(&self, var_name: &str) -> bool {
        self.user_vars.iter().any(|v| v.name == var_name)
    }

    /// Returns a Lua expression for reading/writing a user variable.
    /// Global user variables resolve through `JF_GLOBALS`.
    pub fn user_var_expr(&self, var_name: &str) -> Expr {
        use crate::lua_ast::*;
        if self.user_var_is_global(var_name) && self.user_var_is_persistent(var_name) {
            lua_field(lua_raw_expr("JF_GLOBALS"), var_name)
        } else if self.user_var_is_global(var_name) {
            lua_raw_expr(format!(
                "(G.GAME and G.GAME.jf_global_vars and G.GAME.jf_global_vars.{})",
                var_name
            ))
        } else {
            self.ability_var(var_name)
        }
    }

    /// Returns the textual Lua path used for a user variable.
    pub fn user_var_path(&self, var_name: &str) -> String {
        if self.user_var_is_global(var_name) && self.user_var_is_persistent(var_name) {
            format!("JF_GLOBALS.{}", var_name)
        } else if self.user_var_is_global(var_name) {
            format!("G.GAME.jf_global_vars.{}", var_name)
        } else {
            format!("{}.{}", self.ability_path(), var_name)
        }
    }

    /// Increment the count for an effect type and return the current count.
    /// First occurrence returns 0, second returns 1: etc.
    pub fn next_effect_count(&mut self, effect_type: &str) -> usize {
        let count = self
            .effect_type_counts
            .entry(effect_type.to_string())
            .or_insert(0);
        let current = *count;
        *count += 1;
        current
    }

    /// Generate a unique variable name for a config variable.
    /// Always appends the count: `chips0`, `chips1`, `chips2`...
    pub fn unique_var_name(&self, base_name: &str, same_type_count: usize) -> String {
        format!("{}{}", base_name, same_type_count)
    }

    /// Add a config variable.
    pub fn add_config_var(&mut self, var: ConfigVar) {
        self.config_vars.push(var);
    }

    /// Add a numeric config variable.
    pub fn add_config_num(&mut self, name: impl Into<String>, value: f64) {
        self.config_vars.push(ConfigVar {
            name: name.into(),
            value: ConfigValue::Number(value),
        });
    }

    /// Add an integer config variable.
    pub fn add_config_int(&mut self, name: impl Into<String>, value: i64) {
        self.config_vars.push(ConfigVar {
            name: name.into(),
            value: ConfigValue::Int(value),
        });
    }

    /// Add a string config variable.
    pub fn add_config_str(&mut self, name: impl Into<String>, value: impl Into<String>) {
        self.config_vars.push(ConfigVar {
            name: name.into(),
            value: ConfigValue::Str(value.into()),
        });
    }

    /// Get all accumulated config variables.
    pub fn config_vars(&self) -> &[ConfigVar] {
        &self.config_vars
    }

    /// Set user variables.
    pub fn set_user_vars(&mut self, vars: Vec<UserVariableDef>) {
        self.user_vars = vars;
    }

    /// Get user variables.
    pub fn user_vars(&self) -> &[UserVariableDef] {
        &self.user_vars
    }

    /// The full SMODS key for this object (e.g.: `j_modprefix_myjoker`).
    pub fn smods_key(&self) -> String {
        let prefix = match self.object_type {
            ObjectType::Joker => "j",
            ObjectType::Consumable => "c",
            ObjectType::ConsumableType => "ct",
            ObjectType::Enhancement => "m",
            ObjectType::Seal => "s",
            ObjectType::Edition => "e",
            ObjectType::Rarity => "r",
            ObjectType::Voucher => "v",
            ObjectType::Deck => "b",
            ObjectType::Booster => "p",
        };
        format!("{}_{}", prefix, self.full_key())
    }

    /// The object key with mod prefix (e.g.: `modprefix_myjoker`).
    pub fn full_key(&self) -> String {
        format!("{}_{}", self.mod_prefix, self.object_key)
    }

    /// Build the config.extra table expression from accumulated config vars
    /// and user variables.
    pub fn build_config_extra_table(&self) -> Vec<crate::lua_ast::TableEntry> {
        use crate::lua_ast::*;

        let mut entries: Vec<TableEntry> = Vec::new();

        // Config variables from effects
        for var in &self.config_vars {
            entries.push(TableEntry::KeyValue(
                var.name.clone(),
                var.value.to_lua_expr(),
            ));
        }

        // User variables with initial values
        for uvar in &self.user_vars {
            if uvar.is_global {
                continue;
            }
            let val = match uvar.var_type {
                UserVarType::Number => {
                    let n = uvar.initial_value.as_f64().unwrap_or(0.0);
                    if n.fract() == 0.0 {
                        lua_int(n as i64)
                    } else {
                        lua_num(n)
                    }
                }
                UserVarType::Key
                | UserVarType::Text
                | UserVarType::Suit
                | UserVarType::Rank
                | UserVarType::PokerHand => lua_str(uvar.initial_value.to_string_lossy()),
            };
            entries.push(TableEntry::KeyValue(uvar.name.clone(), val));
        }

        entries
    }
}
