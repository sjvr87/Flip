import { RichText } from '@atproto/api';

export type FlipMention = {
    username: string;
    profile_id: string;
    start_index: number;
    end_index: number;
};

export function extractMentionsFromRecord(record: {
    text?: string;
    facets?: RichText['facets'];
}): FlipMention[] {
    const text = record.text || '';
    if (!text || !record.facets?.length) return [];

    const rt = new RichText({ text, facets: record.facets });
    const mentions: FlipMention[] = [];
    let offset = 0;

    for (const segment of rt.segments()) {
        if (segment.isMention() && segment.mention?.did) {
            mentions.push({
                username: segment.text.replace(/^@/, ''),
                profile_id: segment.mention.did,
                start_index: offset,
                end_index: offset + segment.text.length,
            });
        }
        offset += segment.text.length;
    }

    return mentions;
}

export function extractTagsFromRecord(record: {
    text?: string;
    facets?: RichText['facets'];
}): string[] {
    const text = record.text || '';
    if (!text || !record.facets?.length) return [];

    const rt = new RichText({ text, facets: record.facets });
    const tags = new Set<string>();

    for (const segment of rt.segments()) {
        if (segment.isTag() && segment.tag?.tag) {
            tags.add(segment.tag.tag);
        }
    }

    return Array.from(tags);
}
