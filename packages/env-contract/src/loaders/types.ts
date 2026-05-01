export interface SchemaEntry {
  key: string;
  type: string;
  optional: boolean;
  default?: any;
  description?: string;
  scope: "server" | "client";
}

export interface Schema {
  entries: SchemaEntry[];
}

export interface SchemaLoader {
  matches: (mod: any) => boolean;
  introspect: (mod: any) => Schema;
}
