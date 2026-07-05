/**
 * Maps a domain status string to a Badge tone. Restricted to the palette's
 * semantic set (green=success, amber=warning, red=error, blue=info, slate=
 * neutral) — no extra brand colors, per the design system.
 */
const TONE_MAP: Record<string, 'slate' | 'blue' | 'amber' | 'green' | 'red'> = {
  // generic
  planning: 'slate',
  pending: 'amber',
  todo: 'slate',
  draft: 'slate',
  // in-progress-ish
  in_progress: 'blue',
  ordered: 'blue',
  sent: 'blue',
  review: 'blue',
  partial: 'amber',
  partially_paid: 'amber',
  half_day: 'amber',
  on_hold: 'amber',
  // success
  completed: 'green',
  delivered: 'green',
  paid: 'green',
  present: 'green',
  // danger
  cancelled: 'red',
  blocked: 'red',
  overdue: 'red',
  absent: 'red',
  high: 'red',
  urgent: 'red',
  // low-key
  leave: 'blue',
  low: 'slate',
  medium: 'amber',
};

export function statusTone(status: string): 'slate' | 'blue' | 'amber' | 'green' | 'red' {
  return TONE_MAP[status] ?? 'slate';
}
