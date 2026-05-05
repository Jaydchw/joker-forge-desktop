/// Normalize a hex color string for Lua `HEX(...)` calls.
///
/// Accepts:
/// - Optional leading `#`
/// - 6 or 8 hex digits
///
/// Returns uppercase hex without `#` when valid.
pub(crate) fn normalize_hex_colour(value: &str) -> Option<String> {
    let raw = value.trim();
    if raw.is_empty() {
        return None;
    }

    let hex = raw.strip_prefix('#').unwrap_or(raw);
    let len_ok = hex.len() == 6 || hex.len() == 8;
    if !len_ok || !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }

    Some(hex.to_ascii_uppercase())
}
