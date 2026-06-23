import React, { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = PropsWithChildren<{
    label?: string;
}>;

type State = {
    error: Error | null;
};

export class StartupErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[startup] ErrorBoundary caught:', error, info.componentStack);
    }

    private handleRetry = () => {
        this.setState({ error: null });
    };

    render() {
        const { error } = this.state;
        const { children, label = 'Flip' } = this.props;

        if (!error) {
            return children;
        }

        return (
            <View style={styles.root}>
                <Text style={styles.title}>{label} failed to start</Text>
                <Text style={styles.subtitle}>
                    JavaScript loaded but crashed during startup. Share this screen with support.
                </Text>
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    <Text style={styles.errorName}>{error.name}</Text>
                    <Text style={styles.errorMessage}>{error.message}</Text>
                    {error.stack ? <Text style={styles.stack}>{error.stack}</Text> : null}
                </ScrollView>
                <Pressable style={styles.button} onPress={this.handleRetry}>
                    <Text style={styles.buttonText}>Try again</Text>
                </Pressable>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#0f172a',
        paddingTop: 56,
        paddingHorizontal: 20,
        paddingBottom: 32,
    },
    title: {
        color: '#f8fafc',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 8,
    },
    subtitle: {
        color: '#94a3b8',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    scroll: {
        flex: 1,
        backgroundColor: '#1e293b',
        borderRadius: 12,
        marginBottom: 16,
    },
    scrollContent: {
        padding: 14,
    },
    errorName: {
        color: '#f87171',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 6,
    },
    errorMessage: {
        color: '#e2e8f0',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    stack: {
        color: '#94a3b8',
        fontSize: 11,
        lineHeight: 16,
        fontFamily: 'monospace',
    },
    button: {
        alignSelf: 'center',
        backgroundColor: '#2563eb',
        borderRadius: 10,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    buttonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
});
