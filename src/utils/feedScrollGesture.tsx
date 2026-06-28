import { type ReactNode } from 'react';

// Pass-through wrapper. The previous bare Gesture.Native() wrapper intercepted
// vertical swipes on Android and froze the feed FlatList. Rendering children
// directly restores native scrolling. (Pinch-to-block-scroll experiment removed.)

export function useFeedScrollGesture(): null {
    return null;
}

type FeedScrollGestureRootProps = {
    children: ReactNode;
};

export function FeedScrollGestureRoot({ children }: FeedScrollGestureRootProps) {
    return <>{children}</>;
}
