/** Kobo → formatted NGN string, integer arithmetic only */
export function formatKobo(kobo: number): string {
  const nairaStr = String(kobo);
  const wholePart = nairaStr.slice(0, -2) || "0";
  const koboPart = nairaStr.slice(-2).padStart(2, "0");
  const formatted = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `₦${formatted}.${koboPart}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
