pub mod booster;
pub mod consumable;
pub mod consumable_type;
pub mod deck;
pub mod edition;
pub mod enhancement;
pub mod joker;
pub mod rarity;
pub mod seal;
pub mod voucher;

use crate::lua_ast::Chunk;
use crate::types::ObjectType;

/// Trait for game objects that can be compiled to Lua code.
///
/// Each game object type (joker, consumable, deck: etc.) implements this
/// trait to handle its specific SMODS structure and function generation.
pub trait GameObject {
    /// The object type identifier.
    fn object_type(&self) -> ObjectType;

    /// Compile this game object into a complete Lua chunk.
    fn compile(&self, mod_prefix: &str) -> Chunk;
}
