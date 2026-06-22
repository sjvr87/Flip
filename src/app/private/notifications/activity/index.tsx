import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ActivityNotificationsScreen() {
    const params = useLocalSearchParams();
    return <Redirect href={{ pathname: '/private/notifications', params: { ...params, tab: 'activity' } }} />;
}
