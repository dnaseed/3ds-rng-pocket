import { getStationary6Categories, getStationary6Traits, type Stationary6Game } from '../../data/stationary6Catalog';
import { getGenderRatio, getHiddenPowerValue, getPRV, getPSV, isRandomGender, MAX_FRAME } from '../core/pokemonMath';
import type { RngResultBase } from '../core/types';
import { MT19937 } from '../rng/mt19937';

import { timeline6, type Timeline6Request } from './tinyTimeline';

interface Stationary6ManualSettings {
  genderRatio?: number;
  ability?: 0 | 1 | 2 | 3;
  perfectIVs?: boolean;
  alwaysSync?: boolean;
  shinyLocked?: boolean;
}

export interface Stationary6SearchRequest {
  seed: number;
  game: Stationary6Game;
  preset: string;
  minFrame: number;
  maxFrame: number;
  targetFrame: number;
  considerDelay: boolean;
  timeline?: Timeline6Request;
  tsv: number;
  trv: number;
  shinyCharm: boolean;
  syncNature?: number;
  assumeSynced?: boolean;
  delay?: number;
  level?: number;
  forceShiny?: boolean;
  manual?: Stationary6ManualSettings;
  bankTarget?: number;
  /** Transporter entries before the target: 0 fixed gender, 1 random gender, 2 Mew/Celebi. */
  transporterHistory?: readonly (0 | 1 | 2)[];
}

export interface Stationary6Row extends RngResultBase {
  kind: 'stationary';
  frame: number;
  shift: number;
  elapsedFrames: number;
  rand: number;
  state: number;
  delay: number;
  framesUsed: number;
}

/** Gen 6 bounded rolls use the high word of the product. The small bounds here are exact in a JS number. */
function boundedRoll(word: number, bound: 6 | 25 | 252): number {
  return Math.floor((word * bound) / 0x100000000);
}

/** Searches a normal frame range using the selected Gen 6 template. */
export function* searchStationary6(request: Stationary6SearchRequest): Generator<Stationary6Row> {
  const { seed, minFrame, maxFrame, targetFrame, trv, syncNature } = request;
  if (!Number.isInteger(minFrame) || !Number.isInteger(maxFrame) ||
      minFrame < 0 || minFrame > maxFrame || maxFrame > MAX_FRAME) {
    throw new RangeError('Invalid stationary frame range');
  }

  const preset = getStationary6Categories(request.game).flatMap(category => category.list)
    .find(entry => entry.id === request.preset);
  if (!preset) throw new RangeError('Stationary preset is unavailable in this game');

  const traits = getStationary6Traits(preset);
  const manual = preset.conceptual ? request.manual : undefined;
  const iv3 = preset.conceptual ? manual?.perfectIVs ?? traits.iv3 : traits.iv3 && !preset.egg;
  const alwaysSync = manual?.alwaysSync ?? traits.alwaysSync;
  const forceShiny = request.forceShiny === true;
  const shinyLocked = forceShiny || (manual?.shinyLocked ?? traits.shinyLocked);
  const tsv = preset.otTsv ?? request.tsv;
  const pidRolls = request.shinyCharm && !shinyLocked && !alwaysSync ? 3 : 1;
  const nature = preset.nature < 25 ? preset.nature : traits.syncable ? syncNature : undefined;
  const calibration = request.timeline;
  if (calibration && maxFrame < calibration.calls[0]!.frame + 2) return;
  const spans = calibration && timeline6({
    ...calibration, maxFrame, split: true, delay: calibration.split ? calibration.delay : 0,
  });
  let span = spans?.next();
  const genderRatio = manual?.genderRatio ?? (preset.species === 0 ? 0x7f : traits.genderRatio);
  const gender = getGenderRatio(genderRatio);
  const randomGender = isRandomGender(genderRatio);
  const fixedAbility = manual?.ability ?? Math.min(preset.ability, 3);
  const level = preset.level || (request.level ?? 0);
  const delay = request.considerDelay ? (request.delay ?? preset.delay) : 0;
  if (!Number.isInteger(delay) || delay < 0 || delay > 4000) throw new RangeError('Invalid stationary delay');
  const target = preset.bank ? request.bankTarget ?? 1 : 1;
  if (!Number.isInteger(target) || target < 1 || target > preset.numOfPkm) {
    throw new RangeError('Invalid Pokémon Link or Transporter target');
  }
  const transporter = request.game === 'VC';
  const perfectCount = transporter && (preset.species === 151 || preset.species === 251) ? 5 : iv3 ? 3 : 0;
  const rng = new MT19937(seed);
  rng.advance(minFrame);

  const words: number[] = [];
  const states: number[] = [];
  let head = 0;
  let cursor = 0;

  function readWord(index: number): number {
    while (words.length <= index) {
      states.push(rng.currentStateWord());
      words.push(rng.nextU32());
    }
    return words[index]!;
  }

  function nextWord(): number {
    return readWord(cursor++);
  }

  function selectPerfectIVs(ivs: RngResultBase['ivs'], count: number) {
    for (let remaining = count; remaining > 0;) {
      const stat = boundedRoll(nextWord(), 6);
      if (ivs[stat] === -1) {
        ivs[stat] = 31;
        remaining--;
      }
    }
  }

  function skipBankMember(genderType: 0 | 1 | 2) {
    if (!iv3) {
      cursor += 10;
      return;
    }
    cursor += 2;
    selectPerfectIVs([-1, -1, -1, -1, -1, -1], genderType === 2 ? 5 : 3);
    cursor += [4, 5, 2][genderType]!;
  }

  for (let frame = minFrame; frame <= maxFrame; frame++, head++) {
    if (head === 1024) {
      words.splice(0, head);
      states.splice(0, head);
      head = 0;
    }
    const rand = readWord(head);
    if (spans) {
      while (span && !span.done && span.value.end < frame) span = spans.next();
      if (!span || span.done) return;
      if (frame < span.value.frame || (frame - span.value.frame) % 2 !== 0) continue;
    }
    const synced = span && !span.done ? span.value.sync : request.assumeSynced === true;
    const synchronize = alwaysSync || (traits.syncable && synced);
    const fixedNature = synchronize && nature !== undefined && Number.isInteger(nature) && nature >= 0 && nature < 25
      ? nature : undefined;
    // Generate6 skips the current word before calling Stationary6.
    cursor = head + delay + 1;
    for (let member = 0; member < target - 1; member++) {
      skipBankMember(transporter ? (request.transporterHistory?.[member] ?? (randomGender ? 1 : 0)) : 0);
    }
    const start = cursor;
    if (!alwaysSync) cursor += 60;
    const ec = nextWord();
    let pid = 0;
    let shiny = false;
    let squareShiny = false;
    for (let roll = 0; roll < pidRolls; roll++) {
      pid = nextWord();
      if (getPSV(pid) === tsv) {
        if (shinyLocked) {
          pid = (pid ^ 0x10000000) >>> 0;
        } else {
          shiny = true;
          squareShiny = getPRV(pid) === trv;
        }
        break;
      }
      if (forceShiny) {
        const low = pid & 0xffff;
        pid = (((((tsv << 4) | trv) ^ low) << 16) | low) >>> 0;
        shiny = squareShiny = true;
      }
    }

    const ivs = (preset.ivs?.slice() ?? [-1, -1, -1, -1, -1, -1]) as RngResultBase['ivs'];
    // Template locks take priority over random guaranteed IVs.
    selectPerfectIVs(ivs, Math.min(perfectCount, ivs.filter(iv => iv === -1).length));
    for (let stat = 0; stat < ivs.length; stat++) {
      if (ivs[stat] === -1) ivs[stat] = nextWord() >>> 27;
    }

    const ability = fixedAbility || (nextWord() >>> 31) + 1;
    const resultNature = fixedNature ?? boundedRoll(nextWord(), 25);
    const resultGender = randomGender ? (boundedRoll(nextWord(), 252) >= gender ? 1 : 2) : gender;
    const prv = getPRV(pid);
    yield {
      kind: 'stationary',
      frame, shift: frame - targetFrame, elapsedFrames: frame - minFrame,
      rand, state: states[head]!, delay,
      framesUsed: (cursor - start) & 0xff,
      species: preset.species, forme: preset.forme, level, gender: resultGender,
      ec, pid, ivs, ability, nature: resultNature, synchronize,
      psv: getPSV(pid), prv, shiny, squareShiny,
      hiddenPower: getHiddenPowerValue(ivs),
    };


  }
}
