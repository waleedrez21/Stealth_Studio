// frontend/src/RichContent.tsx
import { Fragment } from "react";

// frontend/src/rich-text.js
var RICH_PREFIX = "stealth:rich:v1:";
var containers = /* @__PURE__ */ new Set(["doc", "paragraph", "heading", "blockquote", "bulletList", "orderedList", "listItem", "codeBlock"]);
var leaves = /* @__PURE__ */ new Set(["text", "hardBreak", "horizontalRule"]);
var marks = /* @__PURE__ */ new Set(["bold", "italic", "underline", "strike", "code", "link"]);
function safeLink(value) {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
function validateDocument(input) {
  let count = 0;
  function visit(node, depth) {
    if (++count > 5e3 || depth > 20 || !node || typeof node !== "object" || !containers.has(node.type) && !leaves.has(node.type)) throw new Error("Unsupported text formatting.");
    const result = { type: node.type };
    if (node.type === "text") {
      if (typeof node.text !== "string") throw new Error("Invalid text.");
      result.text = node.text;
      if (node.marks) {
        if (!Array.isArray(node.marks) || node.marks.length > 6) throw new Error("Invalid text formatting.");
        result.marks = node.marks.map((mark) => {
          if (!marks.has(mark?.type)) throw new Error("Unsupported text formatting.");
          if (mark.type === "link") {
            const href = safeLink(mark.attrs?.href);
            if (!href) throw new Error("Links must use https://, http:// or mailto:.");
            return { type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer" } };
          }
          return { type: mark.type };
        });
      }
    }
    if (node.type === "heading") result.attrs = { level: [2, 3].includes(node.attrs?.level) ? node.attrs.level : 2 };
    if (["paragraph", "heading"].includes(node.type) && ["left", "center", "right", "justify"].includes(node.attrs?.textAlign)) result.attrs = { ...result.attrs, textAlign: node.attrs.textAlign };
    if (node.type === "orderedList" && Number.isInteger(node.attrs?.start) && node.attrs.start >= 1 && node.attrs.start <= 1e4) result.attrs = { start: node.attrs.start };
    if (containers.has(node.type)) {
      if (node.content !== void 0 && !Array.isArray(node.content)) throw new Error("Invalid text content.");
      result.content = (node.content || []).map((child) => visit(child, depth + 1));
      const allowed = node.type === "doc" || node.type === "blockquote" ? ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "codeBlock", "horizontalRule"] : node.type === "listItem" ? ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "codeBlock"] : ["bulletList", "orderedList"].includes(node.type) ? ["listItem"] : node.type === "codeBlock" ? ["text"] : ["text", "hardBreak"];
      if (result.content.some((child) => !allowed.includes(child.type))) throw new Error("Invalid text structure.");
    }
    return result;
  }
  const doc = visit(input, 0);
  if (doc.type !== "doc") throw new Error("Invalid text document.");
  return doc;
}
function documentFor(value) {
  if (value.startsWith(RICH_PREFIX)) return validateDocument(JSON.parse(value.slice(RICH_PREFIX.length)));
  return { type: "doc", content: value.split("\n").map((text) => ({ type: "paragraph", ...text ? { content: [{ type: "text", text }] } : {} })) };
}

// frontend/src/RichContent.tsx
import { jsx } from "react/jsx-runtime";
function render(node, key) {
  const children = node.content?.map(render);
  const style = node.attrs?.textAlign ? { textAlign: node.attrs.textAlign } : void 0;
  switch (node.type) {
    case "doc":
      return /* @__PURE__ */ jsx(Fragment, { children }, key);
    case "paragraph":
      return /* @__PURE__ */ jsx("p", { style, children: children || /* @__PURE__ */ jsx("br", {}) }, key);
    case "heading":
      return node.attrs?.level === 3 ? /* @__PURE__ */ jsx("h3", { style, children }, key) : /* @__PURE__ */ jsx("h2", { style, children }, key);
    case "blockquote":
      return /* @__PURE__ */ jsx("blockquote", { children }, key);
    case "bulletList":
      return /* @__PURE__ */ jsx("ul", { children }, key);
    case "orderedList":
      return /* @__PURE__ */ jsx("ol", { start: node.attrs?.start, children }, key);
    case "listItem":
      return /* @__PURE__ */ jsx("li", { children }, key);
    case "hardBreak":
      return /* @__PURE__ */ jsx("br", {}, key);
    case "horizontalRule":
      return /* @__PURE__ */ jsx("hr", {}, key);
    case "codeBlock":
      return /* @__PURE__ */ jsx("pre", { children: /* @__PURE__ */ jsx("code", { children }) }, key);
    case "text": {
      let text = node.text;
      for (const mark of node.marks || []) switch (mark.type) {
        case "bold":
          text = /* @__PURE__ */ jsx("strong", { children: text });
          break;
        case "italic":
          text = /* @__PURE__ */ jsx("em", { children: text });
          break;
        case "underline":
          text = /* @__PURE__ */ jsx("u", { children: text });
          break;
        case "strike":
          text = /* @__PURE__ */ jsx("s", { children: text });
          break;
        case "code":
          text = /* @__PURE__ */ jsx("code", { children: text });
          break;
        case "link": {
          const href = safeLink(mark.attrs?.href);
          if (href) text = /* @__PURE__ */ jsx("a", { href, target: "_blank", rel: "noopener noreferrer", children: text });
          break;
        }
      }
      return /* @__PURE__ */ jsx(Fragment, { children: text }, key);
    }
    default:
      return null;
  }
}
function RichContent({ value, className = "" }) {
  if (!value.startsWith(RICH_PREFIX)) return /* @__PURE__ */ jsx("div", { className: `rich-content rich-legacy ${className}`, children: value.split(/(https?:\/\/[^\s]+)/g).map((part, i) => /^https?:\/\//.test(part) && safeLink(part) ? /* @__PURE__ */ jsx("a", { href: part, target: "_blank", rel: "noopener noreferrer", children: part }, i) : part) });
  try {
    return /* @__PURE__ */ jsx("div", { className: `rich-content ${className}`, children: render(documentFor(value), 0) });
  } catch {
    return /* @__PURE__ */ jsx("div", { className: "notice", children: "This text could not be displayed." });
  }
}
export {
  RichContent as default
};
