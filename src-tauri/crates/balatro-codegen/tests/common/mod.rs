#![allow(dead_code)]

use std::collections::HashMap;

use balatro_codegen::types::{
    AtlasPos, ConditionDef, ConditionGroupDef, ConsumableDef, DeckDef, EditionDef, EffectDef,
    EnhancementDef, JokerDef, LogicOp, ParamValue, RuleDef, SealDef, VoucherDef,
};

pub fn base_joker() -> JokerDef {
    JokerDef {
        key: "j_test_joker".to_string(),
        name: "Test Joker".to_string(),
        description: vec!["Test description".to_string()],
        cost: 4,
        rarity: "common".to_string(),
        blueprint_compat: true,
        eternal_compat: true,
        perishable_compat: true,
        unlocked: true,
        discovered: true,
        atlas: "Joker".to_string(),
        pos: AtlasPos { x: 0, y: 0 },
        soul_pos: None,
        display_size: None,
        rules: vec![],
        appearance: None,
        unlock: None,
        user_variables: vec![],
        force_eternal: false,
        force_perishable: false,
        force_rental: false,
        force_foil: false,
        force_holographic: false,
        force_polychrome: false,
        force_negative: false,
        ignore_slot_limit: false,
        info_queues: vec![],
    }
}

pub fn base_consumable() -> ConsumableDef {
    ConsumableDef {
        key: "c_test_consumable".to_string(),
        name: "Test Consumable".to_string(),
        description: vec!["Test description".to_string()],
        set: "Tarot".to_string(),
        cost: Some(3),
        unlocked: Some(true),
        discovered: Some(true),
        hidden: Some(false),
        can_repeat_soul: Some(false),
        atlas: "Consumables".to_string(),
        pos: AtlasPos { x: 0, y: 0 },
        soul_pos: None,
        rules: vec![],
        user_variables: vec![],
    }
}

pub fn base_voucher() -> VoucherDef {
    VoucherDef {
        key: "v_test_voucher".to_string(),
        name: "Test Voucher".to_string(),
        description: vec!["Test description".to_string()],
        unlock_description: vec![],
        cost: Some(10),
        unlocked: Some(true),
        discovered: Some(true),
        no_collection: Some(false),
        can_repeat_soul: Some(false),
        requires: None,
        atlas: "Voucher".to_string(),
        pos: AtlasPos { x: 0, y: 0 },
        soul_pos: None,
        rules: vec![],
        user_variables: vec![],
        draw_shader_sprite: None,
    }
}

pub fn base_deck() -> DeckDef {
    DeckDef {
        key: "b_test_deck".to_string(),
        name: "Test Deck".to_string(),
        description: vec!["Test description".to_string()],
        atlas: "Enhancers".to_string(),
        pos: AtlasPos { x: 0, y: 0 },
        rules: vec![],
        user_variables: vec![],
        unlocked: Some(true),
        discovered: Some(true),
        no_collection: Some(false),
        config_vouchers: vec![],
        config_consumables: vec![],
        no_interest: false,
        no_faces: false,
        erratic_deck: false,
    }
}

pub fn base_enhancement() -> EnhancementDef {
    EnhancementDef {
        key: "m_test_enhancement".to_string(),
        name: "Test Enhancement".to_string(),
        description: vec!["Test description".to_string()],
        atlas: "centers".to_string(),
        pos: AtlasPos { x: 0, y: 0 },
        rules: vec![],
        user_variables: vec![],
        any_suit: Some(false),
        replace_base_card: Some(false),
        no_rank: Some(false),
        no_suit: Some(false),
        always_scores: Some(false),
        unlocked: Some(true),
        discovered: Some(true),
        no_collection: Some(false),
        weight: Some(1.0),
    }
}

pub fn base_seal() -> SealDef {
    SealDef {
        key: "s_test_seal".to_string(),
        name: "Test Seal".to_string(),
        description: vec!["Test description".to_string()],
        atlas: "centers".to_string(),
        pos: AtlasPos { x: 0, y: 0 },
        rules: vec![],
        user_variables: vec![],
        badge_colour: Some("FF0000".to_string()),
        unlocked: Some(true),
        discovered: Some(true),
        no_collection: Some(false),
        sound: "gold_seal".to_string(),
        pitch: None,
        volume: None,
    }
}

pub fn base_edition() -> EditionDef {
    EditionDef {
        key: "e_test_edition".to_string(),
        name: "Test Edition".to_string(),
        description: vec!["Test description".to_string()],
        rules: vec![],
        user_variables: vec![],
        shader: None,
        in_shop: Some(true),
        weight: Some(1.0),
        extra_cost: Some(0),
        apply_to_float: Some(false),
        badge_colour: None,
        sound: None,
        pitch: None,
        volume: None,
        disable_shadow: Some(false),
        disable_base_shader: Some(false),
        unlocked: Some(true),
        discovered: Some(true),
        no_collection: Some(false),
    }
}

pub fn effect(effect_type: &str, params: &[(&str, ParamValue)]) -> EffectDef {
    let mut map = HashMap::new();
    for (k, v) in params {
        map.insert((*k).to_string(), v.clone());
    }
    EffectDef {
        id: String::new(),
        effect_type: effect_type.to_string(),
        params: map,
    }
}

pub fn condition(condition_type: &str) -> ConditionDef {
    ConditionDef {
        id: String::new(),
        condition_type: condition_type.to_string(),
        negate: false,
        operator: None,
        params: HashMap::new(),
    }
}

pub fn and_group(conditions: Vec<ConditionDef>) -> ConditionGroupDef {
    ConditionGroupDef {
        logic_operator: LogicOp::And,
        conditions,
    }
}

pub fn rule_with_effects(id: &str, trigger: &str, effects: Vec<EffectDef>) -> RuleDef {
    RuleDef {
        id: id.to_string(),
        trigger: trigger.to_string(),
        retrigger: false,
        destroy: false,
        condition_groups: vec![],
        effects,
        random_groups: vec![],
        loop_groups: vec![],
    }
}

pub fn rule_with_conditions(
    id: &str,
    trigger: &str,
    condition_groups: Vec<ConditionGroupDef>,
    effects: Vec<EffectDef>,
) -> RuleDef {
    RuleDef {
        id: id.to_string(),
        trigger: trigger.to_string(),
        retrigger: false,
        destroy: false,
        condition_groups,
        effects,
        random_groups: vec![],
        loop_groups: vec![],
    }
}
