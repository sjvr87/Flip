import { LOOP_ACCENT } from '@/constants/loopsPalette';
import { useTheme } from '@/contexts/ThemeContext';
import { checkHandleAvailability } from '@/atproto/createAccount';
import { useAuthStore } from '@/utils/authStore';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

type SignupStep = 'invite' | 'email' | 'phone' | 'dob' | 'handle' | 'password';

const STEPS: SignupStep[] = ['invite', 'email', 'phone', 'dob', 'handle', 'password'];
const MIN_AGE = 21;

function calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhone(phone: string): boolean {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    return /^\+?[0-9]{10,15}$/.test(cleaned);
}

function isValidHandle(handle: string): boolean {
    const cleaned = handle.replace(/^@/, '').split('.')[0];
    return /^[a-zA-Z0-9][a-zA-Z0-9-]{1,18}[a-zA-Z0-9]$/.test(cleaned);
}

export default function CreateAccountScreen() {
    const { isDark, colors } = useTheme();
    const createBlueskyAccount = useAuthStore((s) => s.createBlueskyAccount);

    const [step, setStep] = useState<SignupStep>('invite');
    const [inviteCode, setInviteCode] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [phoneCode, setPhoneCode] = useState('');
    const [showPhoneCode, setShowPhoneCode] = useState(false);
    const [dobMonth, setDobMonth] = useState('');
    const [dobDay, setDobDay] = useState('');
    const [dobYear, setDobYear] = useState('');
    const [handle, setHandle] = useState('');
    const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
    const [handleChecking, setHandleChecking] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentStepIndex = STEPS.indexOf(step);
    const totalSteps = STEPS.length;

    // Debounced handle availability check
    useEffect(() => {
        if (handleCheckTimeout.current) {
            clearTimeout(handleCheckTimeout.current);
        }

        if (!handle || !isValidHandle(handle)) {
            handleCheckTimeout.current = setTimeout(() => {
                setHandleChecking(false);
                setHandleAvailable(null);
            }, 0);
            return;
        }

        handleCheckTimeout.current = setTimeout(async () => {
            setHandleChecking(true);
            setHandleAvailable(null);
            const result = await checkHandleAvailability(handle);
            setHandleAvailable(result.available);
            setHandleChecking(false);
        }, 400);

        return () => {
            if (handleCheckTimeout.current) {
                clearTimeout(handleCheckTimeout.current);
            }
        };
    }, [handle]);

    const goNext = useCallback(() => {
        const nextIndex = currentStepIndex + 1;
        if (nextIndex < STEPS.length) {
            setError(null);
            setStep(STEPS[nextIndex]);
        }
    }, [currentStepIndex]);

    const goBack = useCallback(() => {
        if (currentStepIndex === 0) {
            router.back();
            return;
        }
        setError(null);
        setStep(STEPS[currentStepIndex - 1]);
    }, [currentStepIndex]);

    const validateCurrentStep = (): boolean => {
        switch (step) {
            case 'invite':
                if (!inviteCode.trim()) {
                    setError('Enter your invite code to continue.');
                    return false;
                }
                return true;

            case 'email':
                if (!isValidEmail(email)) {
                    setError('Enter a valid email address.');
                    return false;
                }
                return true;

            case 'phone':
                if (!isValidPhone(phone)) {
                    setError('Enter a valid phone number.');
                    return false;
                }
                if (showPhoneCode && !phoneVerified) {
                    setError('Enter the verification code sent to your phone.');
                    return false;
                }
                return true;

            case 'dob': {
                const month = parseInt(dobMonth, 10);
                const day = parseInt(dobDay, 10);
                const year = parseInt(dobYear, 10);
                if (!month || !day || !year || month < 1 || month > 12 || day < 1 || day > 31) {
                    setError('Enter a valid date of birth.');
                    return false;
                }
                const birthDate = new Date(year, month - 1, day);
                if (
                    isNaN(birthDate.getTime()) ||
                    birthDate.getMonth() !== month - 1 ||
                    birthDate.getDate() !== day
                ) {
                    setError('Enter a valid date of birth.');
                    return false;
                }
                const age = calculateAge(birthDate);
                if (age < MIN_AGE) {
                    setError('You are not eligible to use Flip at this time.');
                    return false;
                }
                return true;
            }

            case 'handle':
                if (!isValidHandle(handle)) {
                    setError('Handle must be 3-20 characters: letters, numbers, hyphens.');
                    return false;
                }
                if (handleAvailable === false) {
                    setError('This handle is already taken.');
                    return false;
                }
                return true;

            case 'password':
                if (password.length < 8) {
                    setError('Password must be at least 8 characters.');
                    return false;
                }
                if (password !== confirmPassword) {
                    setError('Passwords do not match.');
                    return false;
                }
                return true;

            default:
                return true;
        }
    };

    const handleContinue = () => {
        setError(null);
        if (!validateCurrentStep()) return;

        if (step === 'phone' && !showPhoneCode && !phoneVerified) {
            setShowPhoneCode(true);
            if (__DEV__) {
                setPhoneVerified(true);
                setTimeout(() => goNext(), 300);
            }
            return;
        }

        if (step === 'phone' && showPhoneCode && phoneCode.length >= 4) {
            setPhoneVerified(true);
            goNext();
            return;
        }

        if (step === 'password') {
            void handleSubmit();
            return;
        }

        goNext();
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const success = await createBlueskyAccount(
                email.trim(),
                handle.trim(),
                password,
                inviteCode.trim() || undefined,
            );

            if (success) {
                router.replace('/create-account/profile-setup' as any);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Account creation failed.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 'invite':
                return (
                    <View style={styles.stepContent}>
                        <View style={styles.stepHeader}>
                            <Ionicons name="ticket-outline" size={32} color="#FFE500" />
                            <Text style={[styles.stepTitle, isDark && styles.stepTitleDark]}>
                                Invite Code
                            </Text>
                            <Text style={[styles.stepSubtitle, isDark && styles.stepSubtitleDark]}>
                                Flip is in beta. Enter your invite code to get started.
                            </Text>
                        </View>
                        <TextInput
                            style={[styles.input, isDark && styles.inputDark]}
                            placeholder="Enter invite code"
                            placeholderTextColor={colors.placeholder}
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={inviteCode}
                            onChangeText={setInviteCode}
                        />
                    </View>
                );

            case 'email':
                return (
                    <View style={styles.stepContent}>
                        <View style={styles.stepHeader}>
                            <Ionicons name="mail-outline" size={32} color="#FFE500" />
                            <Text style={[styles.stepTitle, isDark && styles.stepTitleDark]}>
                                Email Address
                            </Text>
                            <Text style={[styles.stepSubtitle, isDark && styles.stepSubtitleDark]}>
                                We{"'"}ll send a verification link to confirm your email.
                            </Text>
                        </View>
                        <TextInput
                            style={[styles.input, isDark && styles.inputDark]}
                            placeholder="you@example.com"
                            placeholderTextColor={colors.placeholder}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            textContentType="emailAddress"
                            value={email}
                            onChangeText={setEmail}
                        />
                    </View>
                );

            case 'phone':
                return (
                    <View style={styles.stepContent}>
                        <View style={styles.stepHeader}>
                            <Ionicons name="phone-portrait-outline" size={32} color="#FFE500" />
                            <Text style={[styles.stepTitle, isDark && styles.stepTitleDark]}>
                                Phone Verification
                            </Text>
                            <Text style={[styles.stepSubtitle, isDark && styles.stepSubtitleDark]}>
                                {showPhoneCode
                                    ? 'Enter the code we sent to your phone.'
                                    : 'Verify your phone number for account security.'}
                            </Text>
                        </View>
                        {!showPhoneCode ? (
                            <TextInput
                                style={[styles.input, isDark && styles.inputDark]}
                                placeholder="+1 (555) 000-0000"
                                placeholderTextColor={colors.placeholder}
                                keyboardType="phone-pad"
                                textContentType="telephoneNumber"
                                value={phone}
                                onChangeText={setPhone}
                            />
                        ) : (
                            <View>
                                <TextInput
                                    style={[styles.input, isDark && styles.inputDark]}
                                    placeholder="Enter 6-digit code"
                                    placeholderTextColor={colors.placeholder}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    value={phoneCode}
                                    onChangeText={(text) => {
                                        setPhoneCode(text);
                                        // TODO: Wire to real SMS verification API (e.g. Twilio).
                                        // Currently auto-verifies for development/beta testing.
                                        if (text.length >= 6) {
                                            setPhoneVerified(true);
                                        }
                                    }}
                                />
                                {phoneVerified && (
                                    <View style={styles.verifiedBadge}>
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={20}
                                            color="#22c55e"
                                        />
                                        <Text style={styles.verifiedText}>Verified</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                );

            case 'dob':
                return (
                    <View style={styles.stepContent}>
                        <View style={styles.stepHeader}>
                            <Ionicons name="calendar-outline" size={32} color="#FFE500" />
                            <Text style={[styles.stepTitle, isDark && styles.stepTitleDark]}>
                                Date of Birth
                            </Text>
                            <Text style={[styles.stepSubtitle, isDark && styles.stepSubtitleDark]}>
                                To verify your identity.
                            </Text>
                        </View>
                        <View style={styles.dobRow}>
                            <TextInput
                                style={[styles.dobInput, isDark && styles.inputDark]}
                                placeholder="MM"
                                placeholderTextColor={colors.placeholder}
                                keyboardType="number-pad"
                                maxLength={2}
                                value={dobMonth}
                                onChangeText={setDobMonth}
                            />
                            <Text style={[styles.dobSeparator, isDark && { color: '#fff' }]}>
                                /
                            </Text>
                            <TextInput
                                style={[styles.dobInput, isDark && styles.inputDark]}
                                placeholder="DD"
                                placeholderTextColor={colors.placeholder}
                                keyboardType="number-pad"
                                maxLength={2}
                                value={dobDay}
                                onChangeText={setDobDay}
                            />
                            <Text style={[styles.dobSeparator, isDark && { color: '#fff' }]}>
                                /
                            </Text>
                            <TextInput
                                style={[styles.dobInputYear, isDark && styles.inputDark]}
                                placeholder="YYYY"
                                placeholderTextColor={colors.placeholder}
                                keyboardType="number-pad"
                                maxLength={4}
                                value={dobYear}
                                onChangeText={setDobYear}
                            />
                        </View>
                    </View>
                );

            case 'handle':
                return (
                    <View style={styles.stepContent}>
                        <View style={styles.stepHeader}>
                            <Ionicons name="at-outline" size={32} color="#FFE500" />
                            <Text style={[styles.stepTitle, isDark && styles.stepTitleDark]}>
                                Choose Your Handle
                            </Text>
                            <Text style={[styles.stepSubtitle, isDark && styles.stepSubtitleDark]}>
                                This is how people will find you on Flip.
                            </Text>
                        </View>
                        <View style={styles.handleInputRow}>
                            <TextInput
                                style={[styles.input, isDark && styles.inputDark, { flex: 1 }]}
                                placeholder="yourname"
                                placeholderTextColor={colors.placeholder}
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={handle}
                                onChangeText={setHandle}
                            />
                            {handleChecking && (
                                <ActivityIndicator
                                    size="small"
                                    color={LOOP_ACCENT}
                                    style={styles.handleStatus}
                                />
                            )}
                            {!handleChecking && handleAvailable === true && (
                                <Ionicons
                                    name="checkmark-circle"
                                    size={22}
                                    color="#22c55e"
                                    style={styles.handleStatus}
                                />
                            )}
                            {!handleChecking && handleAvailable === false && (
                                <Ionicons
                                    name="close-circle"
                                    size={22}
                                    color="#ef4444"
                                    style={styles.handleStatus}
                                />
                            )}
                        </View>
                        <Text style={[styles.handleHint, isDark && styles.handleHintDark]}>
                            @{handle || 'yourname'}.bsky.social
                        </Text>
                    </View>
                );

            case 'password':
                return (
                    <View style={styles.stepContent}>
                        <View style={styles.stepHeader}>
                            <Ionicons name="lock-closed-outline" size={32} color="#FFE500" />
                            <Text style={[styles.stepTitle, isDark && styles.stepTitleDark]}>
                                Create Password
                            </Text>
                            <Text style={[styles.stepSubtitle, isDark && styles.stepSubtitleDark]}>
                                At least 8 characters. Make it memorable.
                            </Text>
                        </View>
                        <TextInput
                            style={[styles.input, isDark && styles.inputDark]}
                            placeholder="Password"
                            placeholderTextColor={colors.placeholder}
                            secureTextEntry
                            textContentType="newPassword"
                            value={password}
                            onChangeText={setPassword}
                        />
                        <TextInput
                            style={[styles.input, isDark && styles.inputDark, { marginTop: 12 }]}
                            placeholder="Confirm password"
                            placeholderTextColor={colors.placeholder}
                            secureTextEntry
                            textContentType="newPassword"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                        />
                    </View>
                );

            default:
                return null;
        }
    };

    const content = (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled">
                <View style={styles.progressContainer}>
                    <View style={[styles.progressTrack, isDark && styles.progressTrackDark]}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${((currentStepIndex + 1) / totalSteps) * 100}%` },
                            ]}
                        />
                    </View>
                    <Text style={[styles.progressText, isDark && styles.progressTextDark]}>
                        {currentStepIndex + 1} / {totalSteps}
                    </Text>
                </View>

                <Image
                    source={require('../../../assets/images/flip-logo.png')}
                    style={styles.logo}
                    contentFit="contain"
                    accessibilityLabel="Flip"
                />

                {renderStepContent()}

                {error && (
                    <Text style={[styles.errorText, isDark && styles.errorTextDark]}>{error}</Text>
                )}

                <View style={styles.buttonRow}>
                    <Pressable style={styles.backButton} onPress={goBack}>
                        <Ionicons
                            name="arrow-back"
                            size={22}
                            color={isDark ? '#fff' : 'rgba(255,255,255,0.9)'}
                        />
                    </Pressable>

                    <Pressable
                        style={[styles.continueButton, isLoading && styles.buttonDisabled]}
                        onPress={handleContinue}
                        disabled={isLoading}>
                        {isLoading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.continueButtonText}>
                                {step === 'password' ? 'Create Account' : 'Continue'}
                            </Text>
                        )}
                    </Pressable>
                </View>

                <Pressable style={styles.signInLink} onPress={() => router.replace('/sign-in')}>
                    <Text style={[styles.signInLinkText, isDark && styles.signInLinkTextDark]}>
                        Already have an account? Sign in
                    </Text>
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
    );

    if (isDark) {
        return (
            <View style={[styles.root, { backgroundColor: colors.background }]}>
                <StatusBar style="light" />
                {content}
            </View>
        );
    }

    return (
        <LinearGradient colors={['#0085ff', '#0060df', '#003880']} style={styles.root}>
            <StatusBar style="light" />
            {content}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    container: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingTop: 60,
        paddingBottom: 32,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        gap: 10,
    },
    progressTrack: {
        flex: 1,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressTrackDark: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#FFE500',
        borderRadius: 2,
    },
    progressText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
    },
    progressTextDark: {
        color: 'rgba(255,255,255,0.5)',
    },
    logo: {
        width: 80,
        aspectRatio: 980 / 1024,
        alignSelf: 'center',
        marginBottom: 24,
    },
    stepContent: {
        gap: 16,
    },
    stepHeader: {
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    stepTitle: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
    },
    stepTitleDark: { color: '#ffffff' },
    stepSubtitle: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    stepSubtitleDark: { color: 'rgba(255,255,255,0.6)' },
    input: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#0f172a',
    },
    inputDark: {
        backgroundColor: '#1c1c1e',
        borderWidth: 1,
        borderColor: '#3a3a3c',
        color: '#ffffff',
    },
    dobRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dobInput: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#0f172a',
        width: 60,
        textAlign: 'center',
    },
    dobInputYear: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#0f172a',
        width: 80,
        textAlign: 'center',
    },
    dobSeparator: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 20,
        fontWeight: '300',
    },
    handleInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    handleStatus: {
        position: 'absolute',
        right: 14,
        top: 16,
    },
    handleHint: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        marginTop: -4,
    },
    handleHintDark: { color: 'rgba(255,255,255,0.4)' },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    verifiedText: {
        color: '#22c55e',
        fontSize: 14,
        fontWeight: '600',
    },
    errorText: {
        color: '#fecaca',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 12,
    },
    errorTextDark: { color: '#f87171' },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 28,
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueButton: {
        flex: 1,
        backgroundColor: '#FFE500',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    continueButtonText: {
        color: '#000000',
        fontSize: 17,
        fontWeight: '700',
    },
    buttonDisabled: { opacity: 0.5 },
    signInLink: {
        marginTop: 20,
        paddingVertical: 8,
        alignItems: 'center',
    },
    signInLinkText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
    },
    signInLinkTextDark: { color: 'rgba(255,255,255,0.5)' },
});
