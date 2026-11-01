// data/resdb.js: shuffle -> game_math.floor -> raw_math.raw_floor.
// Independent reconstruction; mutates the supplied array as the game does.
export function resdbShuffle(array, nextFloat) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat() * (i + 1) + 1e-8);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
