// NOTE: navigates Zod's internal `_def`/`def` shapes (which differ across v3/v4
// and are not publicly typed). `any` here is quarantined in eslint.config.js;
// see M4 in TODO.md for the typed-introspection follow-up. Public boundary is `unknown`.
import type { Schema, SchemaEntry } from "./types.js";

type ZodLikeSchema = {
  _def?: Record<string, any>;
  def?: Record<string, any>;
  shape?: Record<string, unknown>;
  description?: string;
  parse?: unknown;
  safeParse?: unknown;
  constructor?: { name?: string };
};

export function introspectZodSchema(
  obj: ZodLikeSchema,
  scope: "server" | "client" = "server",
): Schema {
  const entries: SchemaEntry[] = [];
  const shape = getObjectShape(obj) ?? {};

  for (const [key, schema] of Object.entries(shape)) {
    entries.push(introspectZodType(key, schema as ZodLikeSchema, scope));
  }

  return { entries };
}

function introspectZodType(
  key: string,
  type: ZodLikeSchema,
  scope: "server" | "client",
): SchemaEntry {
  let current = type;
  let description: string | undefined = current.description;
  let defaultValue: any = undefined;
  let optional = false;

  // Walk the wrapper chain
  while (current) {
    const def = (current as any)._def || (current as any).def;
    if (!def) break;

    const typeName = def.typeName || def.type;

    if (def.description && !description) {
      description = def.description;
    }

    if (typeName === "ZodOptional" || typeName === "optional") {
      optional = true;
      current = def.innerType || def.schema;
      continue;
    }

    if (typeName === "ZodDefault" || typeName === "default") {
      optional = true;
      defaultValue = typeof def.defaultValue === "function" ? def.defaultValue() : def.defaultValue;
      current = def.innerType || def.schema;
      continue;
    }

    if (typeName === "ZodNullable" || typeName === "nullable") {
      optional = true;
      current = def.innerType || def.schema;
      continue;
    }

    if (
      typeName === "ZodEffects" ||
      typeName === "effects" ||
      typeName === "preprocess" ||
      typeName === "transform" ||
      typeName === "refine"
    ) {
      current = def.schema;
      continue;
    }

    if (typeName === "ZodLazy" || typeName === "lazy") {
      current = def.getter();
      continue;
    }

    if (typeName === "ZodBranded" || typeName === "branded") {
      current = def.type || def.schema;
      continue;
    }

    // If we reach a terminal type, stop
    break;
  }

  return {
    key,
    type: getFriendlyTypeName(current),
    optional,
    scope,
    ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    ...(description !== undefined ? { description } : {}),
  };
}

function getFriendlyTypeName(type: ZodLikeSchema): string {
  if (!type) return "unknown";
  const def = getDef(type);
  if (!def) return "unknown";

  const typeName = def.typeName || def.type;

  if (!typeName) return "unknown";

  switch (typeName) {
    case "ZodString":
    case "string":
      if (hasStringFormat(type, def, "url")) return "url";
      if (hasStringFormat(type, def, "email")) return "email";
      if (hasStringFormat(type, def, "uuid")) return "uuid";
      return "string";
    case "ZodNumber":
    case "number":
      return "number";
    case "ZodBoolean":
    case "boolean":
      return "boolean";
    case "ZodEnum":
    case "enum":
      if (def.values) return `enum(${def.values.join(" | ")})`;
      if (def.entries) return `enum(${Object.values(def.entries).join(" | ")})`;
      return "enum";
    case "ZodNativeEnum":
    case "nativeEnum":
      return "enum";
    case "ZodArray":
    case "array":
      return `array(${getFriendlyTypeName(def.type || def.schema)})`;
    default:
      return typeof typeName === "string" ? typeName.replace(/^Zod/, "").toLowerCase() : "unknown";
  }
}

function isZodObject(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;

  const def = getDef(obj);
  const typeName = def?.typeName || def?.type;
  const shape = getObjectShape(obj);

  return (
    shape !== undefined &&
    (typeName === "ZodObject" || typeName === "object" || obj.constructor?.name === "ZodObject") &&
    (typeof obj.parse === "function" || typeof obj.safeParse === "function")
  );
}

function getDef(schema: ZodLikeSchema | undefined): Record<string, any> | undefined {
  return schema?._def || schema?.def;
}

function getObjectShape(obj: ZodLikeSchema): Record<string, unknown> | undefined {
  if (obj.shape && typeof obj.shape === "object") {
    return obj.shape;
  }

  const def = getDef(obj);
  if (!def) return undefined;

  if (typeof def.shape === "function") {
    return def.shape();
  }

  if (def.shape && typeof def.shape === "object") {
    return def.shape;
  }

  return undefined;
}

function hasStringFormat(type: ZodLikeSchema, def: Record<string, any>, format: string): boolean {
  if ((type as any).format === format || def.format === format) return true;

  return def.checks?.some((check: any) => {
    return (
      check?.kind === format ||
      check?.format === format ||
      check?._zod?.def?.check === format ||
      check?._zod?.def?.format === format
    );
  });
}

export const zodLoader = {
  matches: isZodObject,
  introspect: (obj: any): Schema => introspectZodSchema(obj),
};
