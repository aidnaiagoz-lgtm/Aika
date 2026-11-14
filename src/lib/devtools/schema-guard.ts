/**
 * Schema guard — `prisma/schema.prisma` өзгерісі тек ҚОСАТЫН болуын тексереді.
 *
 * База ортақ және нақты: Vercel build `prisma db push` жасайды, сондықтан PR-дағы
 * схема бірден прод базаға тиеді. Бұл тексеріс CI-да base (main) мен PR схемасын
 * салыстырып, деректі жоғалтуы мүмкін өзгерістерді тоқтатады:
 *  - модель / кесте (`@@map`) өшірілсе немесе аты өзгерсе;
 *  - баған (скаляр өріс) өшірілсе, аты не `@map` өзгерсе, типі ауысса;
 *  - nullable баған міндетті (required) болса;
 *  - бар модельге `@default`-сыз міндетті баған қосылса (бос емес кестеде push құлайды);
 *  - enum немесе оның мәні өшірілсе.
 * Relation өрістері (басқа модельге сілтеме, тізімдер) баған емес — оларға тиіспейміз.
 */

const SCALARS = new Set(["String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes"]);

export interface Field {
  name: string;
  type: string; // базалық тип, `?` / `[]`-сыз
  optional: boolean;
  list: boolean;
  hasDefault: boolean;
  unique: boolean;
  column: string; // @map болса — сол, әйтпесе өріс аты
  updatedAt: boolean;
}

export interface ParsedSchema {
  models: Map<string, { table: string; fields: Map<string, Field>; uniques: Set<string> }>;
  enums: Map<string, Set<string>>;
}

function stripComment(line: string): string {
  // `//` комментарийін кесеміз, бірақ жол ішіндегі "..." мәтінге тимейміз
  let inStr = false;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (ch === '"' && line[i - 1] !== "\\") inStr = !inStr;
    if (!inStr && ch === "/" && line[i + 1] === "/") return line.slice(0, i);
  }
  return line;
}

export function parseSchema(text: string): ParsedSchema {
  const models: ParsedSchema["models"] = new Map();
  const enums: ParsedSchema["enums"] = new Map();
  const lines = text.split(/\r?\n/).map(stripComment);

  let block: { kind: "model" | "enum"; name: string } | null = null;
  let modelFields = new Map<string, Field>();
  let table = "";
  let uniques = new Set<string>();
  let enumValues = new Set<string>();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (!block) {
      const m = /^(model|enum)\s+(\w+)\s*\{/.exec(line);
      if (m) {
        block = { kind: m[1] as "model" | "enum", name: m[2] };
        modelFields = new Map();
        uniques = new Set();
        enumValues = new Set();
        table = m[2];
      }
      continue;
    }

    if (line.startsWith("}")) {
      if (block.kind === "model") models.set(block.name, { table, fields: modelFields, uniques });
      else enums.set(block.name, enumValues);
      block = null;
      continue;
    }

    if (block.kind === "enum") {
      if (line.startsWith("@@")) continue;
      const v = /^(\w+)/.exec(line);
      if (v) enumValues.add(v[1]);
      continue;
    }

    // model ішінде
    if (line.startsWith("@@")) {
      const map = /^@@map\(\s*"([^"]+)"/.exec(line);
      if (map) table = map[1];
      const uq = /^@@unique\(\s*\[([^\]]+)\]/.exec(line);
      if (uq) uniques.add(uq[1].replace(/\s+/g, ""));
      continue;
    }
    const f = /^(\w+)\s+([\w.]+(?:\([^)]*\))?)(\[\])?(\?)?(.*)$/.exec(line);
    if (!f) continue;
    const [, name, type, list, opt, rest] = f;
    const mapAttr = /@map\(\s*"([^"]+)"/.exec(rest);
    modelFields.set(name, {
      name,
      type,
      optional: !!opt,
      list: !!list,
      hasDefault: /@default\(/.test(rest),
      unique: /@unique\b/.test(rest),
      column: mapAttr ? mapAttr[1] : name,
      updatedAt: /@updatedAt\b/.test(rest),
    });
  }
  return { models, enums };
}

function isColumn(field: Field, enums: Set<string>): boolean {
  if (field.type.startsWith("Unsupported(")) return true;
  if (field.list) return SCALARS.has(field.type) || enums.has(field.type); // scalar list (Postgres array)
  return SCALARS.has(field.type) || enums.has(field.type);
}

/** Деректі жоғалтуы мүмкін өзгерістердің тізімін қайтарады (бос болса — бәрі жақсы). */
export function findDestructiveChanges(baseText: string, headText: string): string[] {
  const base = parseSchema(baseText);
  const head = parseSchema(headText);
  const baseEnums = new Set(base.enums.keys());
  const headEnums = new Set(head.enums.keys());
  const problems: string[] = [];

  for (const [name, values] of base.enums) {
    const next = head.enums.get(name);
    if (!next) {
      problems.push(`enum ${name} өшірілген (немесе аты өзгерген)`);
      continue;
    }
    for (const v of values) if (!next.has(v)) problems.push(`enum ${name}: «${v}» мәні өшірілген`);
  }

  for (const [name, model] of base.models) {
    const next = head.models.get(name);
    if (!next) {
      problems.push(`model ${name} (кесте «${model.table}») өшірілген немесе аты өзгерген`);
      continue;
    }
    if (next.table !== model.table) {
      problems.push(`model ${name}: кесте аты «${model.table}» → «${next.table}» (@@map) — ескі деректер жоғалады`);
    }
    for (const [fname, field] of model.fields) {
      if (!isColumn(field, baseEnums)) continue;
      const nf = next.fields.get(fname);
      if (!nf) {
        problems.push(`${name}.${fname} бағаны өшірілген немесе аты өзгерген`);
        continue;
      }
      if (nf.column !== field.column) {
        problems.push(`${name}.${fname}: баған аты «${field.column}» → «${nf.column}» (@map)`);
      }
      if (nf.type !== field.type || nf.list !== field.list) {
        problems.push(`${name}.${fname}: типі ${field.type}${field.list ? "[]" : ""} → ${nf.type}${nf.list ? "[]" : ""}`);
      }
      if (field.optional && !nf.optional) {
        problems.push(`${name}.${fname}: бұрын бос болуы мүмкін еді, енді міндетті (бос жолдар push-ты құлатады)`);
      }
    }
    for (const [fname, nf] of next.fields) {
      const old = model.fields.get(fname);
      if (nf.unique && !old?.unique) {
        problems.push(`${name}.${fname}: бар кестеге жаңа @unique — prisma db push «data loss» ескертуімен тоқтайды (@@index қолданыңыз)`);
      }
      if (model.fields.has(fname)) continue;
      if (!isColumn(nf, headEnums)) continue;
      if (!nf.optional && !nf.list && !nf.hasDefault && !nf.updatedAt) {
        problems.push(`${name}.${fname}: жаңа міндетті баған @default-сыз — «?» немесе @default(...) қосыңыз`);
      }
    }
  }
  for (const [name, model] of base.models) {
    const next = head.models.get(name);
    if (!next) continue;
    for (const u of next.uniques) {
      if (!model.uniques.has(u)) problems.push(`${name}: бар кестеге жаңа @@unique([${u}]) — prisma db push «data loss» ескертуімен тоқтайды`);
    }
  }
  return problems;
}
