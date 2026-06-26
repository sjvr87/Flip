import { describe, expect, it, vi } from 'vitest';
import type { SocialProvider } from '../src/providers/types.js';

function mockProvider(overrides: Partial<SocialProvider> = {}): SocialProvider {
    return {
        id: 'mock',
        connect: vi.fn(async () => ({ flow: 'manual' as const, state: 'abc' })),
        callback: vi.fn(async () => ({
            accountId: 'acc-1',
            handle: '@mock',
            tokens: { accessToken: 'tok' },
        })),
        refreshToken: vi.fn(async () => ({ accessToken: 'tok2' })),
        createPost: vi.fn(async () => ({ remotePostId: 'remote-1' })),
        getProfile: vi.fn(async () => ({ handle: '@mock' })),
        disconnect: vi.fn(async () => {}),
        ...overrides,
    };
}

describe('SocialProvider contract', () => {
    it('connect returns state', async () => {
        const provider = mockProvider();
        const result = await provider.connect('user-1');
        expect(result.state).toBeTruthy();
        expect(provider.connect).toHaveBeenCalledWith('user-1');
    });

    it('callback stores tokens shape', async () => {
        const provider = mockProvider();
        const result = await provider.callback('user-1', { state: 'abc' });
        expect(result.accountId).toBe('acc-1');
        expect(result.tokens.accessToken).toBeTruthy();
    });

    it('createPost returns remote id', async () => {
        const provider = mockProvider();
        const result = await provider.createPost('acc-1', { text: 'hello' });
        expect(result.remotePostId).toBe('remote-1');
    });

    it('propagates createPost errors', async () => {
        const provider = mockProvider({
            createPost: vi.fn(async () => {
                throw new Error('network');
            }),
        });
        await expect(provider.createPost('acc-1', { text: 'x' })).rejects.toThrow('network');
    });
});
