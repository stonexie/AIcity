import atmosphere from './atmosphere/index.js';
import ground from './ground/index.js';
import buildings from './buildings/index.js';
import landmarks from './landmarks/index.js';
import signage from './signage/index.js';
import vehicles from './vehicles/index.js';
import crowd from './crowd/index.js';
import weather from './weather/index.js';
import player from './player/index.js';
import audio from './audio/index.js';

const ALL = [
  ['atmosphere', atmosphere],
  ['ground', ground],
  ['buildings', buildings],
  ['landmarks', landmarks],
  ['signage', signage],
  ['vehicles', vehicles],
  ['crowd', crowd],
  ['weather', weather],
  ['player', player],
  ['audio', audio],
].map(([name, sys]) => Object.assign(sys, { name }));

const onlyParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('only') : null;
const onlySet = onlyParam ? new Set(onlyParam.split(',').map((s) => s.trim()).filter(Boolean)) : null;

export const SYSTEMS = onlySet ? ALL.filter((s) => onlySet.has(s.name)) : ALL;
