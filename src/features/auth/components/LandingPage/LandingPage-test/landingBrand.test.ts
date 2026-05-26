import { describe, it, expect } from 'vitest';
import { splitBrand } from '../LandingPage-file/landingBrand';

describe('splitBrand', () => {
  it('splits a dotted name into a primary and an accent, both uppercased', () => {
    expect(splitBrand('Solid.drive')).toEqual({ primary: 'SOLID', accent: 'DRIVE' });
  });

  it('returns the whole name as primary and no accent when there is no dot', () => {
    expect(splitBrand('SolidDrive')).toEqual({ primary: 'SOLIDDRIVE', accent: undefined });
  });

  it('treats the first dot as the separator when the name contains more than one', () => {
    expect(splitBrand('Solid.drive.app')).toEqual({ primary: 'SOLID', accent: 'DRIVE.APP' });
  });

  it('returns an empty accent when the name ends with a dot', () => {
    expect(splitBrand('Solid.')).toEqual({ primary: 'SOLID', accent: '' });
  });
});
