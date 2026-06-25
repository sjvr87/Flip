import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/utils/authStore';
import { Storage } from '@/utils/cache';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOP8_SLOT_SIZE = (SCREEN_WIDTH - 56 - 36) / 4; // 4 columns with gaps

type ProfileSection = 'basics' | 'vibe' | 'music' | 'top8';

const PROFILE_SECTIONS: ProfileSection[] = ['basics', 'vibe', 'music', 'top8'];

const THEME_PRESETS = [
    { id: 'midnight', label: 'Midnight', colors: ['#0f0c29', '#302b63', '#24243e'] },
    { id: 'sunset', label: 'Sunset', colors: ['#ee9ca7', '#ffdde1', '#ee9ca7'] },
    { id: 'ocean', label: 'Ocean', colors: ['#2193b0', '#6dd5ed', '#2193b0'] },
    { id: 'neon', label: 'Neon', colors: ['#0f0f0f', '#1a1a2e', '#16213e'] },
    { id: 'sakura', label: 'Sakura', colors: ['#fbc2eb', '#a6c1ee', '#fbc2eb'] },
    { id: 'fire', label: 'Fire', colors: ['#f12711', '#f5af19', '#f12711'] },
    { id: 'forest', label: 'Forest', colors: ['#134e5e', '#71b280', '#134e5e'] },
    { id: 'space', label: 'Space', colors: ['#000000', '#130f40', '#000000'] },
];

const FONT_OPTIONS = [
    { id: 'default', label: 'Default' },
    { id: 'serif', label: 'Serif' },
    { id: 'mono', label: 'Mono' },
    { id: 'handwritten', label: 'Script' },
];

export default function ProfileSetupScreen() {
    const { isDark, colors } = useTheme();
    const completeOnboarding = useAuthStore((s) => s.completeOnboarding);

    const [section, setSection] = useState<ProfileSection>('basics');
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [selectedTheme, setSelectedTheme] = useState('midnight');
    const [selectedFont, setSelectedFont] = useState('default');
    const [profileSong, setProfileSong] = useState('');
    const [songArtist, setSongArtist] = useState('');
    const [top8, setTop8] = useState<{ handle: string; label: string }[]>([]);
    const [newTop8Handle, setNewTop8Handle] = useState('');

    const sectionIndex = PROFILE_SECTIONS.indexOf(section);

    const goNextSection = () => {
        const next = sectionIndex + 1;
        if (next < PROFILE_SECTIONS.length) {
            setSection(PROFILE_SECTIONS[next]);
        } else {
            handleFinish();
        }
    };

    const goPrevSection = () => {
        if (sectionIndex > 0) {
            setSection(PROFILE_SECTIONS[sectionIndex - 1]);
        }
    };

    const handleFinish = () => {
        // Persist profile customizations locally (server sync in later phase)
        Storage.set(
            'flip.profile.setup',
            JSON.stringify({
                displayName,
                bio,
                theme: selectedTheme,
                font: selectedFont,
                profileSong,
                songArtist,
                top8,
            }),
        );
        completeOnboarding();
        router.replace('/(tabs)');
    };

    const addTop8 = () => {
        const trimmed = newTop8Handle.trim().replace(/^@/, '');
        if (!trimmed || top8.length >= 8) return;
        if (top8.some((entry) => entry.handle === trimmed)) return;

        setTop8([...top8, { handle: trimmed, label: '' }]);
        setNewTop8Handle('');
    };

    const removeTop8 = (handle: string) => {
        setTop8(top8.filter((entry) => entry.handle !== handle));
    };

    const renderSection = () => {
        switch (section) {
            case 'basics':
                return (
                    <View style={styles.sectionContent}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="person-circle-outline" size={36} color="#FFE500" />
                            <Text style={[styles.sectionTitle, isDark && styles.textWhite]}>
                                Set Up Your Profile
                            </Text>
                            <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>
                                Let people know who you are.
                            </Text>
                        </View>

                        <Text style={[styles.label, isDark && styles.labelDark]}>Display Name</Text>
                        <TextInput
                            style={[styles.input, isDark && styles.inputDark]}
                            placeholder="Your name"
                            placeholderTextColor={colors.placeholder}
                            value={displayName}
                            onChangeText={setDisplayName}
                            maxLength={50}
                        />

                        <Text style={[styles.label, isDark && styles.labelDark]}>Bio</Text>
                        <TextInput
                            style={[styles.input, isDark && styles.inputDark, styles.bioInput]}
                            placeholder="Tell the world about yourself..."
                            placeholderTextColor={colors.placeholder}
                            value={bio}
                            onChangeText={setBio}
                            maxLength={300}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                        <Text style={[styles.charCount, isDark && styles.textMuted]}>
                            {bio.length}/300
                        </Text>
                    </View>
                );

            case 'vibe':
                return (
                    <View style={styles.sectionContent}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="color-palette-outline" size={36} color="#FFE500" />
                            <Text style={[styles.sectionTitle, isDark && styles.textWhite]}>
                                Customize Your Vibe
                            </Text>
                            <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>
                                Make your profile uniquely yours.
                            </Text>
                        </View>

                        <Text style={[styles.label, isDark && styles.labelDark]}>
                            Profile Theme
                        </Text>
                        <View style={styles.themeGrid}>
                            {THEME_PRESETS.map((theme) => (
                                <Pressable
                                    key={theme.id}
                                    onPress={() => setSelectedTheme(theme.id)}
                                    style={[
                                        styles.themePreview,
                                        selectedTheme === theme.id && styles.themeSelected,
                                    ]}>
                                    <LinearGradient
                                        colors={theme.colors as [string, string, ...string[]]}
                                        style={styles.themeGradient}
                                    />
                                    <Text style={styles.themeLabel}>{theme.label}</Text>
                                </Pressable>
                            ))}
                        </View>

                        <Text style={[styles.label, isDark && styles.labelDark, { marginTop: 20 }]}>
                            Font Style
                        </Text>
                        <View style={styles.fontRow}>
                            {FONT_OPTIONS.map((font) => (
                                <Pressable
                                    key={font.id}
                                    onPress={() => setSelectedFont(font.id)}
                                    style={[
                                        styles.fontOption,
                                        selectedFont === font.id && styles.fontSelected,
                                    ]}>
                                    <Text
                                        style={[
                                            styles.fontLabel,
                                            selectedFont === font.id && styles.fontLabelSelected,
                                        ]}>
                                        {font.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                );

            case 'music':
                return (
                    <View style={styles.sectionContent}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="musical-notes-outline" size={36} color="#FFE500" />
                            <Text style={[styles.sectionTitle, isDark && styles.textWhite]}>
                                Your Profile Song
                            </Text>
                            <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>
                                Add a song that plays on your profile. Classic MySpace energy.
                            </Text>
                        </View>

                        <Text style={[styles.label, isDark && styles.labelDark]}>Song Title</Text>
                        <TextInput
                            style={[styles.input, isDark && styles.inputDark]}
                            placeholder="e.g. Bohemian Rhapsody"
                            placeholderTextColor={colors.placeholder}
                            value={profileSong}
                            onChangeText={setProfileSong}
                        />

                        <Text style={[styles.label, isDark && styles.labelDark]}>Artist</Text>
                        <TextInput
                            style={[styles.input, isDark && styles.inputDark]}
                            placeholder="e.g. Queen"
                            placeholderTextColor={colors.placeholder}
                            value={songArtist}
                            onChangeText={setSongArtist}
                        />

                        {profileSong && songArtist ? (
                            <View style={styles.songPreview}>
                                <View style={styles.songPreviewIcon}>
                                    <Ionicons name="play" size={18} color="#FFE500" />
                                </View>
                                <View style={styles.songPreviewText}>
                                    <Text style={styles.songTitle} numberOfLines={1}>
                                        {profileSong}
                                    </Text>
                                    <Text style={styles.songArtist} numberOfLines={1}>
                                        {songArtist}
                                    </Text>
                                </View>
                                <Ionicons
                                    name="musical-note"
                                    size={16}
                                    color="rgba(255,255,255,0.5)"
                                />
                            </View>
                        ) : null}

                        <Text style={[styles.hintText, isDark && styles.textMuted]}>
                            Music integration with streaming services coming soon. For now, set your
                            vibe and we{"'"}ll match it later.
                        </Text>
                    </View>
                );

            case 'top8':
                return (
                    <View style={styles.sectionContent}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="people-outline" size={36} color="#FFE500" />
                            <Text style={[styles.sectionTitle, isDark && styles.textWhite]}>
                                Your Top 8
                            </Text>
                            <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>
                                Pin your top friends, creators, or people you follow. They{"'"}ll be
                                featured on your profile.
                            </Text>
                        </View>

                        <View style={styles.top8Input}>
                            <TextInput
                                style={[styles.input, isDark && styles.inputDark, { flex: 1 }]}
                                placeholder="@handle"
                                placeholderTextColor={colors.placeholder}
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={newTop8Handle}
                                onChangeText={setNewTop8Handle}
                                onSubmitEditing={addTop8}
                            />
                            <Pressable
                                style={[
                                    styles.addButton,
                                    (!newTop8Handle.trim() || top8.length >= 8) &&
                                        styles.buttonDisabled,
                                ]}
                                onPress={addTop8}
                                disabled={!newTop8Handle.trim() || top8.length >= 8}>
                                <Ionicons name="add" size={22} color="#000" />
                            </Pressable>
                        </View>

                        <Text style={[styles.top8Count, isDark && styles.textMuted]}>
                            {top8.length}/8 slots filled
                        </Text>

                        {top8.length > 0 ? (
                            <View style={styles.top8Grid}>
                                {top8.map((entry, index) => (
                                    <View key={entry.handle} style={styles.top8Slot}>
                                        <View style={styles.top8Avatar}>
                                            <Text style={styles.top8Number}>{index + 1}</Text>
                                        </View>
                                        <Text style={styles.top8Handle} numberOfLines={1}>
                                            @{entry.handle}
                                        </Text>
                                        <Pressable
                                            onPress={() => removeTop8(entry.handle)}
                                            hitSlop={8}
                                            style={styles.top8Remove}>
                                            <Ionicons
                                                name="close-circle"
                                                size={18}
                                                color="#ef4444"
                                            />
                                        </Pressable>
                                    </View>
                                ))}

                                {/* Empty slots */}
                                {Array.from({ length: 8 - top8.length }).map((_, i) => (
                                    <View key={`empty-${i}`} style={styles.top8Slot}>
                                        <View style={[styles.top8Avatar, styles.top8AvatarEmpty]}>
                                            <Ionicons
                                                name="person-add-outline"
                                                size={16}
                                                color="rgba(255,255,255,0.3)"
                                            />
                                        </View>
                                        <Text style={styles.top8EmptyLabel}>Empty</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.top8Empty}>
                                <Ionicons name="people" size={48} color="rgba(255,255,255,0.2)" />
                                <Text style={[styles.top8EmptyText, isDark && styles.textMuted]}>
                                    Add handles to pin them to your profile
                                </Text>
                            </View>
                        )}
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#0a0a12' }]}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#0a0a12', '#111118', '#0a0a12']}
                style={StyleSheet.absoluteFill}
            />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled">
                {/* Section tabs */}
                <View style={styles.tabRow}>
                    {PROFILE_SECTIONS.map((s, i) => (
                        <Pressable
                            key={s}
                            onPress={() => setSection(s)}
                            style={[styles.tab, section === s && styles.tabActive]}>
                            <View
                                style={[styles.tabDot, i <= sectionIndex && styles.tabDotActive]}
                            />
                            <Text style={[styles.tabLabel, section === s && styles.tabLabelActive]}>
                                {s === 'top8' ? 'Top 8' : s.charAt(0).toUpperCase() + s.slice(1)}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {renderSection()}

                {/* Navigation */}
                <View style={styles.navRow}>
                    {sectionIndex > 0 && (
                        <Pressable style={styles.navBack} onPress={goPrevSection}>
                            <Ionicons name="arrow-back" size={22} color="#fff" />
                        </Pressable>
                    )}
                    <Pressable style={styles.navNext} onPress={goNextSection}>
                        <Text style={styles.navNextText}>
                            {sectionIndex === PROFILE_SECTIONS.length - 1 ? 'Finish Setup' : 'Next'}
                        </Text>
                        <Ionicons name="arrow-forward" size={18} color="#000" />
                    </Pressable>
                </View>

                {/* Skip */}
                <Pressable style={styles.skipLink} onPress={handleFinish}>
                    <Text style={styles.skipText}>Skip for now</Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingTop: 60,
        paddingBottom: 40,
    },
    tabRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 28,
        gap: 4,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
        paddingVertical: 8,
    },
    tabActive: {},
    tabDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    tabDotActive: {
        backgroundColor: '#FFE500',
    },
    tabLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        fontWeight: '600',
    },
    tabLabelActive: {
        color: '#FFE500',
    },
    sectionContent: {
        gap: 12,
    },
    sectionHeader: {
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
    },
    sectionSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    textWhite: { color: '#ffffff' },
    textMuted: { color: 'rgba(255,255,255,0.5)' },
    label: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 8,
        marginBottom: 4,
    },
    labelDark: { color: 'rgba(255,255,255,0.7)' },
    input: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#ffffff',
    },
    inputDark: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.12)',
    },
    bioInput: {
        minHeight: 100,
        paddingTop: 14,
    },
    charCount: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        textAlign: 'right',
        marginTop: -4,
    },
    themeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 4,
    },
    themePreview: {
        width: (SCREEN_WIDTH - 56 - 30) / 4,
        height: 60,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    themeSelected: {
        borderColor: '#FFE500',
    },
    themeGradient: {
        flex: 1,
    },
    themeLabel: {
        position: 'absolute',
        bottom: 4,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#fff',
        fontSize: 9,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    fontRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    fontOption: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
    },
    fontSelected: {
        borderColor: '#FFE500',
        backgroundColor: 'rgba(255,229,0,0.1)',
    },
    fontLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: '500',
    },
    fontLabelSelected: {
        color: '#FFE500',
    },
    songPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,229,0,0.08)',
        borderRadius: 12,
        padding: 12,
        gap: 10,
        marginTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,229,0,0.2)',
    },
    songPreviewIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,229,0,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    songPreviewText: {
        flex: 1,
    },
    songTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    songArtist: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginTop: 2,
    },
    hintText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 18,
    },
    top8Input: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFE500',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: { opacity: 0.4 },
    top8Count: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginTop: 4,
    },
    top8Grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 12,
    },
    top8Slot: {
        width: TOP8_SLOT_SIZE,
        alignItems: 'center',
        gap: 4,
    },
    top8Avatar: {
        width: TOP8_SLOT_SIZE - 12,
        height: TOP8_SLOT_SIZE - 12,
        borderRadius: (TOP8_SLOT_SIZE - 12) / 2,
        backgroundColor: 'rgba(255,229,0,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,229,0,0.3)',
    },
    top8AvatarEmpty: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderStyle: 'dashed',
    },
    top8Number: {
        color: '#FFE500',
        fontSize: 16,
        fontWeight: '700',
    },
    top8Handle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 10,
        textAlign: 'center',
    },
    top8Remove: {
        position: 'absolute',
        top: -4,
        right: 4,
    },
    top8EmptyLabel: {
        color: 'rgba(255,255,255,0.25)',
        fontSize: 10,
    },
    top8Empty: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 8,
    },
    top8EmptyText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        textAlign: 'center',
    },
    navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 32,
    },
    navBack: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navNext: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#FFE500',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    navNextText: {
        color: '#000000',
        fontSize: 17,
        fontWeight: '700',
    },
    skipLink: {
        marginTop: 16,
        paddingVertical: 10,
        alignItems: 'center',
    },
    skipText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
    },
});
