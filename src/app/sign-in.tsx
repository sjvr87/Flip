import { LOOP_ACCENT } from '@/constants/loopsPalette'
import { XStack } from '@/components/ui/Stack'
import { useTheme } from '@/contexts/ThemeContext'
import { getSavedCredentials } from '@/atproto/credentialVault'
import { openBrowser } from '@/atproto/auth'
import { authenticateWithBiometric, canUseBiometrics, getBiometricLabel } from '@/utils/biometricAuth'
import { useAuthStore } from '@/utils/authStore'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import tw from 'twrnc'

type SignInMode = 'loading' | 'unlock' | 'password' | 'full'

function formatHandle(identifier: string): string {
  if (identifier.includes('@')) return identifier
  return identifier.includes('.') ? `@${identifier}` : identifier
}

export default function SignInScreen() {
  const loginWithBluesky = useAuthStore((s) => s.loginWithBluesky)
  const unlockWithSavedCredentials = useAuthStore((s) => s.unlockWithSavedCredentials)
  const clearSavedLogin = useAuthStore((s) => s.clearSavedLogin)
  const requireBiometric = useAuthStore((s) => s.requireBiometric)
  const rememberLogin = useAuthStore((s) => s.rememberLogin)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const cachedUser = useAuthStore((s) => s.user)
  const { isDark, colors } = useTheme()

  const [mode, setMode] = useState<SignInMode>('loading')
  const [savedHandle, setSavedHandle] = useState<string | null>(null)
  const [biometricLabel, setBiometricLabel] = useState('Fingerprint')
  const [biometricsAvailable, setBiometricsAvailable] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [service, setService] = useState('bsky.social')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('Signing you in...')
  const biometricAttempted = useRef(false)

  useEffect(() => {
    if (hasHydrated && isLoggedIn) {
      router.replace('/(tabs)')
    }
  }, [hasHydrated, isLoggedIn])

  const runBiometricUnlock = useCallback(async () => {
    setIsLoading(true)
    setStatusMessage('Verifying…')
    try {
      const ok = await authenticateWithBiometric('Unlock Flip')
      if (!ok) {
        setMode('password')
        return false
      }

      setStatusMessage('Signing you in...')
      const success = await unlockWithSavedCredentials()
      if (success) {
        router.replace('/(tabs)')
        return true
      }
      setMode('password')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [unlockWithSavedCredentials])

  useEffect(() => {
    if (!hasHydrated || isLoggedIn) return

    const loadingFailsafe = setTimeout(() => {
      setMode((current) => (current === 'loading' ? 'full' : current))
      setIsLoading(false)
    }, 4000)

    let cancelled = false

    ;(async () => {
      const creds = await getSavedCredentials()
      const bioAvailable = await canUseBiometrics()
      const label = await getBiometricLabel()

      if (cancelled) return

      setBiometricsAvailable(bioAvailable)
      setBiometricLabel(label)

      if (creds && rememberLogin) {
        setSavedHandle(creds.identifier)
        setIdentifier(creds.identifier)
        setService(creds.service || 'bsky.social')

        if (requireBiometric && bioAvailable) {
          setMode('unlock')
        } else if (!requireBiometric) {
          setIsLoading(true)
          setStatusMessage('Signing you in...')
          const success = await unlockWithSavedCredentials()
          if (cancelled) return
          if (success) {
            router.replace('/(tabs)')
            return
          }
          setMode('password')
          setIsLoading(false)
        } else {
          setMode('password')
        }
      } else {
        setMode('full')
      }
    })()

    return () => {
      cancelled = true
      clearTimeout(loadingFailsafe)
    }
  }, [hasHydrated, isLoggedIn, rememberLogin, requireBiometric, unlockWithSavedCredentials])

  useEffect(() => {
    if (mode !== 'unlock' || biometricAttempted.current || isLoading) return
    biometricAttempted.current = true
    void runBiometricUnlock()
  }, [mode, isLoading, runBiometricUnlock])

  const handleLogin = async () => {
    const loginIdentifier = (identifier.trim() || savedHandle?.trim() || '')
    if (!loginIdentifier || !password.trim()) {
      Alert.alert(
        'Missing information',
        'Enter your Bluesky handle and app password to continue.',
      )
      return
    }

    setLoginError(null)
    setIsLoading(true)
    setStatusMessage('Signing you in...')
    try {
      const success = await loginWithBluesky(
        loginIdentifier,
        password.trim(),
        service.trim() || undefined,
      )
      if (!success) {
        setLoginError('Login failed. Check your handle and app password.')
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Login failed. Please try again.'
      setLoginError(message)
      Alert.alert('Login failed', message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseDifferentAccount = async () => {
    await clearSavedLogin()
    biometricAttempted.current = false
    setSavedHandle(null)
    setIdentifier('')
    setPassword('')
    setService('bsky.social')
    setShowAdvanced(false)
    setMode('full')
  }

  const openAppPasswordHelp = () => {
    openBrowser('https://bsky.app/settings/app-passwords')
  }

  const displayHandle = savedHandle ? formatHandle(savedHandle) : null
  const avatarUri = cachedUser?.avatar

  const loadingView = (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#ffffff" />
      <Text style={[styles.statusText, isDark && styles.statusTextDark]}>{statusMessage}</Text>
    </View>
  )

  const unlockView = (
    <View style={styles.centered}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={40} color="rgba(255,255,255,0.8)" />
        </View>
      )}

      <Text style={[styles.welcomeTitle, isDark && styles.welcomeTitleDark]}>Welcome back</Text>
      {displayHandle ? (
        <Text style={[styles.welcomeHandle, isDark && styles.welcomeHandleDark]}>
          {displayHandle}
        </Text>
      ) : null}

      <Pressable
        style={[styles.biometricButton, isLoading && styles.buttonDisabled]}
        onPress={() => void runBiometricUnlock()}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#0060df" />
        ) : (
          <>
            <Ionicons name="finger-print" size={28} color="#0060df" />
            <Text style={styles.biometricButtonText}>Unlock with {biometricLabel}</Text>
          </>
        )}
      </Pressable>

      <Pressable style={styles.textLink} onPress={() => setMode('password')}>
        <Text style={[styles.textLinkLabel, isDark && styles.textLinkLabelDark]}>
          Use app password instead
        </Text>
      </Pressable>

      <Pressable style={styles.textLink} onPress={() => void handleUseDifferentAccount()}>
        <Text style={[styles.textLinkLabelMuted, isDark && styles.textLinkLabelMutedDark]}>
          Use a different account
        </Text>
      </Pressable>
    </View>
  )

  const formView = (
    <View style={styles.form}>
      {savedHandle && mode === 'password' ? (
        <>
          <Text style={[styles.welcomeTitle, isDark && styles.welcomeTitleDark, { marginBottom: 4 }]}>
            Welcome back
          </Text>
          <Text
            style={[
              styles.welcomeHandle,
              isDark && styles.welcomeHandleDark,
              { marginBottom: 20, textAlign: 'left' },
            ]}
          >
            {displayHandle}
          </Text>
        </>
      ) : null}

      {mode === 'full' ? (
        <>
          <Text style={[styles.label, isDark && styles.labelDark]}>Bluesky handle or email</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            placeholder="you.bsky.social"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            value={identifier}
            onChangeText={setIdentifier}
            textContentType="username"
          />
        </>
      ) : null}

      <Text style={[styles.label, isDark && styles.labelDark]}>App password</Text>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        placeholder="xxxx-xxxx-xxxx-xxxx"
        placeholderTextColor={colors.placeholder}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        textContentType="password"
        autoFocus={mode === 'password'}
      />

      {mode === 'full' && showAdvanced ? (
        <>
          <Text style={[styles.label, isDark && styles.labelDark]}>Server</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            placeholder="bsky.social"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            value={service}
            onChangeText={setService}
          />
        </>
      ) : null}

      {mode === 'full' ? (
        <Pressable style={styles.helpLink} onPress={openAppPasswordHelp}>
          <Text style={[styles.helpText, isDark && styles.helpTextDark]}>
            How to create an app password →
          </Text>
        </Pressable>
      ) : null}

      {mode === 'full' && !showAdvanced ? (
        <Pressable style={styles.textLink} onPress={() => setShowAdvanced(true)}>
          <Text style={[styles.textLinkLabelMuted, isDark && styles.textLinkLabelMutedDark]}>
            Advanced options
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        style={[
          styles.button,
          isDark && styles.buttonDark,
          (!identifier && !savedHandle) || !password || isLoading
            ? styles.buttonDisabled
            : null,
        ]}
        onPress={() => void handleLogin()}
        disabled={(!identifier && !savedHandle) || !password || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={isDark ? '#fff' : LOOP_ACCENT} />
        ) : (
          <Text style={[styles.buttonText, isDark && styles.buttonTextDark]}>Sign in</Text>
        )}
      </Pressable>

      {loginError ? (
        <Text style={[styles.errorText, isDark && styles.errorTextDark]}>{loginError}</Text>
      ) : null}

      {savedHandle || mode === 'password' ? (
        <>
          {biometricsAvailable && requireBiometric ? (
            <Pressable
              style={styles.textLink}
              onPress={() => {
                biometricAttempted.current = false
                setMode('unlock')
              }}
            >
              <Text style={[styles.textLinkLabel, isDark && styles.textLinkLabelDark]}>
                Unlock with {biometricLabel}
              </Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.textLink} onPress={() => void handleUseDifferentAccount()}>
            <Text style={[styles.textLinkLabelMuted, isDark && styles.textLinkLabelMutedDark]}>
              Use a different account
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  )

  const content = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        {mode !== 'unlock' && mode !== 'loading' ? (
          <>
            <Image
              source={require('../../assets/images/flip-logo.png')}
              style={styles.logo}
              contentFit="contain"
              accessibilityLabel="Flip"
            />
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              Short video on Bluesky
            </Text>
          </>
        ) : null}

        {mode === 'loading' ? loadingView : null}
        {mode === 'unlock' ? unlockView : null}
        {mode === 'full' || mode === 'password' ? formView : null}

        {mode !== 'loading' ? (
          <XStack justifyContent="center" style={{ marginTop: 24 }}>
            <Text style={[styles.footer, isDark && styles.footerDark]}>
              Uses the AT Protocol · Not affiliated with Bluesky PBLLC
            </Text>
          </XStack>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  )

  if (isDark) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar style="light" />
        {content}
      </View>
    )
  }

  return (
    <LinearGradient colors={['#0085ff', '#0060df', '#003880']} style={styles.root}>
      <StatusBar style="light" />
      {content}
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  centered: {
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 140,
    aspectRatio: 980 / 1024,
    alignSelf: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 36,
  },
  subtitleDark: {
    color: 'rgba(255,255,255,0.7)',
  },
  statusText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    marginTop: 16,
  },
  statusTextDark: {
    color: 'rgba(255,255,255,0.75)',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 8,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  welcomeTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  welcomeTitleDark: {
    color: '#ffffff',
  },
  welcomeHandle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeHandleDark: {
    color: 'rgba(255,255,255,0.7)',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 28,
    marginTop: 12,
  },
  biometricButtonText: {
    color: '#0060df',
    fontSize: 17,
    fontWeight: '700',
  },
  textLink: {
    marginTop: 8,
    paddingVertical: 6,
  },
  textLinkLabel: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  textLinkLabelDark: {
    color: LOOP_ACCENT,
    textDecorationLine: 'none',
  },
  textLinkLabelMuted: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    textAlign: 'center',
  },
  textLinkLabelMutedDark: {
    color: 'rgba(255,255,255,0.45)',
  },
  form: { gap: 8 },
  label: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  labelDark: {
    color: 'rgba(255,255,255,0.85)',
  },
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
  helpLink: { marginTop: 8, marginBottom: 8 },
  helpText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  helpTextDark: {
    color: LOOP_ACCENT,
    textDecorationLine: 'none',
  },
  button: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDark: {
    backgroundColor: LOOP_ACCENT,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: '#0060df',
    fontSize: 17,
    fontWeight: '700',
  },
  buttonTextDark: {
    color: '#ffffff',
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  errorTextDark: {
    color: '#f87171',
  },
  footer: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textAlign: 'center',
  },
  footerDark: {
    color: 'rgba(255,255,255,0.4)',
  },
})
