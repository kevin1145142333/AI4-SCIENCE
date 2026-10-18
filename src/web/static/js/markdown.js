// 轻量 Markdown 渲染器（无外部依赖，输出已转义的安全 HTML）

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function tableRow(line) {
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
  return cells.map((c) => `<td>${inline(c)}</td>`).join("");
}

function renderTable(lines, i) {
  const header = tableRow(lines[i]).replaceAll("<td>", "<th>").replaceAll("</td>", "</th>");
  const body = [];
  let j = i + 2; // 跳过分隔行
  while (j < lines.length && lines[j].trim().startsWith("|")) {
    body.push(`<tr>${tableRow(lines[j])}</tr>`);
    j++;
  }
  return { html: `<table><thead><tr>${header}</tr></thead><tbody>${body.join("")}</tbody></table>`, next: j };
}

export function renderMarkdown(md) {
  const source = String(md ?? "").replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  const out = [];
  let listType = null;
  let code = [];
  let inCode = false;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    if (trimmed.startsWith("|")) {
      closeList();
      const result = renderTable(lines, i);
      out.push(result.html);
      i = result.next - 1;
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed)) {
      closeList();
      const level = trimmed.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(trimmed.replace(/^#+\s*/, ""))}</h${level}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      closeList();
      out.push("<hr>");
      continue;
    }
    if (trimmed.startsWith(">")) {
      closeList();
      out.push(`<blockquote>${inline(trimmed.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    const ul = trimmed.match(/^[-*]\s+(.*)/);
    const ol = trimmed.match(/^\d+\.\s+(.*)/);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (listType !== type) {
        closeList();
        listType = type;
        out.push(`<${type}>`);
      }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(trimmed)}</p>`);
  }
  closeList();
  if (inCode) out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
  return out.join("\n");
}
