


export function startOfToday(offsetMs: number = 1): Date {
  const d = new Date();
  d.setHours(0, 0, 0, offsetMs);
  return d;
}