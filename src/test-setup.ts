import '@testing-library/jest-dom';

type GlobalWithPointer = {
  PointerEvent?: typeof MouseEvent;
  MouseEvent: typeof MouseEvent;
};

const installRadixJsdomPolyfills = (): void => {
  if (typeof globalThis !== 'undefined') {
    const globalScope = globalThis as unknown as GlobalWithPointer;
    if (!globalScope.PointerEvent && globalScope.MouseEvent) {
      globalScope.PointerEvent = globalScope.MouseEvent;
    }
  }
  const elementProto = Element.prototype as unknown as Record<string, unknown>;
  if (typeof elementProto.hasPointerCapture !== 'function') {
    elementProto.hasPointerCapture = () => false;
  }
  if (typeof elementProto.releasePointerCapture !== 'function') {
    elementProto.releasePointerCapture = () => {};
  }
  if (typeof elementProto.setPointerCapture !== 'function') {
    elementProto.setPointerCapture = () => {};
  }
  if (typeof elementProto.scrollIntoView !== 'function') {
    elementProto.scrollIntoView = () => {};
  }
};

installRadixJsdomPolyfills();
