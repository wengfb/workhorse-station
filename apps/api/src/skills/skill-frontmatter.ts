export type ParsedFrontmatter = {
  name: string;
  description: string;
  body: string;
};

export function parseFrontmatter(raw: string): ParsedFrontmatter | null {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!fmMatch) return null;

  const fmBlock = fmMatch[1];
  const body = raw.slice(fmMatch[0].length).trim();
  const name = extractYamlString(fmBlock, "name");
  const description = extractYamlString(fmBlock, "description");

  return { name, description, body };
}

function extractYamlString(block: string, key: string): string {
  const lines = block.split("\n");
  let collecting = false;
  let value = "";
  let indent = "";

  for (const line of lines) {
    if (!collecting) {
      const match = line.match(new RegExp(`^${key}:\\s*(.*)`));
      if (match) {
        const rest = match[1].trim();
        if (rest === ">" || rest === "|") {
          collecting = true;
          const keyMatch = line.match(/^(\s*)/);
          indent = keyMatch ? keyMatch[1] + "  " : "  ";
          continue;
        }
        return rest;
      }
    } else {
      if (!line.startsWith(indent) && line.trim() !== "") {
        break;
      }
      const content = line.startsWith(indent) ? line.slice(indent.length) : line.trim();
      value += (value ? " " : "") + content;
    }
  }

  return value.trim();
}
