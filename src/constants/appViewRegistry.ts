/**
 * Registry of known AT Protocol AppView endpoints.
 *
 * Each entry describes a server that can supply feed content. The app ships
 * with a set of well-known endpoints; users will eventually be able to add
 * custom ones via the "Connected Servers" settings screen.
 */

export type AppViewEndpoint = {
    /** Unique slug used as a stable key (e.g. 'bluesky', 'flip'). */
    id: string;
    /** Human-readable label shown in the UI. */
    label: string;
    /** Base URL of the AppView's XRPC endpoint. */
    serviceUrl: string;
    /** Whether this endpoint is enabled by default for new users. */
    enabledByDefault: boolean;
    /** Short description shown in settings. */
    description?: string;
};

/**
 * Built-in AppView endpoints that ship with the app.
 * More can be added here as new AT Protocol services launch.
 */
export const BUILT_IN_APP_VIEWS: readonly AppViewEndpoint[] = [
    {
        id: 'bluesky',
        label: 'Bluesky',
        serviceUrl: 'https://public.api.bsky.app',
        enabledByDefault: true,
        description: 'The Bluesky social network AppView',
    },
    // Future entries:
    // {
    //     id: 'flip',
    //     label: 'Flip',
    //     serviceUrl: 'https://appview.flip.app',
    //     enabledByDefault: true,
    //     description: 'Flip native AppView (coming soon)',
    // },
] as const;

/** Default AppView used for authenticated requests (Bluesky PDS). */
export const DEFAULT_PDS_SERVICE = 'https://bsky.social';

/** Lookup an AppView by its id. */
export function getAppViewById(id: string): AppViewEndpoint | undefined {
    return BUILT_IN_APP_VIEWS.find((av) => av.id === id);
}

/** Get all AppViews that are enabled by default. */
export function getDefaultAppViews(): AppViewEndpoint[] {
    return BUILT_IN_APP_VIEWS.filter((av) => av.enabledByDefault);
}
