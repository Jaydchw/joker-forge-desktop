use super::GameObject;
use crate::compiler;
use crate::lua_ast::Chunk;
use crate::types::{ObjectType, SealDef};

impl GameObject for SealDef {
    fn object_type(&self) -> ObjectType {
        ObjectType::Seal
    }

    fn compile(&self, mod_prefix: &str) -> Chunk {
        compiler::compile_seal(self, mod_prefix)
    }
}
