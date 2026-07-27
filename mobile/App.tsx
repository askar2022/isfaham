import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  LanguageCode,
  TranslationResult,
  translateRecording,
} from "./src/lib/api";
import { supabase } from "./src/lib/supabase";
import { CreditsScreen } from "./src/screens/CreditsScreen";
import { ConsumerRemote } from "./src/screens/ConsumerRemote";
import { StaffRemote } from "./src/screens/StaffRemote";
import { WelcomeFlow } from "./src/screens/WelcomeFlow";

const ONBOARDING_COMPLETE_KEY = "isfaham:onboarding-complete";

const LANGUAGES: Record<
  LanguageCode,
  { name: string; nativeName: string; flag: string }
> = {
  so: { name: "Somali", nativeName: "Af-Soomaali", flag: "SO" },
  en: { name: "English", nativeName: "English", flag: "EN" },
};

type ConversationTurn = TranslationResult & {
  id: string;
  createdAt: Date;
  isDemo?: boolean;
};

function BrandMark() {
  return (
    <View style={styles.brandMark}>
      {[8, 16, 23, 16, 8].map((height, index) => (
        <View key={index} style={[styles.brandWave, { height }]} />
      ))}
    </View>
  );
}

function formatDuration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `0:${String(seconds).padStart(2, "0")}`;
}

function ConversationCard({
  turn,
  onPlay,
}: {
  turn: ConversationTurn;
  onPlay: (turn: ConversationTurn) => void;
}) {
  return (
    <View style={styles.turnGroup}>
      <View style={[styles.bubble, styles.originalBubble]}>
        <View style={styles.bubbleHeader}>
          <Text style={styles.originalLabel}>{LANGUAGES[turn.source].name}</Text>
          <Text style={styles.originalTime}>
            {turn.createdAt.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <Text style={styles.originalText}>{turn.originalText}</Text>
      </View>

      <View style={styles.translationConnector}>
        <View style={styles.connectorLine} />
        <View style={styles.connectorBadge}>
          <Ionicons name="sparkles" color="#6944DF" size={13} />
          <Text style={styles.connectorText}>
            Translated to {LANGUAGES[turn.target].name}
          </Text>
        </View>
        <View style={styles.connectorLine} />
      </View>

      <View style={[styles.bubble, styles.translatedBubble]}>
        <Text style={styles.translatedLabel}>
          {LANGUAGES[turn.target].name}
        </Text>
        <Text style={styles.translatedText}>{turn.translatedText}</Text>
        {!turn.isDemo && (
          <Pressable
            accessibilityLabel={`Play ${LANGUAGES[turn.target].name} translation`}
            onPress={() => onPlay(turn)}
            style={({ pressed }) => [
              styles.listenButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name="volume-medium" color="#5B38D2" size={18} />
            <Text style={styles.listenText}>Listen again</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function AppContent() {
  const [showStaffRemote, setShowStaffRemote] = useState(false);
  const [showConsumerRemote, setShowConsumerRemote] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingRemoteInvite, setPendingRemoteInvite] = useState(false);
  const [source, setSource] = useState<LanguageCode>("so");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [transcriptExpanded, setTranscriptExpanded] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const [waveform] = useState(() =>
    Array.from({ length: 7 }, () => new Animated.Value(0.35)),
  );
  const target: LanguageCode = source === "so" ? "en" : "so";
  const isAnonymous = Boolean(session?.user.is_anonymous);

  useEffect(() => {
    if (!supabase) return;
    const authClient = supabase;
    let active = true;

    async function loadSession() {
      const { data } = await authClient.auth.getSession();
      let nextSession = data.session;
      if (!nextSession) {
        const { data: anonymous, error } =
          await authClient.auth.signInAnonymously();
        if (!error) nextSession = anonymous.session;
      }
      const onboardingComplete = await AsyncStorage.getItem(
        ONBOARDING_COMPLETE_KEY,
      );
      if (active) {
        setSession(nextSession);
        setShowOnboarding(
          Boolean(nextSession?.user.is_anonymous) && !onboardingComplete,
        );
        setAuthReady(true);
      }
    }

    void loadSession();
    const { data: listener } = authClient.auth.onAuthStateChange((_, next) => {
      if (!active) return;
      setSession(next);
      if (next && !next.user.is_anonymous) {
        setShowOnboarding(false);
      } else if (!next) {
        void authClient.auth.signInAnonymously().then(async ({ data, error }) => {
          if (!active || error) return;
          setSession(data.session);
          const onboardingComplete = await AsyncStorage.getItem(
            ONBOARDING_COMPLETE_KEY,
          );
          if (active) {
            setShowOnboarding(
              Boolean(data.session?.user.is_anonymous) &&
                !onboardingComplete,
            );
          }
        });
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    setShowOnboarding(false);
  }, []);

  useEffect(() => {
    if (!pendingRemoteInvite || !session || session.user.is_anonymous) return;
    const openRemote = setTimeout(() => {
      setPendingRemoteInvite(false);
      void completeOnboarding();
      setShowConsumerRemote(true);
    }, 0);
    return () => clearTimeout(openRemote);
  }, [completeOnboarding, pendingRemoteInvite, session]);

  const openConsumerRemote = useCallback(() => {
    if (!session || session.user.is_anonymous) {
      setPendingRemoteInvite(true);
      setShowCredits(true);
      return;
    }
    setShowConsumerRemote(true);
  }, [session]);

  const statusText = useMemo(() => {
    if (!session) return "Preparing your free trial…";
    if (isTranslating) return "Translating your conversation…";
    if (recorderState.isRecording) {
      return `Tap to stop • ${formatDuration(recorderState.durationMillis)}`;
    }
    return `Tap to speak ${LANGUAGES[source].name}`;
  }, [
    isTranslating,
    recorderState.durationMillis,
    recorderState.isRecording,
    session,
    source,
  ]);

  const liveStatus = !session
    ? {
        title: "Preparing Isfaham",
        detail: "Setting up your free translation trial",
        icon: "sync" as const,
      }
    : isTranslating
    ? {
        title: "Translating…",
        detail: `Preparing ${LANGUAGES[target].name}`,
        icon: "sync" as const,
      }
    : recorderState.isRecording
      ? {
          title: "Listening…",
          detail: `Speak ${LANGUAGES[source].name} clearly`,
          icon: "mic" as const,
        }
      : playerStatus.playing
        ? {
            title: `Speaking ${LANGUAGES[target].name}…`,
            detail: "Playing the translated voice",
            icon: "volume-high" as const,
          }
        : turns.length
          ? {
              title: "Translation ready",
              detail: "The latest translation appears below",
              icon: "checkmark-circle" as const,
            }
          : {
              title: "Ready to translate",
              detail: "Choose who is speaking",
              icon: "sparkles" as const,
            };

  useEffect(() => {
    if (!recorderState.isRecording) {
      waveform.forEach((value) => value.setValue(0.35));
      return;
    }

    const animation = Animated.loop(
      Animated.stagger(
        80,
        waveform.map((value) =>
          Animated.sequence([
            Animated.timing(value, {
              duration: 280,
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.timing(value, {
              duration: 280,
              toValue: 0.35,
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [recorderState.isRecording, waveform]);

  const playTranslation = useCallback(
    async (turn: ConversationTurn) => {
      try {
        const fileUri = `${FileSystem.cacheDirectory}isfaham-${turn.id}.mp3`;
        await FileSystem.writeAsStringAsync(fileUri, turn.audioBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        player.replace({ uri: fileUri });
        player.play();
      } catch {
        Alert.alert(
          "Audio unavailable",
          "The translation is ready, but its audio could not be played.",
        );
      }
    },
    [player],
  );

  const startRecording = useCallback(async () => {
    if (isTranslating) return;
    if (!session) {
      setShowCredits(true);
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Microphone permission needed",
          "Allow microphone access so Isfaham can translate what you say.",
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: 60 });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      Alert.alert(
        "Could not start listening",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  }, [isTranslating, recorder, session]);

  const stopAndTranslate = useCallback(async () => {
    if (!recorderState.isRecording) return;

    try {
      await recorder.stop();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uri = recorder.uri;

      if (!uri || recorderState.durationMillis < 500) {
        Alert.alert("Keep speaking", "Hold the button and speak for a moment.");
        return;
      }

      setIsTranslating(true);
      if (!session) {
        throw new Error("Preparing your translation balance. Please try again.");
      }
      const result = await translateRecording(
        uri,
        source,
        target,
        session.access_token,
      );
      const turn: ConversationTurn = {
        ...result,
        id: `${Date.now()}`,
        createdAt: new Date(),
      };

      setTurns((current) => [...current, turn]);
      setTranscriptExpanded(true);
      setSource(target);
      playTranslation(turn);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Please try that again.";
      if (message.includes("Translation Credits")) {
        const anonymous = Boolean(session?.user.is_anonymous);
        Alert.alert(
          anonymous ? "Free trial complete" : "Translation balance empty",
          anonymous
            ? "Create your free Individual account to continue translating."
            : message,
          [
          { text: "Not now", style: "cancel" },
            {
              text: anonymous ? "Create account" : "Add credits",
              onPress: () => setShowCredits(true),
            },
          ],
        );
      } else {
        Alert.alert("Translation unavailable", message);
      }
    } finally {
      setIsTranslating(false);
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    }
  }, [
    playTranslation,
    recorder,
    recorderState.durationMillis,
    recorderState.isRecording,
    source,
    target,
    session,
  ]);

  const switchSpeaker = useCallback(() => {
    if (recorderState.isRecording || isTranslating) return;
    setSource((current) => (current === "so" ? "en" : "so"));
    Haptics.selectionAsync();
  }, [isTranslating, recorderState.isRecording]);

  const clearConversation = useCallback(() => {
    if (!turns.length) return;
    Alert.alert(
      "Clear conversation?",
      "This removes every translation from this screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => setTurns([]),
        },
      ],
    );
  }, [turns.length]);

  if (showStaffRemote) {
    return <StaffRemote onClose={() => setShowStaffRemote(false)} />;
  }

  if (showCredits) {
    return (
      <CreditsScreen
        onClose={() => setShowCredits(false)}
        session={session}
      />
    );
  }

  if (showConsumerRemote && session && !session.user.is_anonymous) {
    return (
      <ConsumerRemote
        onClose={() => setShowConsumerRemote(false)}
        onCredits={() => {
          setShowConsumerRemote(false);
          setShowCredits(true);
        }}
        session={session}
      />
    );
  }

  if (!authReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="#5B38D2" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (showOnboarding) {
    return (
      <WelcomeFlow
        onCreateAccount={() => setShowCredits(true)}
        onInviteSomeone={openConsumerRemote}
        onStartConversation={() => void completeOnboarding()}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <BrandMark />
          <View>
            <Text style={styles.logoText}>Isfaham</Text>
            <Text style={styles.logoTagline}>Live Translation</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Invite someone to a remote conversation"
            onPress={openConsumerRemote}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons color="#5B38D2" name="link-outline" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel="Translation credits"
            onPress={() => setShowCredits(true)}
            style={({ pressed }) => [
              styles.headerButton,
              styles.creditButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons color="#5B38D2" name="wallet-outline" size={19} />
          </Pressable>
          <Pressable
            accessibilityLabel="Staff sign in and remote conversations"
            onPress={() => setShowStaffRemote(true)}
            style={({ pressed }) => [
              styles.staffButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons color="#5B38D2" name="school-outline" size={16} />
            <Text style={styles.staffButtonText}>Staff</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Clear conversation"
            onPress={clearConversation}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name="refresh-outline" color="#4F4960" size={21} />
          </Pressable>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.languageRow}>
          <Pressable
            onPress={() => !recorderState.isRecording && setSource("so")}
            style={[
              styles.languageCard,
              source === "so" && styles.languageCardActive,
            ]}
          >
            <View
              style={[
                styles.languageCode,
                source === "so" && styles.languageCodeActive,
              ]}
            >
              <Text
                style={[
                  styles.languageCodeText,
                  source === "so" && styles.languageCodeTextActive,
                ]}
              >
                SO
              </Text>
            </View>
            <View>
              <Text style={styles.languageName}>Somali</Text>
              <Text style={styles.languageNative}>Af-Soomaali</Text>
            </View>
            {source === "so" && (
              <Ionicons
                color="#1D9A70"
                name="checkmark-circle"
                size={18}
                style={styles.languageCheck}
              />
            )}
          </Pressable>

          <Pressable
            accessibilityLabel="Switch speaking language"
            onPress={switchSpeaker}
            style={({ pressed }) => [
              styles.switchButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name="swap-horizontal" color="#5B38D2" size={21} />
          </Pressable>

          <Pressable
            onPress={() => !recorderState.isRecording && setSource("en")}
            style={[
              styles.languageCard,
              source === "en" && styles.languageCardActive,
            ]}
          >
            <View
              style={[
                styles.languageCode,
                source === "en" && styles.languageCodeActive,
              ]}
            >
              <Text
                style={[
                  styles.languageCodeText,
                  source === "en" && styles.languageCodeTextActive,
                ]}
              >
                EN
              </Text>
            </View>
            <View>
              <Text style={styles.languageName}>English</Text>
              <Text style={styles.languageNative}>English</Text>
            </View>
            {source === "en" && (
              <Ionicons
                color="#1D9A70"
                name="checkmark-circle"
                size={18}
                style={styles.languageCheck}
              />
            )}
          </Pressable>
        </View>

        <View
          style={[
            styles.statusPanel,
            turns.length > 0 && styles.statusPanelCompact,
            recorderState.isRecording && styles.statusPanelListening,
          ]}
        >
          {recorderState.isRecording ? (
            <View style={styles.waveform}>
              {waveform.map((value, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.waveformBar,
                    {
                      height: 13 + (index % 4) * 5,
                      transform: [{ scaleY: value }],
                    },
                  ]}
                />
              ))}
            </View>
          ) : (
            <View style={styles.statusIcon}>
              <Ionicons color="#5B38D2" name={liveStatus.icon} size={22} />
            </View>
          )}
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>{liveStatus.title}</Text>
            <Text style={styles.statusDetail}>{liveStatus.detail}</Text>
          </View>
        </View>

        <View style={styles.micArea}>
          <Pressable
            accessibilityHint={
              recorderState.isRecording
                ? "Tap to stop recording and translate"
                : "Tap to start recording"
            }
            accessibilityLabel={`Speak ${LANGUAGES[source].name}`}
            disabled={isTranslating}
            onPress={() => {
              if (recorderState.isRecording) {
                void stopAndTranslate();
              } else {
                void startRecording();
              }
            }}
          >
            <LinearGradient
              colors={
                recorderState.isRecording
                  ? ["#E14972", "#B62956"]
                  : ["#7552E9", "#4C27BD"]
              }
              style={[
                styles.micButton,
                recorderState.isRecording && styles.micButtonRecording,
                isTranslating && styles.micButtonDisabled,
              ]}
            >
              {isTranslating ? (
                <ActivityIndicator color="white" size="large" />
              ) : (
                <Ionicons
                  name={recorderState.isRecording ? "stop" : "mic"}
                  color="white"
                  size={44}
                />
              )}
            </LinearGradient>
          </Pressable>
          <Text
            style={[
              styles.micStatus,
              recorderState.isRecording && styles.micStatusRecording,
            ]}
          >
            {statusText}
          </Text>
          <Text style={styles.micHint}>
            {!session
              ? "Preparing 2 free translation minutes"
              : recorderState.isRecording
              ? "Tap the stop button when finished"
              : isAnonymous
                ? "2 free minutes • No account required"
              : "Tap to start • Tap again to translate"}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !turns.length && styles.emptyScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {turns.length ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: transcriptExpanded }}
              onPress={() => setTranscriptExpanded((current) => !current)}
              style={({ pressed }) => [
                styles.transcriptHeader,
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={styles.transcriptHeading}>
                <View style={styles.liveDot} />
                <View>
                  <Text style={styles.transcriptTitle}>
                    Conversation transcript
                  </Text>
                  <Text style={styles.transcriptCount}>
                    {turns.length}{" "}
                    {turns.length === 1 ? "translation" : "translations"}
                  </Text>
                </View>
              </View>
              <Ionicons
                color="#5B38D2"
                name={transcriptExpanded ? "chevron-up" : "chevron-down"}
                size={22}
              />
            </Pressable>
            {transcriptExpanded &&
              turns.map((turn) => (
                <ConversationCard
                  key={turn.id}
                  onPlay={playTranslation}
                  turn={turn}
                />
              ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {isAnonymous ? "Your free trial is ready" : "Start a conversation"}
            </Text>
            <Text style={styles.emptyDescription}>
              Tap the microphone, speak, then tap again to translate.
            </Text>
            <View style={styles.privacyNote}>
              <Ionicons name="shield-checkmark" color="#168261" size={17} />
              <Text style={styles.privacyText}>
                Audio is processed securely and not saved by default
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#FAF9FD",
    flex: 1,
  },
  loadingScreen: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#ECE8F3",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  logoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "#5B38D2",
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    flexDirection: "row",
    gap: 2,
    height: 38,
    justifyContent: "center",
    width: 42,
  },
  brandWave: {
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
    width: 2,
  },
  logoText: {
    color: "#241444",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  logoTagline: {
    color: "#817A8D",
    fontSize: 10,
    marginTop: -1,
  },
  headerButton: {
    alignItems: "center",
    backgroundColor: "#F4F1FA",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  creditButton: {
    backgroundColor: "#F4F1FA",
    borderRadius: 19,
  },
  staffButton: {
    alignItems: "center",
    backgroundColor: "#F1EDFF",
    borderRadius: 18,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  staffButtonText: {
    color: "#5B38D2",
    fontSize: 11,
    fontWeight: "800",
  },
  scrollContent: {
    gap: 4,
    padding: 20,
    paddingBottom: 32,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  transcriptHeader: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2DDE9",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  transcriptHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  liveDot: {
    backgroundColor: "#2DA67B",
    borderRadius: 5,
    height: 7,
    width: 7,
  },
  transcriptTitle: {
    color: "#281F35",
    fontSize: 14,
    fontWeight: "800",
  },
  transcriptCount: {
    color: "#857D8E",
    fontSize: 10,
    marginTop: 2,
  },
  turnGroup: {
    marginBottom: 25,
  },
  bubble: {
    borderRadius: 18,
    padding: 17,
  },
  originalBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#5B38D2",
    borderBottomRightRadius: 5,
    maxWidth: "90%",
  },
  bubbleHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  originalLabel: {
    color: "#DCD2FF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  originalTime: {
    color: "#C5B9EF",
    fontSize: 10,
    marginLeft: 20,
  },
  originalText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 23,
    marginTop: 8,
  },
  translationConnector: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginVertical: 12,
  },
  connectorLine: {
    backgroundColor: "#DED8E9",
    flex: 1,
    height: 1,
  },
  connectorBadge: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  connectorText: {
    color: "#7B7289",
    fontSize: 10,
    fontWeight: "700",
  },
  translatedBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 5,
    borderColor: "#E7E2EE",
    borderWidth: 1,
    maxWidth: "90%",
  },
  translatedLabel: {
    color: "#6944DF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  translatedText: {
    color: "#25202E",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 23,
    marginVertical: 8,
  },
  listenButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 5,
    paddingVertical: 2,
  },
  listenText: {
    color: "#5B38D2",
    fontSize: 11,
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 15,
  },
  emptyTitle: {
    color: "#241E2D",
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  emptyDescription: {
    color: "#746D7D",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 340,
    textAlign: "center",
  },
  demoButton: {
    alignItems: "center",
    backgroundColor: "#F1EDFF",
    borderColor: "#D9CEF7",
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    marginTop: 18,
    paddingHorizontal: 17,
    paddingVertical: 12,
  },
  demoButtonText: {
    color: "#5B38D2",
    fontSize: 12,
    fontWeight: "900",
  },
  demoUpgrade: {
    backgroundColor: "#F1EDFF",
    borderColor: "#D9CEF7",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
    padding: 16,
  },
  demoUpgradeTitle: {
    color: "#35224F",
    fontSize: 14,
    fontWeight: "900",
  },
  demoUpgradeText: {
    color: "#71647E",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  privacyNote: {
    alignItems: "center",
    backgroundColor: "#EAF8F2",
    borderRadius: 12,
    flexDirection: "row",
    gap: 7,
    marginTop: 23,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  privacyText: {
    color: "#28745C",
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "600",
  },
  controls: {
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#E8E4ED",
    borderBottomWidth: 1,
    paddingBottom: 18,
    paddingHorizontal: 17,
    paddingTop: 14,
  },
  languageRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  languageCard: {
    alignItems: "center",
    backgroundColor: "#F8F7FA",
    borderColor: "#ECE8F0",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 58,
    paddingHorizontal: 9,
  },
  languageCardActive: {
    backgroundColor: "#F1EDFF",
    borderColor: "#8A6CE5",
    shadowColor: "#6A48D7",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
  },
  languageCode: {
    alignItems: "center",
    backgroundColor: "#E9E5EF",
    borderRadius: 9,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  languageCodeActive: {
    backgroundColor: "#5B38D2",
  },
  languageCodeText: {
    color: "#6F6879",
    fontSize: 10,
    fontWeight: "900",
  },
  languageCodeTextActive: {
    color: "#FFFFFF",
  },
  languageName: {
    color: "#2A2431",
    fontSize: 12,
    fontWeight: "800",
  },
  languageNative: {
    color: "#88818F",
    fontSize: 9,
    marginTop: 2,
  },
  languageCheck: {
    marginLeft: "auto",
  },
  switchButton: {
    alignItems: "center",
    backgroundColor: "#F0ECFC",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  statusPanel: {
    alignItems: "center",
    backgroundColor: "#F5F1FF",
    borderColor: "#E3DAFA",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 13,
    minHeight: 68,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  statusPanelCompact: {
    minHeight: 56,
    paddingVertical: 8,
  },
  statusPanelListening: {
    backgroundColor: "#FFF0F4",
    borderColor: "#F3CBD7",
  },
  statusIcon: {
    alignItems: "center",
    backgroundColor: "#E9E1FF",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  statusCopy: {
    flex: 1,
    marginLeft: 11,
  },
  statusTitle: {
    color: "#2B2137",
    fontSize: 14,
    fontWeight: "900",
  },
  statusDetail: {
    color: "#81768B",
    fontSize: 10,
    marginTop: 2,
  },
  waveform: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    height: 38,
    justifyContent: "center",
    width: 58,
  },
  waveformBar: {
    backgroundColor: "#D43A66",
    borderRadius: 3,
    width: 4,
  },
  micArea: {
    alignItems: "center",
    marginTop: 14,
  },
  micButton: {
    alignItems: "center",
    borderRadius: 52,
    elevation: 8,
    height: 104,
    justifyContent: "center",
    shadowColor: "#5B38D2",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    width: 104,
  },
  micButtonRecording: {
    shadowColor: "#D43866",
    transform: [{ scale: 1.06 }],
  },
  micButtonDisabled: {
    opacity: 0.75,
  },
  micStatus: {
    color: "#312A39",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 10,
  },
  micStatusRecording: {
    color: "#C52E59",
  },
  micHint: {
    color: "#918B98",
    fontSize: 10,
    marginTop: 3,
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
