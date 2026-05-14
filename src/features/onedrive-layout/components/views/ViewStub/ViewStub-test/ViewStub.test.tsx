import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewStub } from '../ViewStub-file/ViewStub';

describe('ViewStub', () => {
  it('exposes the title via data-title for legacy assertions', () => {
    const { container } = render(<ViewStub title="My Files" testId="my-files" />);
    expect(container.querySelector('onedrive-view')).toHaveAttribute(
      'data-title',
      'My Files',
    );
  });

  it('exposes the testId on the root element for routing assertions', () => {
    render(<ViewStub title="My Files" testId="my-files" />);
    expect(screen.getByTestId('view-my-files')).toBeInTheDocument();
  });
});
