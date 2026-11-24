import {
  BERRY_PILES,
  FESTIVAL_FACILITIES,
  FESTIVAL_RANKS,
  ROTO_POWERS,
  getBerryLocationLabel,
  getBerryNameLabel,
  getRotoPowerLabel,
} from '../../data/miscGen7';
import type { GameVersionId } from '../../engine/core/types';
import type { MiscSettings } from '../../engine/gen7/misc7';
import { useApp } from '../../store/AppContext';
import { NumberStepper } from '../common/NumberStepper';

export const miscSelectClass = 'mt-1 w-full h-11 min-w-0 rounded-xl bg-zinc-950 border border-zinc-800 px-2.5 text-xs font-medium text-zinc-100';

const VERSIONS = { S: 'Sun', M: 'Moon', US: 'Ultra Sun', UM: 'Ultra Moon' };

type Option = readonly [value: number | string, label: string];

function SelectField({ label, value, options, onChange }: {
  label: string;
  value: number | string;
  options: readonly Option[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0 text-xs font-medium text-zinc-300">
      {label}
      <select className={miscSelectClass} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
}

export function MiscToolFields({ settings, onChange }: {
  settings: MiscSettings;
  onChange: (settings: MiscSettings) => void;
}) {
  const { i18n, lang } = useApp();
  const any = ['', i18n.t('misc.any')] as const;
  const choices = (length: number, offset = 0) =>
    Array.from({ length }, (_, i) => [i + offset, String(i + offset)] as const);
  const optionalNumber = (value: string) => value === '' ? undefined : Number(value);

  switch (settings.kind) {
    case 'pokerus':
      return null;
    case 'festival':
    case 'battleTree':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <SelectField label={i18n.t('misc.game')} value={settings.game} options={Object.entries(VERSIONS)}
              onChange={value => onChange({ ...settings, game: value as GameVersionId })} />
            {settings.kind === 'festival' && (
              <SelectField label={i18n.t('misc.rank')} value={settings.rank}
                options={FESTIVAL_RANKS.map((rank, i) => [i, rank])}
                onChange={value => onChange({ ...settings, rank: Number(value) })} />
            )}
            {settings.kind === 'battleTree' && (
              <NumberStepper label={i18n.t('misc.streak')} value={settings.streak} min={1} max={10000}
                onChange={streak => onChange({ ...settings, streak })} />
            )}
          </div>
          <details className="rounded-xl border border-zinc-800 px-3">
            <summary className="cursor-pointer py-2.5 text-xs font-semibold text-zinc-300">{i18n.t('search.filters')}</summary>
            {settings.kind === 'festival' ? (
              <div className="space-y-2 pb-3">
                <SelectField label={i18n.t('misc.facility')} value={settings.filters.facility ?? ''}
                  options={[any, ...FESTIVAL_FACILITIES.map((name, i) => [i, name] as const)]}
                  onChange={value => onChange({ ...settings, filters: { ...settings.filters, facility: optionalNumber(value) } })} />
                <div className="grid grid-cols-3 gap-2">
                  {([['stars', 5, 1], ['npc', 12, 0], ['color', 4, 0]] as const).map(([key, count, offset]) => (
                    <SelectField key={key} label={i18n.t(`misc.${key}`)} value={settings.filters[key] ?? ''}
                      options={[any, ...choices(count, offset)]}
                      onChange={value => onChange({ ...settings, filters: { ...settings.filters, [key]: optionalNumber(value) } })} />
                  ))}
                </div>
              </div>
            ) : (
              <label className="block pb-3 text-xs font-medium text-zinc-300">
                {i18n.t('misc.trainerId')}
                <input type="number" inputMode="numeric" min={0} max={208} className={miscSelectClass}
                  placeholder={i18n.t('misc.any')} value={settings.trainerId ?? ''}
                  onChange={event => {
                    const id = optionalNumber(event.target.value);
                    if (id === undefined || (Number.isInteger(id) && id >= 0 && id <= 208)) {
                      onChange({ ...settings, trainerId: id });
                    }
                  }} />
              </label>
            )}
          </details>
        </div>
      );
    case 'rotoLoto':
      return <SelectField label={i18n.t('misc.power')} value={settings.target ?? ''}
        options={[any, ...ROTO_POWERS.map((_, i) => [i, getRotoPowerLabel(i, lang)] as const)]}
        onChange={value => onChange({ ...settings, target: optionalNumber(value) })} />;
    case 'berries': {
      const pile = BERRY_PILES[settings.location]!;
      return (
        <div className="space-y-2">
          <SelectField label={i18n.t('misc.location')} value={settings.location}
            options={BERRY_PILES.map((_, i) => [i, getBerryLocationLabel(i, lang)])}
            onChange={value => onChange({ kind: 'berries', location: Number(value) })} />
          {pile.first && (
            <p className="text-xs text-zinc-400">
              {i18n.t('misc.firstBerry', { berry: getBerryNameLabel(pile.first, lang) })}
            </p>
          )}
          <SelectField label={i18n.t('misc.berry')} value={settings.target ?? ''}
            options={[any, ...Array.from(new Set(pile.berries), berry => [berry, getBerryNameLabel(berry, lang)] as const)]}
            onChange={value => onChange({ ...settings, target: value || undefined })} />
        </div>
      );
    }
  }
}
