export const VOICE_OPTIONS = [
  { id: 'Charon', label: 'Charon', style: 'Informatif' },
  { id: 'Kore', label: 'Kore', style: 'Tegas' },
  { id: 'Puck', label: 'Puck', style: 'Ceria' },
  { id: 'Fenrir', label: 'Fenrir', style: 'Bersemangat' },
  { id: 'Aoede', label: 'Aoede', style: 'Santai' },
  { id: 'Orus', label: 'Orus', style: 'Mantap' },
] as const;

export const DEFAULT_VOICE = VOICE_OPTIONS[0].id;
