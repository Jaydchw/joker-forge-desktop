import { parse } from "luaparse";
import type { CustomCodeState } from "../core/types";
import { parseLuaScalar } from "../content/live-code-sync";

export type AtlasItemType = "joker" | "consumable" | "voucher" | "deck" | "enhancement" | "seal" | "booster";

interface AtlasPos {
  x: number;
  y: number;
}

interface AtlasTarget {
  itemType: AtlasItemType;
  objectKey: string;
  pos: AtlasPos;
  soulPos?: AtlasPos | null;
}

interface LuaNode {
  type: string;
  range?: [number, number];
  [key: string]: unknown;
}

interface Registration {
  table: LuaNode;
  fields: Map<string, LuaNode>;
}

interface LiteralPosition extends AtlasPos {
  xNode: LuaNode;
  yNode: LuaNode;
}

const itemTypes = {
  joker: { constructor: "Joker", atlas: "CustomJokers", soul: true },
  consumable: { constructor: "Consumable", atlas: "CustomConsumables", soul: true },
  voucher: { constructor: "Voucher", atlas: "CustomVouchers", soul: true },
  deck: { constructor: "Back", atlas: "CustomDecks", soul: false },
  enhancement: { constructor: "Enhancement", atlas: "CustomEnhancements", soul: false },
  seal: { constructor: "Seal", atlas: "CustomSeals", soul: false },
  booster: { constructor: "Booster", atlas: "CustomBoosters", soul: false },
} as const;

const isNode = (value: unknown): value is LuaNode =>
  value !== null && typeof value === "object" && "type" in value && typeof value.type === "string";

const stringValue = (node: LuaNode | undefined): string | undefined => {
  if (node?.type !== "StringLiteral" || typeof node.raw !== "string") return undefined;
  const value = parseLuaScalar(node.raw);
  return typeof value === "string" ? value : undefined;
};

function tableFields(table: LuaNode): Map<string, LuaNode> | undefined {
  if (table.type !== "TableConstructorExpression" || !Array.isArray(table.fields)) return undefined;
  const fields = new Map<string, LuaNode>();
  for (const field of table.fields) {
    if (!isNode(field) || !isNode(field.value)) return undefined;
    if (field.type === "TableValue") continue;
    const key = field.type === "TableKeyString" && isNode(field.key) && typeof field.key.name === "string"
      ? field.key.name : field.type === "TableKey" && isNode(field.key) ? stringValue(field.key) : undefined;
    if (key === undefined || fields.has(key)) return undefined;
    fields.set(key, field.value);
  }
  return fields;
}

function registration(source: string, target: AtlasTarget): Registration | undefined {
  const tree = parse(source, {
    luaVersion: "LuaJIT", extendedIdentifiers: true, encodingMode: "none", comments: false, ranges: true,
  });
  const matches: Registration[] = [];
  let ambiguous = false;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!isNode(value) || value.type === "FunctionDeclaration") return;
    const base = value.base;
    if ((value.type === "CallExpression" || value.type === "TableCallExpression")
      && isNode(base) && base.type === "MemberExpression" && base.indexer === "."
      && isNode(base.base) && base.base.type === "Identifier" && base.base.name === "SMODS"
      && isNode(base.identifier) && base.identifier.name === itemTypes[target.itemType].constructor) {
      const table = value.type === "TableCallExpression" ? value.arguments
        : Array.isArray(value.arguments) && value.arguments.length === 1 ? value.arguments[0] : undefined;
      if (isNode(table)) {
        const fields = tableFields(table);
        if (!fields) ambiguous = true;
        else if (stringValue(fields.get("key")) === target.objectKey) matches.push({ table, fields });
      } else ambiguous = true;
    }
    Object.values(value).forEach(visit);
  };
  visit(tree);
  return !ambiguous && matches.length === 1 ? matches[0] : undefined;
}

function literalPosition(node: LuaNode | undefined): LiteralPosition | undefined {
  if (!node || !Array.isArray(node.fields) || node.fields.length !== 2) return undefined;
  const fields = tableFields(node);
  const xNode = fields?.get("x"), yNode = fields?.get("y");
  if (xNode?.type !== "NumericLiteral" || yNode?.type !== "NumericLiteral"
    || typeof xNode.value !== "number" || typeof yNode.value !== "number"
    || !Number.isFinite(xNode.value) || !Number.isFinite(yNode.value)) return undefined;
  return { x: xNode.value, y: yNode.value, xNode, yNode };
}

const samePosition = (a: LiteralPosition | undefined, b: LiteralPosition | undefined): boolean =>
  !!a && !!b && a.x === b.x && a.y === b.y;

const validPosition = (pos: AtlasPos): boolean =>
  Number.isInteger(pos.x) && pos.x >= 0 && Number.isInteger(pos.y) && pos.y >= 0;

export function rebaseCustomLuaAtlas(
  customCode: Pick<CustomCodeState, "fullCode" | "lastGeneratedCode"> | undefined,
  target: AtlasTarget,
): string | null {
  if (!customCode) return null;
  const source = customCode.fullCode;
  if (!customCode.lastGeneratedCode || !validPosition(target.pos)
    || (target.soulPos && !validPosition(target.soulPos))) return source;

  try {
    const current = registration(source, target);
    const baseline = registration(customCode.lastGeneratedCode, target);
    const kind = itemTypes[target.itemType];
    if (!current || !baseline || stringValue(current.fields.get("atlas")) !== kind.atlas
      || stringValue(baseline.fields.get("atlas")) !== kind.atlas) return source;

    const edits: Array<{ from: number; to: number; insert: string }> = [];
    const replace = (node: LuaNode, insert: string): void => {
      if (node.range && source.slice(...node.range) !== insert) {
        edits.push({ from: node.range[0], to: node.range[1], insert });
      }
    };
    const updatePosition = (position: LiteralPosition, next: AtlasPos): void => {
      replace(position.xNode, String(next.x));
      replace(position.yNode, String(next.y));
    };
    const pos = literalPosition(current.fields.get("pos"));
    if (pos && samePosition(pos, literalPosition(baseline.fields.get("pos")))) updatePosition(pos, target.pos);

    const soulAtlas = current.fields.get("soul_atlas");
    const baselineSoulAtlas = baseline.fields.get("soul_atlas");
    const ownsSoulAtlas = (!soulAtlas && !baselineSoulAtlas)
      || (soulAtlas?.type === "NilLiteral" && baselineSoulAtlas?.type === "NilLiteral")
      || (stringValue(soulAtlas) === kind.atlas && stringValue(baselineSoulAtlas) === kind.atlas);
    if (kind.soul && ownsSoulAtlas) {
      const soul = current.fields.get("soul_pos");
      const baselineSoul = baseline.fields.get("soul_pos");
      const position = literalPosition(soul);
      const unchanged = samePosition(position, literalPosition(baselineSoul))
        || (soul?.type === "NilLiteral" && baselineSoul?.type === "NilLiteral");
      if (soul && unchanged) {
        if (!target.soulPos) replace(soul, "nil");
        else if (position) updatePosition(position, target.soulPos);
        else replace(soul, `{ x = ${target.soulPos.x}, y = ${target.soulPos.y} }`);
      } else if (!soul && !baselineSoul && target.soulPos && current.table.range) {
        // Insert first: a last field without a separator or with a line comment stays valid.
        const firstField = Array.isArray(current.table.fields) ? current.table.fields[0] : undefined;
        const fieldStart = isNode(firstField) ? firstField.range?.[0] : undefined;
        const prefix = fieldStart === undefined ? "" : source.slice(source.lastIndexOf("\n", fieldStart) + 1, fieldStart);
        const indent = /^[\t ]*$/.test(prefix) && prefix ? prefix : "  ";
        const newline = source.includes("\r\n") ? "\r\n" : "\n";
        const at = current.table.range[0] + 1;
        const suffix = source[at] === "\n" || source.slice(at, at + 2) === "\r\n" ? "" : newline;
        edits.push({ from: at, to: at,
          insert: `${newline}${indent}soul_pos = { x = ${target.soulPos.x}, y = ${target.soulPos.y} },${suffix}` });
      }
    }
    return edits.sort((a, b) => b.from - a.from).reduce(
      (code, edit) => code.slice(0, edit.from) + edit.insert + code.slice(edit.to), source,
    );
  } catch {
    return source;
  }
}
