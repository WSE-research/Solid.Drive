import type { FunctionComponent } from 'react';

export const HeroBlob: FunctionComponent = () => (
  <landing-hero-blob>
    <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="landing-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </defs>
    </svg>
    <landing-hero-blob-bubbles>
      <landing-hero-blob-bubble />
      <landing-hero-blob-bubble />
      <landing-hero-blob-bubble />
      <landing-hero-blob-bubble />
      <landing-hero-blob-bubble />
    </landing-hero-blob-bubbles>
  </landing-hero-blob>
);
