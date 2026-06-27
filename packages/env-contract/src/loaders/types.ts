export interface SchemaEntry {
  key: string;
  type: string;
  optional: boolean;
  default?: unknown;
  description?: string;
  scope: "server" | "client";
}

export interface Schema {
  entries: SchemaEntry[];
}

export interface SchemaLoader {
  /** Narrowing type guard: does this loader recognize the exported value? */
  matches: (mod: unknown) => boolean;
  /** Only called after `matches` returns true, so the loader may narrow. */
  introspect: (mod: unknown) => Schema;
}
