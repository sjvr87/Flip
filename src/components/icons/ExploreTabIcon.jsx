import { Image } from 'expo-image';
import { memo } from 'react';

const EXPLORE_TAB_ICON = require('../../../assets/images/explore-tab-icon.png');

/**
 * Fantasy compass rose tab icon — reference PNG at 26px for multi-color fidelity.
 */
const ExploreTabIcon = memo(function ExploreTabIcon({
    size = 26,
    focused = false,
}) {
    return (
        <Image
            source={EXPLORE_TAB_ICON}
            style={{
                width: size,
                height: size,
                opacity: focused ? 1 : 0.72,
            }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
        />
    );
});

export default ExploreTabIcon;
