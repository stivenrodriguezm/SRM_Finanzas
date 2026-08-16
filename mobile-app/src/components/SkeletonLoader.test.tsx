import React from 'react';
import { render } from '@testing-library/react-native';
import SkeletonLoader from './SkeletonLoader';
import { PreferencesProvider } from '../context/PreferencesContext';

describe('SkeletonLoader', () => {
  it('renderiza el tipo "card" sin lanzar errores', async () => {
    const { toJSON } = await render(
      <PreferencesProvider>
        <SkeletonLoader type="card" />
      </PreferencesProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renderiza el tipo "list" sin lanzar errores', async () => {
    const { toJSON } = await render(
      <PreferencesProvider>
        <SkeletonLoader type="list" />
      </PreferencesProvider>
    );
    expect(toJSON()).toBeTruthy();
  });
});
