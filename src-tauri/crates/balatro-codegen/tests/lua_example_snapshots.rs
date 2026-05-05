use std::fs;
use std::path::{Path, PathBuf};

use balatro_codegen::types::{
    ConsumableDef, ConsumableTypeDef, DeckDef, EditionDef, EnhancementDef, JokerDef, ObjectType,
    RarityDef, SealDef, VoucherDef,
};
use balatro_codegen::{
    compile_consumable, compile_consumable_type, compile_deck, compile_edition,
    compile_enhancement, compile_joker_with_options, compile_rarity, compile_seal, compile_voucher,
    Emitter,
};
use serde::Deserialize;
use serde_json::Value;

const EXAMPLES_ROOT: &str = "tests/lua-code-examples";
const UPDATE_ENV: &str = "UPDATE_LUA_EXAMPLES";

#[derive(Debug, Deserialize)]
struct ExampleSpec {
    object_type: ObjectType,
    #[serde(default = "default_mod_prefix")]
    mod_prefix: String,
    #[serde(default = "default_true")]
    include_loc_txt: bool,
    definition: Value,
}

fn default_mod_prefix() -> String {
    "modprefix".to_string()
}

fn default_true() -> bool {
    true
}

fn discover_spec_files(root: &Path) -> Vec<PathBuf> {
    fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
        let entries = match fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk(&path, out);
                continue;
            }
            if path.extension().and_then(|ext| ext.to_str()) == Some("json") {
                out.push(path);
            }
        }
    }

    let mut files = Vec::new();
    walk(root, &mut files);
    files.sort();
    files
}

fn split_header_and_body(content: &str) -> (String, String) {
    let normalized = content.replace("\r\n", "\n");
    let lines: Vec<&str> = normalized.lines().collect();
    let mut split_at = lines.len();

    for (idx, line) in lines.iter().enumerate() {
        let trimmed = line.trim_start().trim_start_matches('\u{feff}');
        if trimmed.starts_with("--") || trimmed.is_empty() {
            continue;
        }
        split_at = idx;
        break;
    }

    let header = lines[..split_at].join("\n");
    let body = lines[split_at..].join("\n");
    (header, body)
}

fn normalize_lua(content: &str) -> String {
    content
        .replace("\r\n", "\n")
        .lines()
        .map(str::trim_end)
        .collect::<Vec<&str>>()
        .join("\n")
        .trim()
        .to_string()
}

fn extract_comparable_body(content: &str) -> String {
    let normalized = content.replace("\r\n", "\n");
    let lines: Vec<&str> = normalized.lines().collect();
    for (idx, line) in lines.iter().enumerate() {
        let trimmed = line.trim_start().trim_start_matches('\u{feff}');
        if trimmed.starts_with("SMODS.")
            || trimmed.starts_with("return ")
            || trimmed.starts_with("local ")
        {
            return lines[idx..].join("\n");
        }
    }
    let (_, body) = split_header_and_body(&normalized);
    body
}

fn compile_example(spec: &ExampleSpec) -> String {
    let chunk = match spec.object_type {
        ObjectType::Joker => {
            let def: JokerDef = serde_json::from_value(spec.definition.clone())
                .expect("invalid joker example definition");
            compile_joker_with_options(&def, &spec.mod_prefix, spec.include_loc_txt)
        }
        ObjectType::Consumable => {
            let def: ConsumableDef = serde_json::from_value(spec.definition.clone())
                .expect("invalid consumable example definition");
            compile_consumable(&def, &spec.mod_prefix)
        }
        ObjectType::ConsumableType => {
            let def: ConsumableTypeDef = serde_json::from_value(spec.definition.clone())
                .expect("invalid consumable-type example definition");
            compile_consumable_type(&def, &spec.mod_prefix)
        }
        ObjectType::Enhancement => {
            let def: EnhancementDef = serde_json::from_value(spec.definition.clone())
                .expect("invalid enhancement example definition");
            compile_enhancement(&def, &spec.mod_prefix)
        }
        ObjectType::Seal => {
            let def: SealDef = serde_json::from_value(spec.definition.clone())
                .expect("invalid seal example definition");
            compile_seal(&def, &spec.mod_prefix)
        }
        ObjectType::Edition => {
            let def: EditionDef = serde_json::from_value(spec.definition.clone())
                .expect("invalid edition example definition");
            compile_edition(&def, &spec.mod_prefix)
        }
        ObjectType::Rarity => {
            let def: RarityDef = serde_json::from_value(spec.definition.clone())
                .expect("invalid rarity example definition");
            compile_rarity(&def, &spec.mod_prefix)
        }
        ObjectType::Voucher => {
            let def: VoucherDef = serde_json::from_value(spec.definition.clone())
                .expect("invalid voucher example definition");
            compile_voucher(&def, &spec.mod_prefix)
        }
        ObjectType::Deck => {
            let def: DeckDef = serde_json::from_value(spec.definition.clone())
                .expect("invalid deck example definition");
            compile_deck(&def, &spec.mod_prefix)
        }
        ObjectType::Booster => {
            panic!("booster examples are not supported by this snapshot test yet");
        }
    };

    Emitter::new().emit_chunk(&chunk)
}

fn expected_lua_path(spec_path: &Path) -> PathBuf {
    spec_path.with_extension("lua")
}

fn default_header(spec_path: &Path, spec: &ExampleSpec) -> String {
    format!(
        "-- Example: {}\n-- Object: {}\n-- Keep this header; test compares only Lua body below.",
        spec_path
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("unnamed_example"),
        spec.object_type.as_str()
    )
}

fn curated_header_or_default(existing: &str, spec_path: &Path, spec: &ExampleSpec) -> String {
    let normalized = existing.replace("\r\n", "\n");
    let mut example: Option<String> = None;
    let mut object: Option<String> = None;
    let mut purpose: Option<String> = None;

    for line in normalized.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("-- Example:") && example.is_none() {
            example = Some(trimmed.to_string());
        } else if trimmed.starts_with("-- Object:") && object.is_none() {
            object = Some(trimmed.to_string());
        } else if trimmed.starts_with("-- Purpose:") && purpose.is_none() {
            purpose = Some(trimmed.to_string());
        }
    }

    match (example, object, purpose) {
        (Some(example), Some(object), Some(purpose)) => {
            format!("{}\n{}\n{}", example, object, purpose)
        }
        _ => default_header(spec_path, spec),
    }
}

#[test]
fn lua_example_files_have_comment_headers() {
    let root = Path::new(EXAMPLES_ROOT);
    let specs = discover_spec_files(root);
    assert!(
        !specs.is_empty(),
        "No example specs found under {}",
        root.display()
    );

    for spec_path in specs {
        let lua_path = expected_lua_path(&spec_path);
        assert!(
            lua_path.exists(),
            "Missing example Lua file for {}",
            spec_path.display()
        );

        let content = fs::read_to_string(&lua_path)
            .unwrap_or_else(|e| panic!("Failed to read {}: {}", lua_path.display(), e));
        let (header, body) = split_header_and_body(&content);

        assert!(
            header
                .lines()
                .any(|line| line.trim_start().starts_with("-- Example:")),
            "{} must start with a comment header containing `-- Example:`",
            lua_path.display()
        );
        assert!(
            !normalize_lua(&extract_comparable_body(&body)).is_empty(),
            "{} must contain generated Lua content below the header",
            lua_path.display()
        );
    }
}

#[test]
fn lua_codegen_matches_examples() {
    let root = Path::new(EXAMPLES_ROOT);
    let specs = discover_spec_files(root);
    let update = std::env::var(UPDATE_ENV).ok().as_deref() == Some("1");

    assert!(
        !specs.is_empty(),
        "No example specs found under {}",
        root.display()
    );

    for spec_path in specs {
        let spec_text = fs::read_to_string(&spec_path)
            .unwrap_or_else(|e| panic!("Failed to read {}: {}", spec_path.display(), e));
        let spec: ExampleSpec = serde_json::from_str(&spec_text)
            .unwrap_or_else(|e| panic!("Invalid JSON in {}: {}", spec_path.display(), e));

        let generated = compile_example(&spec);
        let generated_body = extract_comparable_body(&generated);
        let generated_normalized = normalize_lua(&generated_body);

        let lua_path = expected_lua_path(&spec_path);
        let existing = if lua_path.exists() {
            fs::read_to_string(&lua_path)
                .unwrap_or_else(|e| panic!("Failed to read {}: {}", lua_path.display(), e))
        } else {
            String::new()
        };
        let (_, expected_body) = split_header_and_body(&existing);
        let expected_normalized = normalize_lua(&extract_comparable_body(&expected_body));

        let should_write =
            update || !lua_path.exists() || expected_normalized != generated_normalized;
        if should_write {
            let next_header = curated_header_or_default(&existing, &spec_path, &spec);
            let rendered = format!(
                "{}\n\n{}\n",
                next_header.trim_end(),
                generated_body.trim_end()
            );
            fs::write(&lua_path, rendered)
                .unwrap_or_else(|e| panic!("Failed to write {}: {}", lua_path.display(), e));
        }

        if !update {
            assert_eq!(
                expected_normalized,
                generated_normalized,
                "Lua snapshot mismatch for {}.\nRun with {}=1 to update fixtures.",
                spec_path.display(),
                UPDATE_ENV
            );
        }
    }
}
