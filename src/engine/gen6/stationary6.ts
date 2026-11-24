import { getHiddenPowerValue, getPRV, getPSV, MAX_FRAME } from '../core/pokemonMath';
import type { RngResultBase } from '../core/types';
import { MT19937 } from '../rng/mt19937';

const PRESETS = {
  'xy-mewtwo': { species: 150, level: 70, delay: 2, ability: 1, shinyLocked: true },
  'oras-regirock': { species: 377, level: 40, delay: 158, ability: 0, shinyLocked: false },
} as const;

export interface Stationary6SearchRequest {
  seed: number;
  preset: keyof typeof PRESETS;
  minFrame: number;
  maxFrame: number;
  targetFrame: number;
  considerDelay: boolean;
  tsv: number;
  trv: number;
  shinyCharm: boolean;
  syncNature?: number;
  assumeSynced?: boolean;
}

export interface Stationary6Row extends RngResultBase {
  frame: number;
  shift: number;
  elapsedFrames: number;
  rand: number;
  state: number;
  delay: number;
}

/** Gen 6 bounded rolls use the high word of the product. The small bounds here are exact in a JS number. */
function boundedRoll(word: number, bound: 6 | 25): number {
  return Math.floor((word * bound) / 0x100000000);
}

/** Searches normal stationary frames for the two initial Gen 6 presets. */
export function* searchStationary6(request: Stationary6SearchRequest): Generator<Stationary6Row> {
  const { seed, minFrame, maxFrame, targetFrame, tsv, trv, syncNature, assumeSynced } = request;
  if (!Number.isInteger(minFrame) || !Number.isInteger(maxFrame) ||
      minFrame < 0 || minFrame > maxFrame || maxFrame > MAX_FRAME) {
    throw new RangeError('Invalid stationary frame range');
  }

  const preset = PRESETS[request.preset];
  const delay = request.considerDelay ? preset.delay : 0;
  const pidRolls = request.shinyCharm && !preset.shinyLocked ? 3 : 1;
  const synchronize = assumeSynced ?? false;
  const forcedNature = synchronize && syncNature !== undefined && syncNature >= 0 && syncNature < 25
    ? syncNature : undefined;
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

  for (let frame = minFrame; frame <= maxFrame; frame++) {
    const rand = readWord(head);
    // Generate6 skips the current word, then Stationary6 advances 60 for these presets.
    cursor = head + delay + 61;
    const ec = nextWord();
    let pid = 0;
    let shiny = false;
    for (let roll = 0; roll < pidRolls; roll++) {
      pid = nextWord();
      if (getPSV(pid) === tsv) {
        if (preset.shinyLocked) pid = (pid ^ 0x10000000) >>> 0;
        else shiny = true;
        break;
      }
    }

    const ivs: RngResultBase['ivs'] = [-1, -1, -1, -1, -1, -1];
    for (let perfect = 0; perfect < 3;) {
      const stat = boundedRoll(nextWord(), 6);
      if (ivs[stat] === -1) {
        ivs[stat] = 31;
        perfect++;
      }
    }
    for (let stat = 0; stat < ivs.length; stat++) {
      if (ivs[stat] === -1) ivs[stat] = nextWord() >>> 27;
    }

    const ability = preset.ability || (nextWord() >>> 31) + 1;
    const nature = forcedNature ?? boundedRoll(nextWord(), 25);
    const prv = getPRV(pid);
    yield {
      frame, shift: frame - targetFrame, elapsedFrames: frame - minFrame,
      rand, state: states[head]!, delay,
      species: preset.species, forme: 0, level: preset.level, gender: 0,
      ec, pid, ivs, ability, nature, synchronize,
      psv: getPSV(pid), prv, shiny, squareShiny: shiny && prv === trv,
      hiddenPower: getHiddenPowerValue(ivs),
    };

    // Keep the lookahead for the next frame and periodically discard consumed words.
    head++;
    if (head === 1024) {
      words.splice(0, head);
      states.splice(0, head);
      head = 0;
    }
  }
}
