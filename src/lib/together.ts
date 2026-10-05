// Days-together math and the anniversary calendar.

const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Whole calendar days since the Nubkin hatched (0 on hatch day).
export function daysSince(createdAt: string, now = new Date()): number {
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(new Date(createdAt))) / MS_PER_DAY));
}

// "Day N together" — hatch day is Day 1.
export function dayNumber(createdAt: string, now = new Date()): number {
  return daysSince(createdAt, now) + 1;
}

export interface Anniversary {
  days: number;   // days since hatching
  title: string;  // e.g. "1 Week Together!"
  isBirthday: boolean;
}

const MILESTONES: Anniversary[] = [
  { days: 7,   title: '1 Week Together!',   isBirthday: false },
  { days: 30,  title: '1 Month Together!',  isBirthday: false },
  { days: 100, title: '100 Days Together!', isBirthday: false },
];

// Milestones reached but not yet celebrated, oldest first. Yearly birthdays
// (365, 730, …) are included after the fixed milestones.
export function pendingAnniversaries(createdAt: string, celebrated: number[] = []): Anniversary[] {
  const elapsed = daysSince(createdAt);
  const out = MILESTONES.filter(m => elapsed >= m.days && !celebrated.includes(m.days));
  for (let year = 1; year * 365 <= elapsed; year++) {
    const days = year * 365;
    if (celebrated.includes(days)) continue;
    out.push({ days, title: year === 1 ? 'Happy 1st Birthday!' : `Happy Birthday #${year}!`, isBirthday: true });
  }
  return out.sort((a, b) => a.days - b.days);
}

// The next milestone still ahead, for a "next surprise in N days" hint.
export function nextAnniversary(createdAt: string): Anniversary | null {
  const elapsed = daysSince(createdAt);
  const upcoming = MILESTONES.find(m => m.days > elapsed);
  if (upcoming) return upcoming;
  const year = Math.floor(elapsed / 365) + 1;
  return { days: year * 365, title: 'Birthday', isBirthday: true };
}
