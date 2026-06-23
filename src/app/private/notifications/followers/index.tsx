import { Redirect, useLocalSearchParams } from 'expo-router';

export default function FollowerNotificationsScreen() {
    const params = useLocalSearchParams();
    return (
        <Redirect
            href={{ pathname: '/private/notifications', params: { ...params, tab: 'followers' } }}
        />
    );
}
