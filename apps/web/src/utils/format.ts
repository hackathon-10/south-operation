/** עזרי תצוגה בעברית: תאריכים, זמנים וכמויות. */

const dateTimeFormatter = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' });

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return dateTimeFormatter.format(new Date(value));
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  return dateFormatter.format(new Date(value));
}

export function formatTime(value?: string | null): string {
  if (!value) return '—';
  return timeFormatter.format(new Date(value));
}

/** "לפני 3 שעות" / "בעוד יומיים" - טקסט יחסי קצר וברור. */
export function formatRelative(value?: string | null): string {
  if (!value) return '—';
  const diffMs = new Date(value).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 1) return 'עכשיו';
  if (absMinutes < 60) {
    return diffMinutes < 0 ? `לפני ${absMinutes} דקות` : `בעוד ${absMinutes} דקות`;
  }

  const hours = Math.round(absMinutes / 60);
  if (hours < 24) return diffMinutes < 0 ? `לפני ${hours} שעות` : `בעוד ${hours} שעות`;

  const days = Math.round(hours / 24);
  if (days === 1) return diffMinutes < 0 ? 'אתמול' : 'מחר';
  return diffMinutes < 0 ? `לפני ${days} ימים` : `בעוד ${days} ימים`;
}

export function formatMinutes(minutes?: number | null): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${Math.round(minutes)} דק׳`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hours} שע׳` : `${hours} שע׳ ${rest} דק׳`;
}

export function formatUnits(count: number): string {
  if (count === 1) return 'פריט אחד';
  return `${count} פריטים`;
}

export function formatKm(value?: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('he-IL', { maximumFractionDigits: 1 })} ק״מ`;
}

/** יעד בפורמט בולט: בניין → קומה → חדר. */
export function formatDestination(destination: {
  building: string;
  floor: string;
  roomNumber: string;
}): string {
  return `${destination.building} · קומה ${destination.floor} · חדר ${destination.roomNumber}`;
}

export function initials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}
