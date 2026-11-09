import React, { createContext, useContext } from 'react';
import type { TextStyleId } from '@/types/studio';

/**
 * The video's text style, set once in MainVideo. A component's own textStyle prop still wins,
 * so scenes written before this existed keep their look; scenes without the prop follow the video.
 */
const TextStyleContext = createContext<TextStyleId | undefined>(undefined);

export const TextStyleProvider: React.FC<React.PropsWithChildren<{ value?: TextStyleId }>> = ({ value, children }) => (
  <TextStyleContext.Provider value={value}>{children}</TextStyleContext.Provider>
);

export const useTextStyle = (own?: TextStyleId): TextStyleId | undefined => {
  const shared = useContext(TextStyleContext);
  return own ?? shared;
};
