import { createElement, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';

const URL_KEY = 'entre-contas-web-origin';
interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
async function readSavedUrl(): Promise<string | null> {
  if (Platform.OS === 'web') {
    const storage = (globalThis as { localStorage?: WebStorageLike }).localStorage;
    return storage ? storage.getItem(URL_KEY) : null;
  }
  return SecureStore.getItemAsync(URL_KEY);
}
async function saveUrl(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = (globalThis as { localStorage?: WebStorageLike }).localStorage;
    storage?.setItem(URL_KEY, url);
    return;
  }
  await SecureStore.setItemAsync(URL_KEY, url);
}
function validOrigin(value: string): string {
  const url = new URL(value.trim());
  const development =
    __DEV__ &&
    url.protocol === 'http:' &&
    /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(url.hostname);
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' && !development)
  )
    throw new Error(
      'Informe a URL HTTPS do site, sem caminhos ou credenciais. HTTP é aceito apenas na rede local de desenvolvimento.',
    );
  return url.origin;
}
export default function App() {
  const [origin, setOrigin] = useState<string | null>(null),
    [input, setInput] = useState(process.env.EXPO_PUBLIC_WEB_URL ?? ''),
    [booting, setBooting] = useState(true),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [canGoBack, setCanGoBack] = useState(false),
    [reloadKey, setReloadKey] = useState(0);
  const web = useRef<WebView<object>>(null);
  useEffect(() => {
    readSavedUrl()
      .then((saved) => {
        if (saved) {
          setInput(saved);
          setOrigin(validOrigin(saved));
        } else if (
          process.env.EXPO_PUBLIC_WEB_URL &&
          !process.env.EXPO_PUBLIC_WEB_URL.includes('SEU-SITE')
        )
          setOrigin(validOrigin(process.env.EXPO_PUBLIC_WEB_URL));
      })
      .catch(() => setError('Não foi possível recuperar o endereço. Informe-o novamente.'))
      .finally(() => setBooting(false));
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        web.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);
  async function connect() {
    setError('');
    try {
      const url = validOrigin(input);
      await saveUrl(url);
      setOrigin(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Endereço inválido.');
    }
  }
  if (booting)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loading}>
          <ActivityIndicator color="#1e4d3b" />
          <Text style={styles.note}>Preparando seu espaço…</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="auto" />
        {origin ? (
          <View style={styles.frame}>
            <View style={styles.nativeBar}>
              <Text style={styles.wordmark}>
                entre<Text style={styles.serif}>contas</Text>
              </Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Recarregar página"
                  onPress={() => {
                    setError('');
                    if (Platform.OS === 'web') setReloadKey((k) => k + 1);
                    else web.current?.reload();
                  }}
                  style={styles.smallButton}
                >
                  <Text style={styles.link}>Recarregar</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Alterar endereço do site"
                  onPress={() => {
                    setOrigin(null);
                    setError('');
                  }}
                  style={styles.smallButton}
                >
                  <Text style={styles.link}>Endereço</Text>
                </Pressable>
              </View>
            </View>
            {loading && <ActivityIndicator color="#1e4d3b" style={styles.spinner} />}
            {Platform.OS === 'web' ? (
              createElement('iframe', {
                key: reloadKey,
                src: origin,
                title: 'Entre Contas',
                style: { flex: 1, border: 'none', width: '100%', height: '100%' },
              })
            ) : (
              <WebView<object>
                ref={web}
                source={{ uri: origin }}
                style={styles.web}
                originWhitelist={[origin]}
                onShouldStartLoadWithRequest={(request) =>
                  request.url === 'about:blank' || request.url.startsWith(origin + '/')
                }
                javaScriptEnabled
                domStorageEnabled
                cacheEnabled={false}
                incognito
                sharedCookiesEnabled={false}
                thirdPartyCookiesEnabled={false}
                mixedContentMode="never"
                allowFileAccess={false}
                setSupportMultipleWindows={false}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
                onError={() => {
                  setLoading(false);
                  setError('Sem conexão com o site. Suas alterações não foram enviadas.');
                }}
                onHttpError={(event) => {
                  if (event.nativeEvent.statusCode >= 500)
                    setError('O servidor está indisponível. Tente novamente.');
                }}
                onMessage={(event) => {
                  if (!event.nativeEvent.url.startsWith(origin + '/')) return;
                  try {
                    const payload: unknown = JSON.parse(event.nativeEvent.data);
                    if (typeof payload !== 'object' || payload === null) return;
                    const p = payload as Record<string, unknown>;
                    if (
                      p.type === 'export-csv' &&
                      typeof p.csv === 'string' &&
                      p.csv.length < 2_500_000 &&
                      typeof p.filename === 'string' &&
                      /^entre-contas-[a-z]+-\d{4}-\d{2}\.csv$/.test(p.filename)
                    )
                      void Share.share({ message: p.csv, title: p.filename });
                  } catch {
                    /* Ignore messages that are not explicit export requests. */
                  }
                }}
                renderError={() => (
                  <View style={styles.loading}>
                    <Text style={styles.title}>Uma pausa na conexão.</Text>
                    <Text style={styles.note}>Confira sua internet e o endereço do site.</Text>
                    <Pressable
                      style={styles.button}
                      onPress={() => {
                        setError('');
                        web.current?.reload();
                      }}
                    >
                      <Text style={styles.buttonText}>Tentar novamente</Text>
                    </Pressable>
                  </View>
                )}
              />
            )}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable
                  onPress={() => {
                    setError('');
                    if (Platform.OS === 'web') setReloadKey((k) => k + 1);
                    else web.current?.reload();
                  }}
                >
                  <Text style={styles.link}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.connect}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Text style={styles.wordmark}>
              entre<Text style={styles.serif}>contas</Text>
            </Text>
            <View style={styles.setupContent}>
              <Text style={styles.eyebrow}>CASSIANO & KETHELLEN</Text>
              <Text style={styles.title}>Seu espaço,{`\n`}sempre por perto.</Text>
              <Text style={styles.note}>
                Informe o endereço do site publicado no Netlify. Você vai entrar com seu próprio
                login, no mesmo sistema da web.
              </Text>
              <Text style={styles.label}>Endereço do site</Text>
              <TextInput
                accessibilityLabel="Endereço do site"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="https://seu-site.netlify.app"
                value={input}
                onChangeText={setInput}
              />
              {error ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {error}
                </Text>
              ) : null}
              <Pressable
                style={styles.button}
                accessibilityRole="button"
                onPress={() => void connect()}
              >
                <Text style={styles.buttonText}>Abrir meu espaço</Text>
              </Pressable>
              <Text style={styles.caption}>
                Somente o endereço é salvo no SecureStore. Senhas e tokens não passam por uma ponte
                JavaScript; a sessão web usa cookie HttpOnly e é descartada ao fechar esta
                visualização privada.
              </Text>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f4f0' },
  frame: { flex: 1 },
  web: { flex: 1, backgroundColor: '#f5f4f0' },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f4f0',
    padding: 30,
    gap: 18,
  },
  nativeBar: {
    height: 43,
    paddingHorizontal: 17,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e6e4dd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: { flexDirection: 'row', gap: 10 },
  smallButton: { padding: 8 },
  wordmark: { fontSize: 21, color: '#1e4d3b', fontWeight: '600', letterSpacing: -1 },
  serif: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  link: { fontSize: 10, color: '#1e4d3b' },
  spinner: {
    position: 'absolute',
    right: 15,
    top: 51,
    zIndex: 1,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 20,
  },
  connect: { flex: 1, padding: 28 },
  setupContent: { flex: 1, justifyContent: 'center', paddingBottom: 70 },
  eyebrow: { fontSize: 9, letterSpacing: 2, color: '#62665f', marginBottom: 20 },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 37,
    color: '#141413',
    letterSpacing: -1,
    lineHeight: 44,
    marginBottom: 17,
  },
  note: { color: '#62665f', fontSize: 13, lineHeight: 23 },
  label: { marginTop: 32, marginBottom: 9, color: '#141413', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#d8dacf',
    backgroundColor: '#fff',
    borderRadius: 7,
    fontSize: 14,
    padding: 15,
    color: '#141413',
  },
  button: {
    backgroundColor: '#1e4d3b',
    borderRadius: 7,
    padding: 16,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonText: { color: '#fff', fontSize: 13 },
  caption: { color: '#73786c', fontSize: 10, lineHeight: 18, marginTop: 25 },
  errorBanner: { backgroundColor: '#faf0e8', padding: 14, gap: 8 },
  errorText: { fontSize: 12, color: '#8c3b2b', lineHeight: 20, marginTop: 8 },
});
