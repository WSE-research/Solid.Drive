import { describe, it, expect, vi } from 'vitest';
import { resolveKeepBothLocation } from '../keepBothLocation-file/keepBothLocation';

const originalContainerUri = 'https://pod.example/my-solid-app/photo-2024/';

describe('resolveKeepBothLocation', () => {
  it('uses the plain "(restored)" suffix when that spot is free', async () => {
    const isOccupied = vi.fn().mockResolvedValue(false);
    const result = await resolveKeepBothLocation(originalContainerUri, isOccupied);
    expect(result).toBe('https://pod.example/my-solid-app/photo-2024%20(restored)/');
    expect(isOccupied).toHaveBeenCalledTimes(1);
  });

  it('counts up to the next free "(restored N)" suffix when earlier ones are taken', async () => {
    const isOccupied = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const result = await resolveKeepBothLocation(originalContainerUri, isOccupied);
    expect(result).toBe('https://pod.example/my-solid-app/photo-2024%20(restored%203)/');
    expect(isOccupied).toHaveBeenCalledTimes(3);
  });

  it('checks each candidate against the original container, not against a moving target', async () => {
    const isOccupied = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await resolveKeepBothLocation(originalContainerUri, isOccupied);
    expect(isOccupied).toHaveBeenNthCalledWith(1, 'https://pod.example/my-solid-app/photo-2024%20(restored)/');
    expect(isOccupied).toHaveBeenNthCalledWith(2, 'https://pod.example/my-solid-app/photo-2024%20(restored%202)/');
  });

  it('gives up with a clear error instead of looping forever when nothing is ever free', async () => {
    const isOccupied = vi.fn().mockResolvedValue(true);
    await expect(resolveKeepBothLocation(originalContainerUri, isOccupied)).rejects.toThrow(originalContainerUri);
  });
});
