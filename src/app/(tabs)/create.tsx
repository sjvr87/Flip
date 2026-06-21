import MobileOnlyScreen from '@/components/MobileOnlyScreen';

/** Default create tab — iOS/Android use platform-specific files. */
export default function CreateScreen() {
    return <MobileOnlyScreen title="Create" />;
}
