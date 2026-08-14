import React from 'react';
import { render } from '@testing-library/react-native';
import SkeletonLoader from './SkeletonLoader';

describe('SkeletonLoader', () => {
  it('renderiza el tipo "card" sin lanzar errores', async () => {
    const { toJSON } = await render(<SkeletonLoader type="card" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renderiza el tipo "list" sin lanzar errores', async () => {
    const { toJSON } = await render(<SkeletonLoader type="list" />);
    expect(toJSON()).toBeTruthy();
  });
});
