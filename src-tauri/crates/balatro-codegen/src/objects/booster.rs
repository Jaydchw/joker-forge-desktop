use super::GameObject;
use crate::compiler;
use crate::lua_ast::Chunk;
use crate::types::{BoosterDef, ObjectType};

impl GameObject for BoosterDef {
    fn object_type(&self) -> ObjectType {
        ObjectType::Booster
    }

    fn compile(&self, mod_prefix: &str) -> Chunk {
        compiler::compile_booster(self, mod_prefix)
    }
}
