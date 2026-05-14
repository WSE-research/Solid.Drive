import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewStub } from '../ViewStub-file/ViewStub';

describe('ViewStub', () => {
  it('renders the provided title', () => {
    render(<ViewStub title="My Files" testId="my-files" />);
    expect(screen.getByRole('heading', { name: 'My Files' })).toBeInTheDocument();
  });

  it('exposes the testId on the root element for routing assertions', () => {
    render(<ViewStub title="My Files" testId="my-files" />);
    expect(screen.getByTestId('view-my-files')).toBeInTheDocument();
  });
});
