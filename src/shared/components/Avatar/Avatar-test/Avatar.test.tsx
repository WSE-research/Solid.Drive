import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from '../Avatar-file/Avatar';

describe('Avatar', () => {
  it('is defined', () => {
    expect(Avatar).toBeDefined();
  });

  it('renders an img element when src is provided', () => {
    render(<Avatar src="https://example.com/photo.jpg" alt="User" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    expect(img).toHaveAttribute('alt', 'User');
  });

  it('applies avatar class to img', () => {
    render(<Avatar src="https://example.com/photo.jpg" alt="User" />);
    const img = screen.getByRole('img');
    expect(img).toHaveClass('avatar');
  });

  it('applies sm size class to img when size is sm', () => {
    render(<Avatar src="https://example.com/photo.jpg" alt="User" size="sm" />);
    const img = screen.getByRole('img');
    expect(img).toHaveClass('avatar', 'avatar--sm');
  });

  it('does not apply sm size class to img when size is md', () => {
    render(<Avatar src="https://example.com/photo.jpg" alt="User" size="md" />);
    const img = screen.getByRole('img');
    expect(img).toHaveClass('avatar');
    expect(img).not.toHaveClass('avatar--sm');
  });

  it('defaults alt to empty string', () => {
    const { container } = render(<Avatar src="https://example.com/photo.jpg" />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('alt', '');
  });

  it('renders placeholder div with initial when no src', () => {
    render(<Avatar initial="J" />);
    const placeholder = screen.getByText('J');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveClass('avatar', 'avatar--placeholder');
  });

  it('defaults initial to ? when not provided', () => {
    render(<Avatar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('shows spinner when isLoading and no src', () => {
    const { container } = render(<Avatar isLoading />);
    const spinner = container.querySelector('.spinner');
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByText('?')).not.toBeInTheDocument();
  });

  it('shows initial (not spinner) when isLoading is false and no src', () => {
    const { container } = render(<Avatar isLoading={false} initial="A" />);
    expect(container.querySelector('.spinner')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('applies sm size class to placeholder div', () => {
    render(<Avatar initial="X" size="sm" />);
    const placeholder = screen.getByText('X');
    expect(placeholder).toHaveClass('avatar--sm');
  });

  it('does not apply sm class to placeholder when size is md', () => {
    render(<Avatar initial="X" size="md" />);
    const placeholder = screen.getByText('X');
    expect(placeholder).not.toHaveClass('avatar--sm');
  });
});
