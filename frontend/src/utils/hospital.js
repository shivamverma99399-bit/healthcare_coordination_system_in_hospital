export function getBedStatus(bedsAvailable) {
  if (bedsAvailable > 10) {
    return { label: "Available", tone: "green" };
  }

  if (bedsAvailable > 0) {
    return { label: "Limited", tone: "yellow" };
  }

  return { label: "Critical", tone: "red" };
}


export function formatTag(tag) {
  return String(tag).replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
