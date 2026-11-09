/** Royalty-free music and effects rendered from code. */
const SAMPLE_RATE = 22_050;
const TWO_PI = Math.PI * 2;

export interface MusicRecipe {
  bpm: number;
  chords: number[][];
  pluckPattern: number[];
  pluckStyle?: 'dry-mallet';
  pulse: boolean;
  /** Omit to skip the sustained pad. */
  brightness?: number;
}

const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** Deterministic noise so regenerated files stay identical. */
function createNoise(seed = 7) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 2147483648 - 1;
  };
}

function addPad(left: Float32Array, right: Float32Array, notes: number[], from: number, length: number, brightness: number) {
  notes.forEach((note, voice) => {
    const frequency = midiToHz(note);
    for (let index = 0; index < length; index += 1) {
      const position = from + index;
      if (position >= left.length) break;
      const time = index / SAMPLE_RATE;
      const envelope = Math.min(1, index / (SAMPLE_RATE * 0.9)) * Math.min(1, (length - index) / (SAMPLE_RATE * 0.9));
      let value = 0;
      for (let harmonic = 1; harmonic <= 4; harmonic += 1) {
        value += Math.sin(TWO_PI * frequency * harmonic * time * (1 + voice * 0.0007)) * brightness ** (harmonic - 1) / harmonic;
      }
      const pan = 0.5 + 0.28 * Math.sin(voice * 2.1);
      left[position] += value * envelope * 0.05 * (1 - pan);
      right[position] += value * envelope * 0.05 * pan;
    }
  });
}

/** Karplus-Strong string pluck. */
function addPluck(left: Float32Array, right: Float32Array, note: number, from: number, pan: number, noise: () => number) {
  const period = Math.round(SAMPLE_RATE / midiToHz(note));
  const delay = Float32Array.from({ length: period }, () => noise());
  const length = Math.round(SAMPLE_RATE * 1.4);
  let previous = 0;
  for (let index = 0; index < length; index += 1) {
    const position = from + index;
    if (position >= left.length) break;
    const pointer = index % period;
    const value = delay[pointer];
    delay[pointer] = 0.996 * 0.5 * (value + previous);
    previous = value;
    left[position] += value * 0.11 * (1 - pan);
    right[position] += value * 0.11 * pan;
  }
}

function addDryMallet(left: Float32Array, right: Float32Array, note: number, from: number, pan: number) {
  const length = Math.min(Math.round(SAMPLE_RATE * 0.22), left.length - from);
  const phaseStep = TWO_PI * midiToHz(note) / SAMPLE_RATE;
  for (let index = 0; index < length; index += 1) {
    const time = index / SAMPLE_RATE;
    const envelope = Math.min(1, time / 0.008, (length - index) / (SAMPLE_RATE * 0.025)) * Math.exp(-time * 25);
    const phase = index * phaseStep;
    const value = (Math.sin(phase) + Math.sin(phase * 2) * 0.16) * envelope;
    left[from + index] += value * (1 - pan);
    right[from + index] += value * pan;
  }
}

function addPulse(left: Float32Array, right: Float32Array, from: number) {
  const length = Math.round(SAMPLE_RATE * 0.22);
  for (let index = 0; index < length; index += 1) {
    const position = from + index;
    if (position >= left.length) break;
    const time = index / SAMPLE_RATE;
    const value = Math.sin(TWO_PI * (42 + 70 * Math.exp(-time * 34)) * time) * Math.exp(-time * 14) * 0.26;
    left[position] += value;
    right[position] += value;
  }
}

function addEcho(channel: Float32Array, delaySeconds: number, feedback: number) {
  const delay = Math.round(delaySeconds * SAMPLE_RATE);
  for (let index = delay; index < channel.length; index += 1) channel[index] += channel[index - delay] * feedback;
}

function normalize(channels: Float32Array[], peak: number) {
  const loudest = Math.max(...channels.map((channel) => channel.reduce((max, value) => Math.max(max, Math.abs(value)), 0)), 1e-6);
  for (const channel of channels) channel.forEach((value, index) => (channel[index] = (value / loudest) * peak));
}

export function synthMusic(recipe: MusicRecipe): Float32Array[] {
  const beat = 60 / recipe.bpm;
  const barSamples = Math.round(beat * 4 * SAMPLE_RATE);
  const bars = recipe.chords.length * 4;
  const left = new Float32Array(barSamples * bars);
  const right = new Float32Array(barSamples * bars);
  const noise = createNoise();
  const stepSamples = Math.round((beat / 2) * SAMPLE_RATE);
  const dryMallet = recipe.pluckStyle === 'dry-mallet';

  for (let bar = 0; bar < bars; bar += 1) {
    const chord = recipe.chords[bar % recipe.chords.length];
    const from = bar * barSamples;
    if (recipe.brightness !== undefined) addPad(left, right, chord, from, barSamples, recipe.brightness);
    recipe.pluckPattern.forEach((degree, step) => {
      if (degree < 0) return;
      const note = chord[degree % chord.length] + 12;
      const position = from + step * stepSamples;
      const pan = step % 2 ? 0.65 : 0.35;
      if (dryMallet) addDryMallet(left, right, note, position, pan);
      else addPluck(left, right, note, position, pan, noise);
    });
    if (recipe.pulse) for (let hit = 0; hit < 4; hit += 1) addPulse(left, right, from + Math.round(hit * beat * SAMPLE_RATE));
  }

  if (!dryMallet) {
    addEcho(left, beat * 0.75, 0.28);
    addEcho(right, beat, 0.26);
  }
  normalize([left, right], 0.7);
  return [left, right];
}

export function synthSfx(kind: string): Float32Array[] {
  const noise = createNoise(11);
  const tone = (seconds: number, build: (time: number) => number) => {
    const output = new Float32Array(Math.round(seconds * SAMPLE_RATE));
    output.forEach((_, index) => (output[index] = build(index / SAMPLE_RATE)));
    return output;
  };
  const bell = (time: number, frequency: number, start: number, decay: number) =>
    time < start ? 0 : Math.sin(TWO_PI * frequency * (time - start)) * Math.exp(-(time - start) * decay);

  let output: Float32Array;
  if (kind === 'whoosh') {
    let low = 0;
    output = tone(0.55, (time) => {
      const progress = time / 0.55;
      low += (noise() - low) * (0.03 + 0.2 * Math.sin(Math.PI * progress));
      return low * Math.sin(Math.PI * progress) ** 2;
    });
  } else if (kind === 'pop') {
    output = tone(0.14, (time) => Math.sin(TWO_PI * (260 + 520 * Math.exp(-time * 40)) * time) * Math.exp(-time * 32));
  } else if (kind === 'notification') {
    output = tone(0.5, (time) => bell(time, 880, 0, 9) + bell(time, 1175, 0.11, 8));
  } else if (kind === 'cash-register') {
    output = tone(0.65, (time) => bell(time, 1568, 0, 7) + 0.6 * bell(time, 2093, 0.07, 6));
  } else {
    output = tone(0.75, (time) => bell(time, 659, 0, 7) + bell(time, 784, 0.1, 7) + bell(time, 988, 0.2, 5));
  }
  normalize([output], 0.8);
  return [output];
}

export function encodeWav(channels: Float32Array[]): Buffer {
  const frames = channels[0].length;
  const dataSize = frames * channels.length * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels.length, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * channels.length * 2, 28);
  wav.writeUInt16LE(channels.length * 2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  for (let frame = 0; frame < frames; frame += 1) {
    channels.forEach((channel, index) => {
      const value = Math.max(-1, Math.min(1, channel[frame]));
      wav.writeInt16LE(Math.round(value * 32767), 44 + (frame * channels.length + index) * 2);
    });
  }
  return wav;
}
