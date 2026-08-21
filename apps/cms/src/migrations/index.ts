import * as migration_20260821_095607_initial from './20260821_095607_initial';

export const migrations = [
  {
    up: migration_20260821_095607_initial.up,
    down: migration_20260821_095607_initial.down,
    name: '20260821_095607_initial'
  },
];
