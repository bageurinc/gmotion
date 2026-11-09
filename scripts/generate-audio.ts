import fs from 'fs';
import { encodeWav, MusicRecipe, synthMusic, synthSfx } from '../src/lib/audio/synth';
import type { Storyboard } from '../src/types/studio';

type BackingTrackRecipe = Omit<MusicRecipe, 'brightness' | 'pulse'>;

const TRACKS: Record<Exclude<Storyboard['bgmTrack'], 'none'>, BackingTrackRecipe> = {
  'warm-acoustic': { bpm: 84, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], pluckPattern: [0, -1, 2, -1, -1, 1, -1, -1], pluckStyle: 'dry-mallet' },
  'upbeat-saas': { bpm: 112, chords: [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 67]], pluckPattern: [0, -1, 2, 1, -1, 3, -1, 1], pluckStyle: 'dry-mallet' },
  'dark-tech-pulse': { bpm: 96, chords: [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 55, 59, 62]], pluckPattern: [0, -1, 0, 2, -1, 1, -1, 3] },
  'cinematic-story': { bpm: 66, chords: [[50, 57, 62, 65], [46, 53, 58, 62], [41, 48, 53, 57], [43, 50, 55, 58]], pluckPattern: [0, -1, -1, 2, -1, -1, 3, -1] },
  'calm-focus': { bpm: 76, chords: [[55, 62, 69, 71], [52, 59, 62, 67], [48, 55, 62, 64], [50, 57, 64, 67]], pluckPattern: [0, -1, -1, 2, -1, -1, 1, -1] },
  'playful-plucks': { bpm: 126, chords: [[60, 64, 67, 69], [65, 69, 72, 74], [62, 65, 69, 72], [67, 71, 74, 76]], pluckPattern: [0, 2, -1, 3, 1, -1, 2, 1] },
  'documentary-tension': { bpm: 88, chords: [[45, 52, 57, 60], [45, 53, 57, 62], [43, 50, 55, 58], [44, 52, 56, 59]], pluckPattern: [-1, -1, 2, -1, -1, -1, -1, 1] },
  'bright-drive': { bpm: 120, chords: [[53, 60, 65, 69], [60, 67, 72, 76], [55, 62, 67, 71], [57, 64, 69, 72]], pluckPattern: [0, -1, 2, 1, -1, 3, 1, 2] },
  'soft-ambient': { bpm: 64, chords: [[50, 57, 64, 69], [47, 54, 62, 66], [43, 50, 57, 62]], pluckPattern: [-1, 2, -1, -1, -1, -1, -1, 1] },
  'lofi-study': { bpm: 78, chords: [[50, 53, 60, 64], [55, 59, 65, 69], [48, 52, 59, 62]], pluckPattern: [-1, 2, -1, -1, 3, -1, 1, -1] },
  'curiosity-steps': { bpm: 104, chords: [[57, 60, 64, 71], [55, 60, 65, 69], [52, 57, 62, 65]], pluckPattern: [0, -1, 2, -1, -1, 3, 1, -1] },
  'nature-dawn': { bpm: 72, chords: [[48, 55, 62, 67], [53, 60, 67, 72], [55, 62, 69, 74]], pluckPattern: [-1, -1, 2, -1, -1, -1, -1, 3] },
  'historical-reflection': { bpm: 68, chords: [[50, 57, 62, 65], [48, 55, 60, 64], [46, 53, 57, 62]], pluckPattern: [0, -1, -1, -1, -1, 1, -1, -1] },
  'hopeful-finale': { bpm: 100, chords: [[48, 55, 60, 64], [50, 57, 62, 65], [53, 60, 65, 69], [55, 62, 67, 71]], pluckPattern: [0, -1, 1, 2, -1, -1, 3, -1] },
  'minimal-luxury': { bpm: 92, chords: [[45, 52, 59, 60], [41, 48, 55, 57], [43, 50, 57, 59]], pluckPattern: [-1, 1, -1, -1, -1, -1, 2, -1] },
  'retro-arcade': { bpm: 138, chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], pluckPattern: [0, 2, 0, 1, 2, 1, 2, 0] },
};

for (const [name, recipe] of Object.entries(TRACKS)) {
  fs.writeFileSync(`public/audio/music/${name}.wav`, encodeWav(synthMusic({ ...recipe, pulse: false })));
}
for (const kind of ['pop', 'whoosh', 'notification', 'cash-register', 'success']) {
  fs.writeFileSync(`public/audio/sfx/${kind}.wav`, encodeWav(synthSfx(kind)));
}
