/** "2 Litres of Milk" and "milk" should land on the same pantry item. */
export function pantryKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(a|an|the|some|of|fresh|packet|pack|bottle|bottles|bag|bags|box)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ies$/, "y")
    .replace(/oes$/, "o")
    .replace(/([^s])s$/, "$1");
}

export function displayName(name: string): string {
  const n = name.trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}
