use super::GameObject;
use crate::compiler;
use crate::lua_ast::Chunk;
use crate::types::{DeckDef, ObjectType};

impl GameObject for DeckDef {
    fn object_type(&self) -> ObjectType {
        ObjectType::Deck
    }

    fn compile(&self, mod_prefix: &str) -> Chunk {
        compiler::compile_deck(self, mod_prefix)
    }
}
