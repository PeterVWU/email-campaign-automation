import * as migration_20260408_222825 from './20260408_222825';
import * as migration_20260408_224621 from './20260408_224621';

export const migrations = [
  {
    up: migration_20260408_222825.up,
    down: migration_20260408_222825.down,
    name: '20260408_222825',
  },
  {
    up: migration_20260408_224621.up,
    down: migration_20260408_224621.down,
    name: '20260408_224621'
  },
];
