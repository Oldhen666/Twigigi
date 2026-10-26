declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }

  export class StatementSync {
    get(...params: Array<string | number | null>): unknown;
    all(...params: Array<string | number | null>): unknown[];
    run(...params: Array<string | number | null>): {
      changes: number;
      lastInsertRowid: number | bigint;
    };
  }
}
