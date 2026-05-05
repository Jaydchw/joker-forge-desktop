use super::GameObject;
use crate::compiler;
use crate::lua_ast::Chunk;
use crate::types::{ObjectType, RarityDef};

impl GameObject for RarityDef {
    fn object_type(&self) -> ObjectType {
        ObjectType::Rarity
    }

    fn compile(&self, mod_prefix: &str) -> Chunk {
        compiler::compile_rarity(self, mod_prefix)
    }
}
