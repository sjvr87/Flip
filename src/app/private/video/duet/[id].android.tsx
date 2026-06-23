import MobileOnlyScreen from '@/components/MobileOnlyScreen';
import { prepareForCameraCapture } from '@/utils/cameraCapturePrepare';
import { canUseFlipCamera } from '@/utils/runtime';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

/** Android duet entry — CameraX 1080p60 recorder (dev build only). */
export default function DuetCameraScreenAndroid() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    useEffect(() => {
        prepareForCameraCapture();
    }, []);

    if (!canUseFlipCamera) {
        return <MobileOnlyScreen title="Duet" />;
    }

    const FlipCameraScreenAndroid = require('@/camera/FlipCameraScreen.android').default;

    return <FlipCameraScreenAndroid onClose={() => router.replace(`/private/video/${id}`)} />;
}
