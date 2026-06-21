import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

type FeedScrollGesture = ReturnType<typeof Gesture.Native>;

const FeedScrollGestureContext = createContext<FeedScrollGesture | null>(null);

export function useFeedScrollGesture(): FeedScrollGesture | null {
    return useContext(FeedScrollGestureContext);
}

type FeedScrollGestureRootProps = {
    children: ReactNode;
};

/** Wrap a feed FlatList so item pinch gestures can block vertical scroll on Android. */
export function FeedScrollGestureRoot({ children }: FeedScrollGestureRootProps) {
    const scrollGesture = useMemo(() => Gesture.Native(), []);

    return (
        <FeedScrollGestureContext.Provider value={scrollGesture}>
            <GestureDetector gesture={scrollGesture}>{children}</GestureDetector>
        </FeedScrollGestureContext.Provider>
    );
}
