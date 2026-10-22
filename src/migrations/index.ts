import * as migration_20261022_121151_initial from './20261022_121151_initial';

export const migrations = [
  {
    up: migration_20261022_121151_initial.up,
    down: migration_20261022_121151_initial.down,
    name: '20261022_121151_initial'
  },
];
