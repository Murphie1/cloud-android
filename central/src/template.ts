import fs from "fs/promises";
import path from "path";
import Handlebars, { HelperOptions } from "handlebars";
import yaml from "js-yaml";

// --------- Register Handlebars Helpers ---------
Handlebars.registerHelper(
  "if_eq",
  function (this: any, a: unknown, b: unknown, options: HelperOptions) {
    return a === b ? options.fn(this) : options.inverse(this);
  }
);

Handlebars.registerHelper(
  "json",
  function (_context: unknown) {
    return JSON.stringify(_context, null, 2);
  }
);

Handlebars.registerHelper(
  "yaml",
  function (_context: unknown) {
    return yaml.dump(_context).trim();
  }
);

Handlebars.registerHelper("or", (a: any, b: any) => {
  return !!(a || b);
});

Handlebars.registerHelper(
  "exists",
  function (this: any, value: unknown, options: HelperOptions) {
    return value !== null && value !== undefined && value !== ""
      ? options.fn(this)
      : options.inverse(this);
  }
);

Handlebars.registerHelper("indent", (text: string, spaces: number) => {
  if (!text) return "";
  return text
    .split("\n")
    .map((line: any) => " ".repeat(spaces) + line)
    .join("\n");
});

Handlebars.registerHelper("length", (val: any) => {
  if (Array.isArray(val)) return val.length;
  if (val && typeof val === "object") return Object.keys(val).length;
  return 0;
});

Handlebars.registerHelper("gt", (a: any, b: any) => {
  return a > b;
});

Handlebars.registerHelper("lt", (a: any, b: any) => {
  return a < b;
});

Handlebars.registerHelper("eq", (a: any, b: any) => {
  return a === b;
});

Handlebars.registerHelper("keys", (val: any) =>
  val && typeof val === "object" ? Object.keys(val) : []
);

function clean(obj: Record<string, any>) {
  return Object.fromEntries(
  Object.entries(obj).filter(([_, v]) => v !== null && v !== undefined)
  );
  }

// --------- Template Renderer ---------
export async function renderTemplate(templateName: string, values: Record<string, any>) {
  const templatesDir = process.env.TEMPLATES_DIR || path.resolve(process.cwd(), "templates");
  const filePath = path.join(templatesDir, templateName);

  const text = await fs.readFile(filePath, "utf8");
  const tpl = Handlebars.compile(text, { noEscape: true });

  // --------- Defaults ---------
  const defaults = {
    sessionId: values.sessionId,
    cpu_request: "1",
    cpu_limit: "4",
    memory_request: "4Gi",
    memory_limit: "12Gi",
    resolution: "1280×720"
  };

  const context = clean({ ...defaults, ...values });

  // --------- Render ---------
  const rendered = tpl(context);

  // --------- Parse multi-doc YAML ---------
  const docs: any[] = [];
  yaml.loadAll(rendered, (doc) => {
    if (doc) docs.push(doc);
  });
  return docs;
  }
