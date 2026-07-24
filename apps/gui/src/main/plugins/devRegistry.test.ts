import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDevRegistryForTesting,
  getGitPluginOrigins,
  removeGitPluginOrigin,
  setGitPluginOrigin
} from './devRegistry';

afterEach(() => {
  clearDevRegistryForTesting();
});

describe('git plugin origin registry', () => {
  it('stores and retrieves git origins by plugin id', () => {
    setGitPluginOrigin('com.example.git', {
      url: 'https://github.com/example/my-plugin.git',
      ref: 'main'
    });
    expect(getGitPluginOrigins()).toEqual({
      'com.example.git': {
        url: 'https://github.com/example/my-plugin.git',
        ref: 'main'
      }
    });
  });

  it('removes git origin metadata for one plugin', () => {
    setGitPluginOrigin('com.example.one', {
      url: 'https://github.com/example/one.git'
    });
    setGitPluginOrigin('com.example.two', {
      url: 'https://github.com/example/two.git'
    });
    removeGitPluginOrigin('com.example.one');
    expect(getGitPluginOrigins()).toEqual({
      'com.example.two': {
        url: 'https://github.com/example/two.git'
      }
    });
  });

  it('clears git origins during test reset', () => {
    setGitPluginOrigin('com.example.git', {
      url: 'https://github.com/example/my-plugin.git'
    });
    clearDevRegistryForTesting();
    expect(getGitPluginOrigins()).toEqual({});
  });
});
