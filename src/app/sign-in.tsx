import { StackText, XStack } from '@/components/ui/Stack'
import { useAuthStore } from '@/utils/authStore'
import { openBrowser } from '@/atproto/auth'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import tw from 'twrnc'

export default function SignInScreen() {
  const loginWithBluesky = useAuthStore((s) => s.loginWithBluesky)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [service, setService] = useState('bsky.social')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) return

    setIsLoading(true)
    try {
      const success = await loginWithBluesky(
        identifier.trim(),
        password.trim(),
        service.trim() || undefined,
      )
      if (success) {
        router.replace('/(tabs)')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const openAppPasswordHelp = () => {
    openBrowser('https://bsky.app/settings/app-passwords')
  }

  return (
    <LinearGradient colors={['#0085ff', '#0060df', '#003880']} style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.inner}>
          <StackText
            fontSize="$10"
            fontWeight="bold"
            textColor="text-white"
            style={{ textAlign: 'center', marginBottom: 8 }}
          >
            Flip
          </StackText>
          <Text style={styles.subtitle}>Short video on Bluesky</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Bluesky handle or email</Text>
            <TextInput
              style={styles.input}
              placeholder="you.bsky.social"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              value={identifier}
              onChangeText={setIdentifier}
              textContentType="username"
            />

            <Text style={styles.label}>App password</Text>
            <TextInput
              style={styles.input}
              placeholder="xxxx-xxxx-xxxx-xxxx"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              textContentType="password"
            />

            <Text style={styles.label}>Server (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="bsky.social"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              value={service}
              onChangeText={setService}
            />

            <Pressable style={styles.helpLink} onPress={openAppPasswordHelp}>
              <Text style={styles.helpText}>How to create an app password →</Text>
            </Pressable>

            <Pressable
              style={[styles.button, (!identifier || !password || isLoading) && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={!identifier || !password || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#0060df" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </Pressable>
          </View>

          <XStack justifyContent="center" style={{ marginTop: 24 }}>
            <Text style={styles.footer}>
              Uses the AT Protocol · Not affiliated with Bluesky PBLLC
            </Text>
          </XStack>
        </View>
      </KeyboardAvoidingView>
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
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 36,
  },
  form: { gap: 8 },
  label: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  helpLink: { marginTop: 8, marginBottom: 16 },
  helpText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: '#0060df',
    fontSize: 17,
    fontWeight: '700',
  },
  footer: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textAlign: 'center',
  },
})
