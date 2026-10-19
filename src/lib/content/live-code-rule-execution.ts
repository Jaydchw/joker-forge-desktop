import { parse } from "luaparse";
import { isLuaIndentationEquivalent } from "./live-code-format";
import { parseLuaScalar } from "./live-code-sync";

interface LuaNode {
  type: string;
  range?: [number, number];
  [key: string]: unknown;
}

interface JokerRegistration {
  table: LuaNode;
  fields: Map<string, LuaNode>;
}

const isNode = (value: unknown): value is LuaNode =>
  value !== null && typeof value === "object" && "type" in value;

function registration(source: string, objectKey: string): JokerRegistration | undefined {
  const tree = parse(source, {
    luaVersion: "LuaJIT", extendedIdentifiers: true, encodingMode: "none", ranges: true,
  });
  const matches: JokerRegistration[] = [];
  let ambiguous = false;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!isNode(value) || value.type === "FunctionDeclaration") return;
    const base = value.base;
    if ((value.type === "CallExpression" || value.type === "TableCallExpression")
      && isNode(base) && base.type === "MemberExpression" && base.indexer === "."
      && isNode(base.base) && base.base.type === "Identifier" && base.base.name === "SMODS"
      && isNode(base.identifier) && base.identifier.name === "Joker") {
      const table = value.type === "TableCallExpression" ? value.arguments
        : Array.isArray(value.arguments) && value.arguments.length === 1 ? value.arguments[0] : undefined;
      if (!isNode(table) || table.type !== "TableConstructorExpression" || !Array.isArray(table.fields)) {
        ambiguous = true;
      } else {
        const fields = new Map<string, LuaNode>();
        for (const field of table.fields) {
          if (!isNode(field) || !isNode(field.key) || !isNode(field.value)) { ambiguous = true; continue; }
          const key = field.type === "TableKeyString" ? field.key.name
            : field.type === "TableKey" && typeof field.key.raw === "string" ? parseLuaScalar(field.key.raw) : undefined;
          if (typeof key !== "string" || fields.has(key)) { ambiguous = true; continue; }
          fields.set(key, field.value);
        }
        const key = fields.get("key");
        if (typeof key?.raw === "string" && parseLuaScalar(key.raw) === objectKey) {
          matches.push({ table, fields });
        }
      }
    }
    Object.values(value).forEach(visit);
  };
  visit(tree);
  return !ambiguous && matches.length === 1 ? matches[0] : undefined;
}

const fieldSource = (source: string, node: LuaNode | undefined): string =>
  node?.range ? source.slice(...node.range) : "nil";

const unchangedField = (current: string, baseline: string): boolean =>
  isLuaIndentationEquivalent(`local value = ${current}`, `local value = ${baseline}`);

function configFields(table: LuaNode): Map<string, LuaNode> | undefined {
  if (table.type !== "TableConstructorExpression" || !Array.isArray(table.fields)) return undefined;
  const fields = new Map<string, LuaNode>();
  for (const field of table.fields) {
    if (!isNode(field) || !isNode(field.key) || !isNode(field.value)) return undefined;
    const key = field.type === "TableKeyString" ? field.key.name
      : field.type === "TableKey" && typeof field.key.raw === "string" ? parseLuaScalar(field.key.raw) : undefined;
    if (typeof key !== "string" || fields.has(key)) return undefined;
    fields.set(key, field.value);
  }
  return fields;
}

function addedField(source: string, table: LuaNode, value: LuaNode, replacement: string): string | null {
  const field = Array.isArray(table.fields) ? table.fields.find((candidate) => isNode(candidate) && candidate.value === value) : undefined;
  if (!isNode(field) || !field.range || !value.range) return null;
  return source.slice(field.range[0], value.range[0]) + replacement + ",";
}

function mergeConfig(
  current: string, baseline: string, generated: string,
  edited: LuaNode | undefined, before: LuaNode | undefined, fresh: LuaNode | undefined,
): string | null {
  const currentValue = fieldSource(current, edited);
  const oldValue = fieldSource(baseline, before);
  const nextValue = fieldSource(generated, fresh);
  if (unchangedField(currentValue, oldValue)) return nextValue;
  if (unchangedField(nextValue, oldValue)) return currentValue;
  // Preserve scalar overrides while adding the defaults needed by new rules.
  if (fresh?.type !== "TableConstructorExpression" && before?.type !== "TableConstructorExpression") return currentValue;
  const currentFields = edited && configFields(edited);
  const oldFields = before && configFields(before);
  const nextFields = fresh && configFields(fresh);
  if (!currentFields || !oldFields || !nextFields || !edited?.range) return null;
  const edits: Array<{ from: number; to: number; insert: string }> = [];
  const additions: string[] = [];
  for (const key of new Set([...oldFields.keys(), ...nextFields.keys()])) {
    const currentNode = currentFields.get(key);
    const next = mergeConfig(current, baseline, generated, currentNode, oldFields.get(key), nextFields.get(key));
    if (next === null) return null;
    if (currentNode?.range) {
      edits.push({ from: currentNode.range[0] - edited.range[0], to: currentNode.range[1] - edited.range[0], insert: next });
    } else if (!oldFields.has(key) && nextFields.has(key)) {
      const addition = addedField(generated, fresh!, nextFields.get(key)!, next);
      if (addition === null) return null;
      additions.push(addition);
    }
  }
  if (additions.length) edits.push({ from: 1, to: 1, insert: `\n  ${additions.join("\n  ")}\n` });
  return edits.sort((a, b) => b.from - a.from).reduce(
    (code, edit) => code.slice(0, edit.from) + edit.insert + code.slice(edit.to), currentValue,
  );
}

export function canRegenerateJokerCalculate(current: string, baseline: string, objectKey: string): boolean {
  try {
    const before = registration(baseline, objectKey);
    const edited = registration(current, objectKey);
    return !!before && !!edited && unchangedField(
      fieldSource(current, edited.fields.get("calculate")),
      fieldSource(baseline, before.fields.get("calculate")),
    );
  } catch { return false; }
}

export function regenerateJokerCalculate(
  current: string, baseline: string, generated: string, objectKey: string,
): string | null {
  if (!canRegenerateJokerCalculate(current, baseline, objectKey)) return null;
  try {
    const edited = registration(current, objectKey);
    const before = registration(baseline, objectKey);
    const fresh = registration(generated, objectKey);
    if (!edited || !before || !fresh || !edited.table.range) return null;
    const edits: Array<{ from: number; to: number; insert: string }> = [];
    const additions: string[] = [];
    for (const key of new Set([...before.fields.keys(), ...fresh.fields.keys()])) {
      const old = before.fields.get(key);
      const currentField = edited.fields.get(key);
      const next = fresh.fields.get(key);
      if (key !== "config" && !unchangedField(fieldSource(current, currentField), fieldSource(baseline, old))) continue;
      const insert = key === "config" ? mergeConfig(current, baseline, generated, currentField, old, next)
        : fieldSource(generated, next);
      if (insert === null) return null;
      if (currentField?.range) {
        const [from, to] = currentField.range;
        if (current.slice(from, to) !== insert) edits.push({ from, to, insert });
      } else if (next) {
        const addition = addedField(generated, fresh.table, next, insert);
        if (addition === null) return null;
        additions.push(addition);
      }
    }
    if (additions.length) {
      const at = edited.table.range[0] + 1;
      edits.push({ from: at, to: at, insert: `\n  ${additions.join("\n  ")}\n` });
    }
    return edits.sort((a, b) => b.from - a.from).reduce(
      (code, edit) => code.slice(0, edit.from) + edit.insert + code.slice(edit.to), current,
    );
  } catch { return null; }
}

const ruleOrderMetadataFields = new Set([
  "loc_txt", "atlas", "pos", "soul_pos", "display_size", "draw_size", "pixel_size",
  "cost", "rarity", "blueprint_compat", "eternal_compat", "perishable_compat",
  "unlocked", "discovered", "demicoloncompat",
]);

function literalMetadata(node: LuaNode | undefined): boolean {
  if (!node) return true;
  if (["StringLiteral", "NumericLiteral", "BooleanLiteral", "NilLiteral"].includes(node.type)) return true;
  if (node.type === "UnaryExpression" && node.operator === "-" && isNode(node.argument)) {
    return node.argument.type === "NumericLiteral";
  }
  if (node.type !== "TableConstructorExpression" || !Array.isArray(node.fields)) return false;
  return node.fields.every((field) => {
    if (!isNode(field) || !isNode(field.value) || !literalMetadata(field.value)) return false;
    if (field.type === "TableValue") return true;
    if (!isNode(field.key)) return false;
    return field.type === "TableKeyString" || (field.type === "TableKey" && literalMetadata(field.key));
  });
}

function outsideRegistration(source: string, table: LuaNode): string | undefined {
  if (!table.range) return undefined;
  return source.slice(0, table.range[0]) + "{}" + source.slice(table.range[1]);
}

export function canRegenerateJokerRuleOrder(current: string, baseline: string, objectKey: string): boolean {
  try {
    const before = registration(baseline, objectKey);
    const edited = registration(current, objectKey);
    if (!before || !edited) return false;
    const outsideBefore = outsideRegistration(baseline, before.table);
    const outsideCurrent = outsideRegistration(current, edited.table);
    if (outsideBefore === undefined || outsideCurrent === undefined
      || !isLuaIndentationEquivalent(outsideCurrent, outsideBefore)) return false;
    for (const key of new Set([...before.fields.keys(), ...edited.fields.keys()])) {
      const old = before.fields.get(key);
      const value = edited.fields.get(key);
      if (unchangedField(fieldSource(current, value), fieldSource(baseline, old))) continue;
      if (!ruleOrderMetadataFields.has(key) || !literalMetadata(value)) return false;
    }
    return true;
  } catch { return false; }
}

export function regenerateJokerRuleOrder(
  current: string, baseline: string, generated: string, objectKey: string,
): string | null {
  if (!canRegenerateJokerRuleOrder(current, baseline, objectKey)) return null;
  try {
    const edited = registration(current, objectKey);
    const before = registration(baseline, objectKey);
    const fresh = registration(generated, objectKey);
    if (!edited || !before || !fresh || !edited.table.range) return null;
    const edits: Array<{ from: number; to: number; insert: string }> = [];
    const additions: string[] = [];
    for (const key of new Set([...before.fields.keys(), ...fresh.fields.keys()])) {
      const old = before.fields.get(key);
      const currentField = edited.fields.get(key);
      const next = fresh.fields.get(key);
      const isUnchanged = unchangedField(fieldSource(current, currentField), fieldSource(baseline, old));
      if (!isUnchanged) {
        if (key === "loc_txt" && !unchangedField(fieldSource(generated, next), fieldSource(baseline, old))) return null;
        continue;
      }
      const insert = fieldSource(generated, next);
      if (currentField?.range) {
        const [from, to] = currentField.range;
        if (current.slice(from, to) !== insert) edits.push({ from, to, insert });
      } else if (next) {
        const addition = addedField(generated, fresh.table, next, insert);
        if (addition === null) return null;
        additions.push(addition);
      }
    }
    if (additions.length) {
      const at = edited.table.range[0] + 1;
      edits.push({ from: at, to: at, insert: `\n  ${additions.join("\n  ")}\n` });
    }
    const result = edits.sort((a, b) => b.from - a.from).reduce(
      (code, edit) => code.slice(0, edit.from) + edit.insert + code.slice(edit.to), current,
    );
    const merged = registration(result, objectKey);
    if (!merged?.table.range || !fresh.table.range) return null;
    return generated.slice(0, fresh.table.range[0]) + result.slice(...merged.table.range)
      + generated.slice(fresh.table.range[1]);
  } catch { return null; }
}
