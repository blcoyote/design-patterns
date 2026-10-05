import type { PrismTheme } from "prism-react-renderer";

const v = (name: string) => `var(--color-${name})`;

/**
 * Night Owl's token table with every colour read from tokens.css, so the code blocks
 * follow the active theme. prism-react-renderer applies these as inline styles, which
 * is why `var()` works here.
 */
export const codeTheme: PrismTheme = {
  plain: { color: v("code-fg"), backgroundColor: v("code-bg") },
  styles: [
    { types: ["changed"], style: { color: v("syntax-changed"), fontStyle: "italic" } },
    { types: ["deleted"], style: { color: v("syntax-deleted"), fontStyle: "italic" } },
    { types: ["inserted", "attr-name"], style: { color: v("syntax-string"), fontStyle: "italic" } },
    { types: ["comment"], style: { color: v("syntax-comment"), fontStyle: "italic" } },
    { types: ["string", "url"], style: { color: v("syntax-string") } },
    { types: ["variable"], style: { color: v("code-fg") } },
    { types: ["number"], style: { color: v("syntax-number") } },
    { types: ["builtin", "char", "constant", "function"], style: { color: v("syntax-function") } },
    { types: ["punctuation"], style: { color: v("syntax-punctuation") } },
    {
      types: ["selector", "doctype"],
      style: { color: v("syntax-punctuation"), fontStyle: "italic" },
    },
    { types: ["class-name"], style: { color: v("syntax-class-name") } },
    { types: ["tag", "operator", "keyword"], style: { color: v("syntax-keyword") } },
    { types: ["boolean"], style: { color: v("syntax-boolean") } },
    { types: ["property"], style: { color: v("syntax-property") } },
    { types: ["namespace"], style: { color: v("syntax-namespace") } },
  ],
};
