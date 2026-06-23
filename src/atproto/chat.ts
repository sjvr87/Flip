import { getAgent, getServiceUrl, SessionExpiredError, withAuthenticatedFetch } from './agent';

const CHAT_PROXY = 'did:web:api.bsky.chat#bsky_chat';

export type FlipConvoMember = {
    did: string;
    handle: string;
    displayName: string;
    avatar: string;
};

export type FlipConvo = {
    id: string;
    members: FlipConvoMember[];
    lastMessage?: { text: string; sentAt: string };
    unreadCount: number;
    muted: boolean;
};

export type FlipChatMessage = {
    id: string;
    text: string;
    sentAt: string;
    senderDid: string;
    isFromMe: boolean;
};

type ChatMember = {
    did: string;
    handle?: string;
    displayName?: string;
    avatar?: string;
};

type ConvoView = {
    id: string;
    members?: ChatMember[];
    lastMessage?: { text?: string; sentAt?: string };
    unreadCount?: number;
    muted?: boolean;
};

type MessageView = {
    id: string;
    text?: string;
    sentAt: string;
    sender: { did: string };
};

function mapMember(member: ChatMember): FlipConvoMember {
    const handle = member.handle || member.did;
    const username = handle.includes('.') ? handle.split('.')[0] : handle;
    return {
        did: member.did,
        handle,
        displayName: member.displayName || username,
        avatar: member.avatar || '',
    };
}

function otherMember(members: FlipConvoMember[], myDid: string): FlipConvoMember | undefined {
    return members.find((m) => m.did !== myDid) ?? members[0];
}

async function chatXrpc<T>(
    method: string,
    options?: { params?: Record<string, string | string[]>; body?: Record<string, unknown> },
): Promise<T> {
    const agent = getAgent();
    const token = agent.session?.accessJwt;
    if (!token) {
        throw new SessionExpiredError();
    }

    const base = getServiceUrl().replace(/\/$/, '');
    const url = new URL(`${base}/xrpc/${method}`);

    if (options?.params) {
        for (const [key, value] of Object.entries(options.params)) {
            if (Array.isArray(value)) {
                value.forEach((v) => url.searchParams.append(key, v));
            } else {
                url.searchParams.set(key, value);
            }
        }
    }

    const response = await fetch(url.toString(), {
        method: options?.body ? 'POST' : 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Atproto-Proxy': CHAT_PROXY,
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`chat ${method} failed (${response.status}): ${detail}`);
    }

    return (await response.json()) as T;
}

export async function fetchConvos(cursor?: string): Promise<{
    convos: FlipConvo[];
    cursor?: string;
}> {
    if (!getAgent().session) return { convos: [] };

    try {
        const data = await withAuthenticatedFetch(() =>
            chatXrpc<{ convos: ConvoView[]; cursor?: string }>('chat.bsky.convo.listConvos', {
                params: {
                    limit: '30',
                    ...(cursor ? { cursor } : {}),
                },
            }),
        );

        const myDid = getAgent().session?.did ?? '';
        const convos = (data.convos ?? []).map((convo) => {
            const members = (convo.members ?? []).map(mapMember);
            return {
                id: convo.id,
                members,
                lastMessage: convo.lastMessage?.sentAt
                    ? {
                          text: convo.lastMessage.text ?? '',
                          sentAt: convo.lastMessage.sentAt,
                      }
                    : undefined,
                unreadCount: convo.unreadCount ?? 0,
                muted: convo.muted ?? false,
            };
        });

        return { convos, cursor: data.cursor };
    } catch (error) {
        if (error instanceof SessionExpiredError) throw error;
        console.warn('[chat] listConvos failed:', error);
        return { convos: [] };
    }
}

export async function fetchUnreadDmCount(): Promise<number> {
    const { convos } = await fetchConvos();
    return convos.reduce((sum, c) => sum + c.unreadCount, 0);
}

export async function fetchConvoMessages(
    convoId: string,
    cursor?: string,
): Promise<{ messages: FlipChatMessage[]; cursor?: string }> {
    const data = await withAuthenticatedFetch(() =>
        chatXrpc<{ messages: MessageView[]; cursor?: string }>('chat.bsky.convo.getMessages', {
            params: {
                convoId,
                limit: '50',
                ...(cursor ? { cursor } : {}),
            },
        }),
    );

    const myDid = getAgent().session?.did ?? '';
    const messages = (data.messages ?? [])
        .map((msg) => ({
            id: msg.id,
            text: msg.text ?? '',
            sentAt: msg.sentAt,
            senderDid: msg.sender.did,
            isFromMe: msg.sender.did === myDid,
        }))
        .reverse();

    return { messages, cursor: data.cursor };
}

export async function sendChatMessage(convoId: string, text: string): Promise<void> {
    await withAuthenticatedFetch(() =>
        chatXrpc('chat.bsky.convo.sendMessage', {
            body: {
                convoId,
                message: { text },
            },
        }),
    );
}

export async function markConvoRead(convoId: string): Promise<void> {
    try {
        const { messages } = await fetchConvoMessages(convoId);
        const latest = messages[messages.length - 1];
        if (!latest) return;

        await withAuthenticatedFetch(() =>
            chatXrpc('chat.bsky.convo.updateRead', {
                body: {
                    convoId,
                    messageId: latest.id,
                },
            }),
        );
    } catch (error) {
        if (error instanceof SessionExpiredError) throw error;
        console.warn('[chat] updateRead failed:', error);
    }
}

export async function getOrCreateConvo(memberDid: string): Promise<FlipConvo | null> {
    try {
        const data = await withAuthenticatedFetch(() =>
            chatXrpc<{ convo: ConvoView }>('chat.bsky.convo.getConvoForMembers', {
                body: { members: [memberDid] },
            }),
        );

        const convo = data.convo;
        if (!convo) return null;

        const members = (convo.members ?? []).map(mapMember);
        return {
            id: convo.id,
            members,
            lastMessage: convo.lastMessage?.sentAt
                ? {
                      text: convo.lastMessage.text ?? '',
                      sentAt: convo.lastMessage.sentAt,
                  }
                : undefined,
            unreadCount: convo.unreadCount ?? 0,
            muted: convo.muted ?? false,
        };
    } catch (error) {
        if (error instanceof SessionExpiredError) throw error;
        console.warn('[chat] getConvoForMembers failed:', error);
        return null;
    }
}

export function convoTitle(convo: FlipConvo, myDid: string): string {
    const other = otherMember(convo.members, myDid);
    return other?.displayName || other?.handle || 'Chat';
}

export function convoAvatar(convo: FlipConvo, myDid: string): string {
    const other = otherMember(convo.members, myDid);
    return other?.avatar ?? '';
}
