import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewStub } from '../ViewStub-file/ViewStub';

describe('ViewStub', () => {
  it('exposes the testId on the root element for routing assertions', () => {
    render(<ViewStub testId="my-files" />);
    expect(screen.getByTestId('view-my-files')).toBeInTheDocument();
  });
});
