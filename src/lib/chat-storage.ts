export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function deriveTitle(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 48 ? clean.slice(0, 48) + "…" : clean || "New chat";
}
