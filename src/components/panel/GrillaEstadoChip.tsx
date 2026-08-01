'use client';

import {
  ESTADO_GRILLA_COLOR,
  ESTADO_GRILLA_LABEL,
  normalizeEstadoGrilla,
} from '@/lib/grilla-estado';

export function GrillaEstadoChip({
  estado,
  className = '',
}: {
  estado: string | null | undefined;
  className?: string;
}) {
  const key = normalizeEstadoGrilla(estado);
  const color = ESTADO_GRILLA_COLOR[key];
  return (
    <span
      className={`grilla-estado-chip ${className}`.trim()}
      style={{
        borderColor: color,
        color,
        background: `${color}14`,
      }}
    >
      {ESTADO_GRILLA_LABEL[key]}
    </span>
  );
}
