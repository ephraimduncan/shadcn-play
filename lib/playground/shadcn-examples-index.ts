import { readdirSync, readFileSync } from "fs";
import { join } from "path";

export interface RawExampleFile {
  fileName: string;
  sourcePath: string;
  code: string;
}

export interface ShadcnExample {
  id: string;
  label: string;
  sourcePath: string;
  code: string;
}

export interface ShadcnComponentExamples {
  id: string;
  label: string;
  examples: ShadcnExample[];
}

export interface ShadcnExamplesIndex {
  components: ShadcnComponentExamples[];
}

export const CANONICAL_COMPONENT_IDS = [
  "accordion",
  "alert",
  "alert-dialog",
  "aspect-ratio",
  "attachment",
  "avatar",
  "badge",
  "breadcrumb",
  "bubble",
  "button",
  "button-group",
  "calendar",
  "card",
  "carousel",
  "chart",
  "checkbox",
  "collapsible",
  "combobox",
  "command",
  "context-menu",
  "data-table",
  "date-picker",
  "dialog",
  "direction",
  "drawer",
  "dropdown-menu",
  "empty",
  "field",
  "hover-card",
  "input",
  "input-group",
  "input-otp",
  "item",
  "kbd",
  "label",
  "marker",
  "menubar",
  "message-scroller",
  "message",
  "native-select",
  "navigation-menu",
  "pagination",
  "popover",
  "progress",
  "radio-group",
  "resizable",
  "scroll-area",
  "select",
  "separator",
  "sheet",
  "sidebar",
  "skeleton",
  "slider",
  "sonner",
  "spinner",
  "switch",
  "table",
  "tabs",
  "textarea",
  "toast",
  "toggle",
  "toggle-group",
  "tooltip",
  "typography",
] as const;

const COMPONENT_LABEL_OVERRIDES: Record<string, string> = {
  kbd: "Kbd",
  sonner: "Sonner",
  typography: "Typography",
};

function toTitleCase(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getComponentLabel(componentId: string): string {
  return COMPONENT_LABEL_OVERRIDES[componentId] ?? toTitleCase(componentId);
}

export function getExampleLabel(exampleSlug: string): string {
  return toTitleCase(exampleSlug || "demo");
}

export function inferComponentId(fileName: string): string | null {
  const baseName = fileName.replace(/\.tsx$/, "");

  if (baseName === "radio-fields") {
    return "radio-group";
  }

  if (baseName.startsWith("data-picker-")) {
    return "date-picker";
  }

  if (
    baseName.startsWith("file-upload-") ||
    baseName.startsWith("muted-item-") ||
    baseName.startsWith("outline-item-")
  ) {
    return "item";
  }

  const sorted = [...CANONICAL_COMPONENT_IDS].sort(
    (a, b) => b.length - a.length,
  );

  for (const id of sorted) {
    if (baseName === id || baseName.startsWith(`${id}-`)) {
      return id;
    }
  }

  return null;
}

export function buildShadcnExamplesIndex(files: RawExampleFile[]): {
  index: ShadcnExamplesIndex;
  warnings: string[];
} {
  const warnings: string[] = [];
  const map = new Map<string, ShadcnExample[]>();

  for (const file of files) {
    const baseName = file.fileName.replace(/\.tsx$/, "");
    const hasRtlInName = /(^|-)rtl($|-)/i.test(baseName);
    const hasRtlInCode = /\brtl\b/i.test(file.code);

    if (hasRtlInName || hasRtlInCode) {
      continue;
    }

    const componentId = inferComponentId(file.fileName);
    if (!componentId) {
      warnings.push(`Skipping ${file.fileName}: component id not recognized.`);
      continue;
    }

    let suffix =
      baseName === componentId
        ? "demo"
        : baseName.slice(componentId.length + 1) || "demo";

    switch (baseName) {
      case "radio-fields":
        suffix = "fields";
        break;
      case "file-upload-list":
      case "muted-item-group":
      case "outline-item-group":
        suffix = baseName;
        break;
    }

    const example: ShadcnExample = {
      id: `${componentId}-${suffix}`,
      label: getExampleLabel(suffix),
      sourcePath: file.sourcePath,
      code: file.code,
    };

    const existing = map.get(componentId) ?? [];
    existing.push(example);
    map.set(componentId, existing);
  }

  const components: ShadcnComponentExamples[] = [...map.entries()]
    .map(([id, examples]) => ({
      id,
      label: getComponentLabel(id),
      examples: examples
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true }),
        )
        .map((example) => ({ ...example })),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    index: { components },
    warnings,
  };
}

export function normalizeExampleImports(code: string): string {
  return code
    .replaceAll(/@\/examples\/(?:base|radix)\/ui-rtl\//g, "@/components/ui/")
    .replaceAll(/@\/examples\/(?:base|radix)\/ui\//g, "@/components/ui/")
    .replaceAll(/@\/styles\/base-nova\/ui-rtl\//g, "@/components/ui/")
    .replaceAll(/@\/styles\/base-nova\/ui\//g, "@/components/ui/");
}

function getExportedComponentName(code: string): string | null {
  const defaultFunctionMatch = code.match(
    /export\s+default\s+function\s+([A-Za-z_$][\w$]*)\s*\(/,
  );
  if (defaultFunctionMatch) return defaultFunctionMatch[1];

  const namedFunctionMatch = code.match(
    /export\s+function\s+([A-Za-z_$][\w$]*)\s*\(/,
  );
  if (namedFunctionMatch) return namedFunctionMatch[1];

  const defaultIdentifierMatch = code.match(
    /export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/,
  );
  if (defaultIdentifierMatch) return defaultIdentifierMatch[1];

  return null;
}

export function wrapExampleWithCenteredPreview(code: string): string {
  if (code.includes("export default function CenteredPreview()")) {
    return code;
  }

  const componentName = getExportedComponentName(code);
  if (!componentName) {
    return code;
  }

  let nextCode = code;
  nextCode = nextCode.replace(
    /export\s+default\s+function\s+([A-Za-z_$][\w$]*)\s*\(/,
    "function $1(",
  );
  nextCode = nextCode.replace(
    /export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/,
    "const __ShadcnPlayDefaultComponent = $1;",
  );

  const renderTarget = nextCode.includes("__ShadcnPlayDefaultComponent")
    ? "__ShadcnPlayDefaultComponent"
    : componentName;

  return `${nextCode}\n\nexport default function CenteredPreview() {\n  return (\n    <div className=\"flex min-h-svh w-full items-center justify-center p-6\">\n      <${renderTarget} />\n    </div>\n  );\n}`;
}

export function readRawExampleFiles(examplesDir: string): RawExampleFile[] {
  return readdirSync(examplesDir)
    .filter((name) => name.endsWith(".tsx"))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => {
      const absolutePath = join(examplesDir, fileName);
      const code = readFileSync(absolutePath, "utf-8").trimEnd();
      const normalizedCode = normalizeExampleImports(code);
      const centeredCode = wrapExampleWithCenteredPreview(normalizedCode);

      return {
        fileName,
        sourcePath: `apps/v4/examples/base/${fileName}`,
        code: centeredCode,
      };
    });
}
