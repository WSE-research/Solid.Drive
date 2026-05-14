import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  HomeIcon, MyFilesIcon, SharedIcon, RequestsIcon, PeopleIcon,
  HomeIconActive, MyFilesIconActive, SharedIconActive, RequestsIconActive,
  PeopleIconActive,
  ChevronDownIcon, PlusIcon, GearIcon, CheckmarkIcon,
} from '../icons-file/icons';

describe('icons module', () => {
  const regular = [
    ['HomeIcon', HomeIcon],
    ['MyFilesIcon', MyFilesIcon],
    ['SharedIcon', SharedIcon],
    ['RequestsIcon', RequestsIcon],
    ['PeopleIcon', PeopleIcon],
    ['ChevronDownIcon', ChevronDownIcon],
    ['PlusIcon', PlusIcon],
    ['GearIcon', GearIcon],
    ['CheckmarkIcon', CheckmarkIcon],
  ] as const;

  const filled = [
    ['HomeIconActive', HomeIconActive],
    ['MyFilesIconActive', MyFilesIconActive],
    ['SharedIconActive', SharedIconActive],
    ['RequestsIconActive', RequestsIconActive],
    ['PeopleIconActive', PeopleIconActive],
  ] as const;

  it.each(regular)('renders %s as svg', (_label, Icon) => {
    const { container } = render(<Icon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it.each(filled)('renders filled variant %s as svg', (_label, Icon) => {
    const { container } = render(<Icon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
