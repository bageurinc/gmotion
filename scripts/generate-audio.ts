import fs from 'fs';
import { encodeWav, MusicRecipe, synthMusic, synthSfx } from '../src/lib/audio/synth';

const TRACKS: Record<string, MusicRecipe> = {
  'warm-acoustic': { bpm: 84, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], pluckPattern: [0, -1, 2, 1, 3, -1, 2, 1], pulse: false, brightness: 0.34 },
  'upbeat-saas': { bpm: 112, chords: [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 67]], pluckPattern: [0, 2, 1, 3, 0, 2, 1, 2], pulse: true, brightness: 0.42 },
  'dark-tech-pulse': { bpm: 96, chords: [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 55, 59, 62]], pluckPattern: [0, -1, 0, 2, -1, 1, -1, 3], pulse: true, brightness: 0.3 },
  'cinematic-story': { bpm: 66, chords: [[50, 57, 62, 65], [46, 53, 58, 62], [41, 48, 53, 57], [43, 50, 55, 58]], pluckPattern: [0, -1, -1, 2, -1, -1, 3, -1], pulse: false, brightness: 0.26 },
};

for (const [name, recipe] of Object.entries(TRACKS)) {
  fs.writeFileSync(`public/audio/music/${name}.wav`, encodeWav(synthMusic(recipe)));
}
for (const kind of ['pop', 'whoosh', 'notification', 'cash-register', 'success']) {
  fs.writeFileSync(`public/audio/sfx/${kind}.wav`, encodeWav(synthSfx(kind)));
}
