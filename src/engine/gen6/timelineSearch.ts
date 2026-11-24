import { timeline6, type Timeline6Request, type TimelineRow6 } from './tinyTimeline';
import type { Search6Output } from './searches';

export function searchTimeline6(q: Timeline6Request, progress?: (n: number) => void): Search6Output<TimelineRow6> {
  const rows: TimelineRow6[] = [];
  const start = q.calls[0]?.frame ?? 0;
  for (const row of timeline6(q)) {
    if (rows.length === 5000) return { rows, truncated: true };
    rows.push(row);
    progress?.(Math.min(99, Math.floor(100 * (row.end - start) / Math.max(1, q.maxFrame-start))));
  }
  return { rows, truncated: false };
}
