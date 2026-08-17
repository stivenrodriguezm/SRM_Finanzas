import { applySavedOrder, mergeOrderAfterDrag } from './orderPreference';

describe('applySavedOrder', () => {
  const items = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }];

  it('sin orden guardado, devuelve los items tal cual', () => {
    expect(applySavedOrder(items, [])).toEqual(items);
  });

  it('ordena según el orden guardado', () => {
    expect(applySavedOrder(items, ['c', 'a', 'b']).map((i) => i._id)).toEqual(['c', 'a', 'b']);
  });

  it('los items nuevos (no guardados) quedan al final, en su orden original', () => {
    expect(applySavedOrder(items, ['b']).map((i) => i._id)).toEqual(['b', 'a', 'c']);
  });
});

describe('mergeOrderAfterDrag', () => {
  it('usa el orden visible tal cual si no había orden guardado antes', () => {
    expect(mergeOrderAfterDrag(['b', 'a', 'c'], [])).toEqual(['b', 'a', 'c']);
  });

  it('conserva al final los ids guardados que ya no están visibles (ocultos)', () => {
    expect(mergeOrderAfterDrag(['b', 'a'], ['a', 'hidden', 'b'])).toEqual(['b', 'a', 'hidden']);
  });
});
