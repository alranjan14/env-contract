import { z } from "zod";
import type { Schema, SchemaEntry } from "./types.js";

export function introspectZodSchema(obj: z.ZodObject<any>, scope: "server" | "client" = "server"): Schema {
  const entries: SchemaEntry[] = [];

  for (const [key, schema] of Object.entries(obj.shape)) {
    entries.push(introspectZodType(key, schema as z.ZodTypeAny, scope));
  }

  return { entries };
}

function introspectZodType(key: string, type: z.ZodTypeAny, scope: "server" | "client"): SchemaEntry {
  let current = type;
  let description: string | undefined = current.description;
  let defaultValue: any = undefined;
  let optional = false;

  // Walk the wrapper chain
  while (current) {
    const def = current._def || (current as any).def;
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

    if (typeName === "ZodEffects" || typeName === "effects" || typeName === "preprocess" || typeName === "transform" || typeName === "refine") {
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
    default: defaultValue,
    description,
    scope,
  };
}

function getFriendlyTypeName(type: z.ZodTypeAny): string {
  if (!type) return "unknown";
  const def = type._def || (type as any).def;
  if (!def) return "unknown";
  
  const typeName = def.typeName || def.type;

  if (!typeName) return "unknown";

  switch (typeName) {
    case "ZodString":
    case "string":
      if (def.checks?.some((c: any) => c.kind === "url" || c.format === "url")) return "url";
      if (def.checks?.some((c: any) => c.kind === "email" || c.format === "email")) return "email";
      if (def.checks?.some((c: any) => c.kind === "uuid" || c.format === "uuid")) return "uuid";
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

export const zodLoader = {
  matches: (obj: any): boolean => obj instanceof z.ZodObject,
  introspect: (obj: any): Schema => introspectZodSchema(obj),
};
