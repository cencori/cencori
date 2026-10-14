// GitHub-style alerts (`> [!NOTE]`, `> [!TIP]`, …) aren't part of CommonMark,
// so MDX renders them as a plain blockquote with the marker as literal text.
// Rewrite them into the docs <Alert>/<AlertContent> components instead.

type Node = {
  type: string;
  value?: string;
  children?: Node[];
  [key: string]: unknown;
};

const ALERTS: Record<string, { variant: string; title: string }> = {
  NOTE: { variant: "info", title: "Note" },
  TIP: { variant: "success", title: "Tip" },
  IMPORTANT: { variant: "default", title: "Important" },
  WARNING: { variant: "warning", title: "Warning" },
  CAUTION: { variant: "error", title: "Caution" },
};

const MARKER = /^\[!([A-Za-z]+)\][ \t]*(?:\r?\n)?/;

const attr = (name: string, value: string) => ({ type: "mdxJsxAttribute", name, value });

function toAlert(node: Node): Node | null {
  const first = node.children?.[0];
  const text = first?.type === "paragraph" ? first.children?.[0] : undefined;
  if (text?.type !== "text" || !text.value) return null;

  const match = MARKER.exec(text.value);
  const alert = match && ALERTS[match[1].toUpperCase()];
  if (!match || !alert) return null;

  text.value = text.value.slice(match[0].length);
  if (!text.value) first!.children!.shift();
  // Drop a leading line break left behind when the marker sat on its own line.
  if (first!.children![0]?.type === "break") first!.children!.shift();
  const body = first!.children!.length ? node.children! : node.children!.slice(1);

  return {
    type: "mdxJsxFlowElement",
    name: "Alert",
    attributes: [attr("variant", alert.variant), attr("title", alert.title)],
    children: [
      {
        type: "mdxJsxFlowElement",
        name: "AlertContent",
        attributes: [attr("variant", alert.variant)],
        children: body,
      },
    ],
  };
}

function walk(node: Node) {
  node.children?.forEach((child, i) => {
    const alert = child.type === "blockquote" ? toAlert(child) : null;
    if (alert) node.children![i] = alert;
    else walk(child);
  });
}

export function remarkGithubAlerts() {
  return (tree: Node) => walk(tree);
}
