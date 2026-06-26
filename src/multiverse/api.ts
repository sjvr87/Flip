import type {
    ConnectFlowResult,
    ConnectedAccount,
    MultiverseProvider,
    PostDelivery,
    PostDestination,
} from './types';
import { authedMultiverseFetch } from './session';

async function parseJson<T>(resp: Response): Promise<T> {
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        const err: Error & { status?: number } = new Error(
            (body as { error?: string })?.error ?? `Request failed (${resp.status})`,
        );
        err.status = resp.status;
        throw err;
    }
    return body as T;
}

export async function listConnectedAccounts(token: string): Promise<ConnectedAccount[]> {
    const resp = await authedMultiverseFetch('/api/accounts', token);
    const data = await parseJson<{ accounts: ConnectedAccount[] }>(resp);
    return data.accounts ?? [];
}

export async function beginConnect(
    token: string,
    provider: MultiverseProvider,
): Promise<ConnectFlowResult> {
    const resp = await authedMultiverseFetch(`/api/accounts/connect/${provider}`, token, {
        method: 'POST',
    });
    return parseJson<ConnectFlowResult>(resp);
}

export async function completeConnect(
    token: string,
    provider: MultiverseProvider,
    payload: Record<string, string>,
): Promise<ConnectedAccount> {
    const resp = await authedMultiverseFetch(`/api/accounts/callback/${provider}`, token, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return parseJson<ConnectedAccount>(resp);
}

export async function unlinkAccount(token: string, accountId: string): Promise<void> {
    const resp = await authedMultiverseFetch(`/api/accounts/${accountId}`, token, {
        method: 'DELETE',
    });
    await parseJson<{ ok: boolean }>(resp);
}

export async function createMultiversePost(
    token: string,
    input: {
        text: string;
        destinations: PostDestination[];
        flipPostUri?: string | null;
        mediaType?: string | null;
        mediaUri?: string | null;
    },
): Promise<{ postId: string; deliveryIds: string[] }> {
    const destinations = input.destinations
        .filter((d) => d.enabled)
        .map((d) => ({
            provider: d.provider,
            accountId: d.accountId,
            destination: d.destination ?? null,
        }));

    const resp = await authedMultiverseFetch('/api/posts', token, {
        method: 'POST',
        body: JSON.stringify({
            text: input.text,
            destinations,
            flipPostUri: input.flipPostUri,
            mediaType: input.mediaType,
            mediaUri: input.mediaUri,
        }),
    });
    return parseJson(resp);
}

export async function fetchPostDeliveries(token: string, postId: string): Promise<PostDelivery[]> {
    const resp = await authedMultiverseFetch(`/api/posts/${postId}/deliveries`, token);
    const data = await parseJson<{ deliveries: PostDelivery[] }>(resp);
    return data.deliveries ?? [];
}
