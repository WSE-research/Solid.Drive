import { useLayoutEffect, useState, type RefObject } from 'react';

export interface ObservedSize {
  readonly width: number;
  readonly height: number;
}

const EMPTY_SIZE: ObservedSize = { width: 0, height: 0 };

const measureElement = (element: Element): ObservedSize => {
  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
};

export const useResizeObserver = <T extends Element>(
  ref: RefObject<T | null>,
): ObservedSize => {
  const [size, setSize] = useState<ObservedSize>(EMPTY_SIZE);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    setSize(measureElement(element));

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
};
