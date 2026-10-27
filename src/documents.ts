import fs from "node:fs";
import path from "node:path";
export function saveDocuments(key: string, brd: string, frd: string, erd: string): string[] {
  const dir = path.resolve("brd_output");
  fs.mkdirSync(dir, { recursive: true });
  const docs = {
    [`Insurance_BRD_${key}.md`]: brd,
    [`Insurance_FRD_${key}.md`]: frd,
    [`Insurance_ERD_${key}.md`]: erd,
  };
  return Object.entries(docs).map(([name, text]) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, text, "utf8");
    return file;
  });
}
