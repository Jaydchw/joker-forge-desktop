use super::GameObject;
use crate::compiler;
use crate::lua_ast::Chunk;
use crate::types::{ConsumableTypeDef, ObjectType};

impl GameObject for ConsumableTypeDef {
    fn object_type(&self) -> ObjectType {
        ObjectType::ConsumableType
    }

    fn compile(&self, mod_prefix: &str) -> Chunk {
        compiler::compile_consumable_type(self, mod_prefix)
    }
}
