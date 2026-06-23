import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

type FeedScrollGesture = ReturnType<typeof Gesture.Native>;

const FeedScrollGestureContext = createContext<FeedScrollGesture | null>(null);

function createFeedScrollGesture(): FeedScrollGesture | null {
    try {
        if (typeof Gesture?.Native !== 'function') {
            return null;
        }
        return Gesture.Native();
    } catch {
        return null;
    }
}

export function useFeedScrollGesture(): FeedScrollGesture | null {
    const gesture = useContext(FeedScrollGestureContext);
    if (!gesture || typeof gesture !== 'object') {
        return null;
    }
    return gesture;
}

type FeedScrollGestureRootProps = {
    children: ReactNode;
};

/** Wrap a feed FlatList so item pinch gestures can block vertical scroll on Android. */
export function FeedScrollGestureRoot({ children }: FeedScrollGestureRootProps) {
    const scrollGesture = useMemo(() => createFeedScrollGesture(), []);

    if (!scrollGesture) {
        return <>{children}</>;
    }

    return (
        <FeedScrollGestureContext.Provider value={scrollGesture}>
            <GestureDetector gesture={scrollGesture}>{children}</GestureDetector>
        </FeedScrollGestureContext.Provider>
    );
}
