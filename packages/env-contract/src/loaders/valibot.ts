// NOTE: navigates Valibot's internal action/pipe shapes (not publicly typed).
// `any` here is quarantined in eslint.config.js.
import type { Schema, SchemaEntry } from "./types.js";

export function introspectValibotSchema(obj: any, scope: "server" | "client" = "server"): Schema {
  const entries: SchemaEntry[] = [];

  for (const [key, schema] of Object.entries(obj.entries || {})) {
    entries.push(introspectValibotType(key, schema, scope));
  }

  return { entries };
}

function introspectValibotType(key: string, typeObj: any, scope: "server" | "client"): SchemaEntry {
  let current = typeObj;
  let description: string | undefined = undefined;
  let defaultValue: any = undefined;
  let optional = false;

  while (current) {
    if (
      current.message &&
      typeof current.message === "string" &&
      !current.message.includes("Invalid type")
    ) {
      description = current.message;
    }

    if (current.type === "optional") {
      optional = true;
      if (current.default !== undefined) {
        defaultValue = current.default;
      }
      current = current.wrapped;
      continue;
    }

    if (current.type === "nullable" || current.type === "nullish") {
      optional = true;
      current = current.wrapped;
      continue;
    }

    if (current.type === "pipe" || current.type === "transform") {
      current = current.item || current.wrapped;
      continue;
    }

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

function getFriendlyTypeName(typeObj: any): string {
  if (!typeObj || !typeObj.type) return "unknown";

  const typeName = typeObj.type;

  switch (typeName) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "enum":
      return "enum";
    case "array":
      return `array(${getFriendlyTypeName(typeObj.item)})`;
    default:
      return typeof typeName === "string" ? typeName : "unknown";
  }
}

export const valibotLoader = {
  matches: (obj: any): boolean => {
    return (
      obj &&
      typeof obj === "object" &&
      obj.type === "object" &&
      obj["~standard"]?.vendor === "valibot"
    );
  },
  introspect: (obj: any): Schema => introspectValibotSchema(obj),
};
