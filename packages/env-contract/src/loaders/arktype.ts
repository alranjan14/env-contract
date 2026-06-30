// NOTE: navigates ArkType's internal `inner.structure.propsByKey` shapes (not
// publicly typed). `any` here is quarantined in eslint.config.js.
import type { Schema, SchemaEntry } from "./types.js";

export function introspectArkTypeSchema(obj: any, scope: "server" | "client" = "server"): Schema {
  const entries: SchemaEntry[] = [];

  const props = obj.inner?.structure?.propsByKey || obj.propsByKey || {};

  for (const [key, prop] of Object.entries<any>(props)) {
    const isOptional = prop.kind === "optional" || prop.default !== undefined;
    const typeExpr = prop.value?.expression || "unknown";
    const description = prop.value?.description || prop.value?.meta?.description;
    const defaultValue = prop.default;

    entries.push({
      key,
      type: typeExpr,
      optional: isOptional,
      scope,
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
      ...(description ? { description } : {}),
    });
  }

  return { entries };
}

export const arktypeLoader = {
  matches: (obj: any): boolean => {
    return (
      obj &&
      typeof obj === "function" &&
      typeof obj.expression === "string" &&
      !!(obj.inner?.structure?.propsByKey || obj.propsByKey)
    );
  },
  introspect: (obj: any): Schema => introspectArkTypeSchema(obj),
};
