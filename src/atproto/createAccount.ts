import { BskyAgent } from '@atproto/api';

import { profileToFlipUser } from './adapters';
import { persistSession, setServiceUrl } from './agent';
import type { FlipUserProfile } from './types';
import { Storage } from '@/utils/cache';

const PROFILE_KEY = 'flip.user.profile';
const DEFAULT_PDS = 'https://bsky.social';

export interface CreateAccountParams {
    email: string;
    handle: string;
    password: string;
    inviteCode?: string;
}

export interface CreateAccountResult {
    success: true;
    user: FlipUserProfile;
}

export interface CreateAccountError {
    success: false;
    error: string;
    field?: 'email' | 'handle' | 'password' | 'inviteCode';
}

/**
 * Normalizes a handle to ensure it ends with .bsky.social
 */
function normalizeHandle(handle: string): string {
    const cleaned = handle.trim().toLowerCase().replace(/^@/, '');
    if (cleaned.includes('.')) return cleaned;
    return `${cleaned}.bsky.social`;
}

/**
 * Creates a new Bluesky account via com.atproto.server.createAccount
 */
export async function createBlueskyAccount(
    params: CreateAccountParams,
): Promise<CreateAccountResult | CreateAccountError> {
    const { email, password, inviteCode } = params;
    const handle = normalizeHandle(params.handle);

    const agent = new BskyAgent({ service: DEFAULT_PDS });

    try {
        const result = await agent.createAccount({
            email,
            handle,
            password,
            inviteCode: inviteCode || undefined,
        });

        if (!result.success) {
            return {
                success: false,
                error: 'Account creation failed. Please try again.',
            };
        }

        // Persist the session
        persistSession({
            did: result.data.did,
            handle: result.data.handle,
            accessJwt: result.data.accessJwt,
            refreshJwt: result.data.refreshJwt,
            active: true,
        });
        setServiceUrl('bsky.social');

        // Fetch profile
        const profile = await agent.getProfile({ actor: result.data.did });
        const user = profileToFlipUser(profile.data, true);
        Storage.set(PROFILE_KEY, JSON.stringify(user));

        return { success: true, user };
    } catch (error: unknown) {
        return mapCreateAccountError(error);
    }
}

/**
 * Checks if a handle is available on bsky.social
 */
export async function checkHandleAvailability(
    handle: string,
): Promise<{ available: boolean; error?: string }> {
    const normalized = normalizeHandle(handle);
    const agent = new BskyAgent({ service: DEFAULT_PDS });

    try {
        await agent.resolveHandle({ handle: normalized });
        // If it resolves, it's taken
        return { available: false };
    } catch (error: unknown) {
        // Handle not found = available
        if (
            error instanceof Error &&
            (error.message.includes('Unable to resolve handle') ||
                error.message.includes('not found'))
        ) {
            return { available: true };
        }
        return { available: false, error: 'Unable to check handle availability.' };
    }
}

function mapCreateAccountError(error: unknown): CreateAccountError {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('Handle already taken') || message.includes('handle is already in use')) {
        return {
            success: false,
            error: 'This handle is already taken. Choose another one.',
            field: 'handle',
        };
    }
    if (message.includes('invalid handle') || message.includes('Invalid handle')) {
        return {
            success: false,
            error: 'Handle contains invalid characters. Use letters, numbers, and hyphens.',
            field: 'handle',
        };
    }
    if (message.includes('invalid email') || message.includes('Invalid email')) {
        return {
            success: false,
            error: 'Please enter a valid email address.',
            field: 'email',
        };
    }
    if (
        message.includes('invite code') ||
        message.includes('InvalidInviteCode') ||
        message.includes('Invite code required')
    ) {
        return {
            success: false,
            error: 'Invalid or expired invite code.',
            field: 'inviteCode',
        };
    }
    if (message.includes('rate limit') || message.includes('Too Many Requests')) {
        return {
            success: false,
            error: 'Too many attempts. Please wait a few minutes and try again.',
        };
    }
    if (message.includes('password') && message.includes('short')) {
        return {
            success: false,
            error: 'Password must be at least 8 characters.',
            field: 'password',
        };
    }

    return {
        success: false,
        error: `Account creation failed: ${message}`,
    };
}
