import { describe, expect, it } from 'vitest';
import { resolverRecargo } from './recargo';

describe('F08: resolverRecargo', () => {
  it('usa el del producto si tiene', () => {
    expect(resolverRecargo({ producto: 4000, rubro: 3500, general: 3000 })).toEqual({ recargo: 4000, origen: 'producto' });
  });

  it('un 0% explícito en el producto también cuenta', () => {
    expect(resolverRecargo({ producto: 0, rubro: 3500, general: 3000 })).toEqual({ recargo: 0, origen: 'producto' });
  });

  it('si el producto no tiene, usa el del rubro', () => {
    expect(resolverRecargo({ producto: null, rubro: 3500, general: 3000 })).toEqual({ recargo: 3500, origen: 'rubro' });
  });

  it('si ninguno tiene, usa el general', () => {
    expect(resolverRecargo({ general: 3000 })).toEqual({ recargo: 3000, origen: 'general' });
  });
});
