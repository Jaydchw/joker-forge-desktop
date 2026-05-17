const TEXT_CLASS_TO_BALATRO_COLOR: Record<string, string> = {
  "text-balatro-white": "white",
  "text-white-lighter": "white",
  "text-balatro-blue": "blue",
  "text-balatro-red": "red",
  "text-balatro-attention": "attention",
  "text-balatro-green": "green",
  "text-balatro-purple": "purple",
  "text-balatro-chips": "chips",
  "text-balatro-mult": "mult",
  "text-balatro-money": "money",
  "text-balatro-gold-new": "gold",
  "text-balatro-black": "black",
  "text-balatro-grey": "inactive",
  "text-balatro-spades": "spades",
  "text-balatro-hearts": "hearts",
  "text-balatro-clubs": "clubs",
  "text-balatro-diamonds": "diamonds",
  "text-balatro-planet": "planet",
  "text-balatro-spectral": "spectral",
  "text-balatro-common": "common",
  "text-balatro-uncommon": "uncommon",
  "text-balatro-rare": "rare",
  "text-balatro-legendary": "legendary",
  "text-balatro-enhanced-new": "enhanced",
  "text-balatro-default": "default",
  "text-rainbow": "edition",
  "text-balatro-dark-edition": "dark_edition",
};

const BG_CLASS_TO_BALATRO_COLOR: Record<string, string> = {
  "bg-white-lighter": "white",
  "bg-balatro-blue": "blue",
  "bg-balatro-red": "red",
  "bg-balatro-attention": "attention",
  "bg-balatro-green": "green",
  "bg-balatro-purple": "purple",
  "bg-balatro-chips": "chips",
  "bg-balatro-mult": "mult",
  "bg-balatro-money": "money",
  "bg-balatro-gold-new": "gold",
  "bg-balatro-black": "black",
  "bg-balatro-planet": "planet",
  "bg-balatro-spectral": "spectral",
  "bg-balatro-common": "common",
  "bg-balatro-uncommon": "uncommon",
  "bg-balatro-rare": "rare",
  "bg-balatro-legendary": "legendary",
  "bg-balatro-enhanced-new": "enhanced",
  "bg-balatro-default": "default",
  "bg-rainbow": "edition",
  "bg-dark-rainbow": "dark_edition",
  "bg-black": "black",
};

const BR_TAG_REGEX = /<br\s*\/?>/gi;
const HTML_TAG_REGEX = /<\/?[^>]+>/g;

const toClassList = (value: string): string[] =>
  value
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const getClassAttribute = (attributes: string): string | null => {
  const match = attributes.match(/class\s*=\s*["']([^"']+)["']/i);
  return match?.[1] ?? null;
};

const getModifiersFromClassList = (classList: string[]): string[] => {
  const background = classList
    .map((className) => BG_CLASS_TO_BALATRO_COLOR[className])
    .find(Boolean);
  const text = classList
    .map((className) => TEXT_CLASS_TO_BALATRO_COLOR[className])
    .find(Boolean);

  if (!background && !text) return [];

  const modifiers: string[] = [];
  if (background) modifiers.push(`X:${background}`);
  if (text) modifiers.push(`C:${text}`);
  return modifiers;
};

const collapseEmptyResetPairs = (value: string): string => {
  let current = value;
  while (current.includes("{}{}")) {
    current = current.replace(/\{\}\{\}/g, "{}");
  }
  return current;
};

const convertWithRegexFallback = (value: string): string => {
  let normalized = value.replace(BR_TAG_REGEX, "[s]");

  for (let i = 0; i < 12; i += 1) {
    const updated = normalized.replace(
      /<span\b([^>]*)>([\s\S]*?)<\/span>/gi,
      (_full, attributes: string, content: string) => {
        const classAttribute = getClassAttribute(attributes);
        if (!classAttribute) return content;

        const modifiers = getModifiersFromClassList(toClassList(classAttribute));
        if (modifiers.length === 0) return content;
        return `{${modifiers.join(",")}}${content}{}`;
      },
    );

    if (updated === normalized) break;
    normalized = updated;
  }

  normalized = normalized.replace(HTML_TAG_REGEX, "");
  return collapseEmptyResetPairs(normalized);
};

const convertWithDomParser = (value: string): string => {
  const parser = new DOMParser();
  const document = parser.parseFromString(`<div>${value}</div>`, "text/html");
  const root = document.body.firstElementChild;
  if (!root) return "";

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    if (tagName === "br") {
      return "[s]";
    }

    const inner = Array.from(element.childNodes)
      .map((child) => walk(child))
      .join("");

    if (tagName !== "span") {
      return inner;
    }

    const modifiers = getModifiersFromClassList(Array.from(element.classList));
    if (modifiers.length === 0) return inner;
    return `{${modifiers.join(",")}}${inner}{}`;
  };

  const normalized = Array.from(root.childNodes)
    .map((node) => walk(node))
    .join("");

  return collapseEmptyResetPairs(normalized);
};

export const sanitizeDescription = (description: string): string => {
  if (!description) return "";

  const normalized =
    typeof DOMParser !== "undefined"
      ? convertWithDomParser(description)
      : convertWithRegexFallback(description);

  return normalized.replace(HTML_TAG_REGEX, "");
};

