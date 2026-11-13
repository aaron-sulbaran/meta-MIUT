// Muse copies the flyer's words into the food note, so it arrives as "FREE PIZZA".
// Free is its own field, and shouting reads badly on the event page and in the
// alert ("Free free pizza"). Client safe.
export function tidyFoodNote(note: string | undefined): string {
  let text = (note ?? "").trim().replace(/^free\s+/i, "").trim();
  if (text && text === text.toUpperCase() && /[A-Z]/.test(text)) text = text.toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}
