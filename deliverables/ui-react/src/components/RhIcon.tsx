import { RHDS_ICONS } from '../data/generated';

/** Red Hat icon set (ui) — inline SVG path data per the mock's icon standard
 *  (user decision 2026-11-13, defect row 75): icons come from @rhds/icons,
 *  inlined as path data, 1em sizing, currentColor. */
export function RhIcon({ name, size }: { name: keyof typeof RHDS_ICONS | string; size?: number }) {
  const icon = (RHDS_ICONS as Record<string, { vb: string; body: string }>)[name];
  if (!icon) return null;
  return (
    <svg
      className="fas"
      viewBox={icon.vb}
      aria-hidden="true"
      focusable="false"
      style={{ width: size ? `${size}px` : '1em', height: size ? `${size}px` : '1em', fill: 'currentColor', verticalAlign: '-0.125em' }}
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}
