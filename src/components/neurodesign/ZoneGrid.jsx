import React from 'react';

const ZONES = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const ZONE_LABELS = {
  'top-left': 'TL',
  'top-center': 'TC',
  'top-right': 'TR',
  'center-left': 'CL',
  'center': 'C',
  'center-right': 'CR',
  'bottom-left': 'BL',
  'bottom-center': 'BC',
  'bottom-right': 'BR',
};

/**
 * Grid 3x3 clicável para escolher zona da arte (ex.: onde fica o título).
 * value: '' = sistema decide; ou um de ZONES.
 * onChange(zoneId): '' ou zoneId.
 */
export function ZoneGrid({ value = '', onChange, 'aria-label': ariaLabel }) {
  const handleClick = (zoneId) => {
    const next = value === zoneId ? '' : zoneId;
    onChange?.(next);
  };

  return (
    <div className="inline-flex flex-col gap-1" role="group" aria-label={ariaLabel}>
      <div className="grid grid-cols-3 gap-0.5 w-[min(120px,28vw)]">
        {ZONES.map((zoneId) => (
          <button
            key={zoneId}
            type="button"
            onClick={() => handleClick(zoneId)}
            className={`
              h-8 min-w-[2rem] rounded border text-xs font-medium
              transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              ${value === zoneId
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }
            `}
            title={zoneId}
            aria-pressed={value === zoneId}
            aria-label={`Zona ${zoneId}`}
          >
            {ZONE_LABELS[zoneId]}
          </button>
        ))}
      </div>
      {value ? (
        <button
          type="button"
          onClick={() => onChange?.('')}
          className="text-xs text-muted-foreground hover:text-foreground underline self-start"
        >
          Sistema decide
        </button>
      ) : null}
    </div>
  );
}

export { ZONES, ZONE_LABELS };
