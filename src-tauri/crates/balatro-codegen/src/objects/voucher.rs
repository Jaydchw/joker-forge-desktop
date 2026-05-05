use super::GameObject;
use crate::compiler;
use crate::lua_ast::Chunk;
use crate::types::{ObjectType, VoucherDef};

impl GameObject for VoucherDef {
    fn object_type(&self) -> ObjectType {
        ObjectType::Voucher
    }

    fn compile(&self, mod_prefix: &str) -> Chunk {
        compiler::compile_voucher(self, mod_prefix)
    }
}
