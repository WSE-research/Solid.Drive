import { describe, it, expect } from 'vitest';
import {
  createGlobalVersionStore,
  createPerKeyVersionStore,
} from '../createVersionStore-file/createVersionStore';

describe('createPerKeyVersionStore', () => {
  it('starts every key at 0', () => {
    const store = createPerKeyVersionStore();
    expect(store.getVersion('a')).toBe(0);
    expect(store.getVersion('anything-else')).toBe(0);
  });

  it('increments only the notified key', () => {
    const store = createPerKeyVersionStore();
    store.notify('a');
    expect(store.getVersion('a')).toBe(1);
    expect(store.getVersion('b')).toBe(0);
    store.notify('a');
    expect(store.getVersion('a')).toBe(2);
  });

  it('fires every subscribed listener on each notify', () => {
    const store = createPerKeyVersionStore();
    let aFired = 0;
    let bFired = 0;
    store.subscribe(() => { aFired += 1; });
    store.subscribe(() => { bFired += 1; });
    store.notify('x');
    expect(aFired).toBe(1);
    expect(bFired).toBe(1);
  });

  it('unsubscribe removes the listener', () => {
    const store = createPerKeyVersionStore();
    let fired = 0;
    const unsubscribe = store.subscribe(() => { fired += 1; });
    unsubscribe();
    store.notify('x');
    expect(fired).toBe(0);
  });

  it('reset clears versions and listeners', () => {
    const store = createPerKeyVersionStore();
    store.notify('a');
    let firedAfterReset = 0;
    store.subscribe(() => { firedAfterReset += 1; });
    store.reset();
    expect(store.getVersion('a')).toBe(0);
    store.notify('a');
    expect(firedAfterReset).toBe(0);
  });
});

describe('createGlobalVersionStore', () => {
  it('starts at 0', () => {
    const store = createGlobalVersionStore();
    expect(store.getVersion()).toBe(0);
  });

  it('increments on every notify', () => {
    const store = createGlobalVersionStore();
    store.notify();
    expect(store.getVersion()).toBe(1);
    store.notify();
    expect(store.getVersion()).toBe(2);
  });

  it('fires every subscriber on notify', () => {
    const store = createGlobalVersionStore();
    let aFired = 0;
    let bFired = 0;
    store.subscribe(() => { aFired += 1; });
    store.subscribe(() => { bFired += 1; });
    store.notify();
    expect(aFired).toBe(1);
    expect(bFired).toBe(1);
  });

  it('unsubscribe removes the listener', () => {
    const store = createGlobalVersionStore();
    let fired = 0;
    const unsubscribe = store.subscribe(() => { fired += 1; });
    unsubscribe();
    store.notify();
    expect(fired).toBe(0);
  });

  it('reset clears the counter and listeners', () => {
    const store = createGlobalVersionStore();
    store.notify();
    let firedAfterReset = 0;
    store.subscribe(() => { firedAfterReset += 1; });
    store.reset();
    expect(store.getVersion()).toBe(0);
    store.notify();
    expect(firedAfterReset).toBe(0);
  });
});
