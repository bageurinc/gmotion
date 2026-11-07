import React from 'react';
import { AbsoluteFill } from 'remotion';
import { IsoStage, IsoWorld } from './IsoStage';
import { WorldOverlay, WorldVideoProps } from './WorldStage';

export const IsoVideo: React.FC<{ world: IsoWorld; script: WorldVideoProps['script'] }> = ({ world, script }) => (
  <AbsoluteFill>
    <IsoStage world={world} />
    <WorldOverlay script={script} />
  </AbsoluteFill>
);
