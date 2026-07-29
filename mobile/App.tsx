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
  Image,
  Modal,
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

import { deleteAccount } from "./src/lib/account";
import {
  LanguageCode,
  TranslationResult,
  translateRecording,
} from "./src/lib/api";
import { logOutPurchases } from "./src/lib/iap";
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
    <Image
      accessibilityLabel="Isfaham logo"
      alt="Isfaham logo"
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      source={require("./assets/isfaham-icon.png")}
      style={styles.brandMark}
    />
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

type AppTab = "translate" | "individual" | "school" | "account";

function BottomNavigation({
  active,
  onSelect,
}: {
  active: AppTab;
  onSelect: (tab: AppTab) => void;
}) {
  const tabs: Array<{
    id: AppTab;
    icon: "language" | "person" | "school" | "settings";
    label: string;
  }> = [
    { id: "translate", icon: "language", label: "Translate" },
    { id: "individual", icon: "person", label: "Personal" },
    { id: "school", icon: "school", label: "Schools" },
    { id: "account", icon: "settings", label: "Account" },
  ];

  return (
    <SafeAreaView edges={["bottom"]} style={styles.bottomSafeArea}>
      <View style={styles.bottomNavigation}>
        {tabs.map((tab) => {
          const selected = active === tab.id;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab.id}
              onPress={() => onSelect(tab.id)}
              style={styles.bottomTab}
            >
              <Ionicons
                color={selected ? "#5B38D2" : "#8A8291"}
                name={selected ? tab.icon : `${tab.icon}-outline`}
                size={21}
              />
              <Text
                style={[
                  styles.bottomTabLabel,
                  selected && styles.bottomTabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function AccountScreen({
  onCreateAccount,
  onDeleteAccount,
  onSignOut,
  session,
}: {
  onCreateAccount: () => void;
  onDeleteAccount: () => Promise<void>;
  onSignOut: () => void;
  session: Session | null;
}) {
  const anonymous = !session || session.user.is_anonymous;
  const [deleting, setDeleting] = useState(false);

  const confirmDeletion = () => {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your Isfaham account, remaining translation balance, and associated account data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            setDeleting(true);
            void onDeleteAccount()
              .catch((error) => {
                Alert.alert(
                  "Account not deleted",
                  error instanceof Error
                    ? error.message
                    : "Please try again or contact support@isfaham.org.",
                );
              })
              .finally(() => setDeleting(false));
          },
        },
      ],
    );
  };
  return (
    <SafeAreaView style={styles.accountPage} edges={["top", "left", "right"]}>
      <View style={styles.accountPageContent}>
        <View style={styles.accountPageBrand}>
          <BrandMark />
          <Text style={styles.accountPageBrandText}>Isfaham</Text>
        </View>
        <Text style={styles.accountPageTitle}>
          {anonymous ? "Continue as a Guest" : "Your Account"}
        </Text>
        <Text style={styles.accountPageDescription}>
          {anonymous
            ? "Enjoy your free trial. When you’re ready, create a free account to:"
            : session.user.email ?? "Signed in to Isfaham"}
        </Text>
        {anonymous && (
          <View style={styles.accountPageBenefits}>
            {[
              "Save your translation minutes",
              "Use Isfaham on all your devices",
              "Purchase more translation time anytime",
            ].map((benefit) => (
              <View key={benefit} style={styles.accountPageBenefit}>
                <Ionicons
                  color="#198462"
                  name="checkmark-circle"
                  size={18}
                />
                <Text style={styles.accountPageBenefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        )}
        {anonymous ? (
          <Pressable onPress={onCreateAccount} style={styles.accountPageButton}>
            <Text style={styles.accountPageButtonText}>
              Create My Free Account
            </Text>
          </Pressable>
        ) : (
          <>
            <Pressable onPress={onSignOut} style={styles.accountPageSecondary}>
              <Text style={styles.accountPageSecondaryText}>Sign out</Text>
            </Pressable>
            <View style={styles.deleteAccountSection}>
              <Text style={styles.deleteAccountDescription}>
                Permanently remove your Isfaham account and associated data.
              </Text>
              <Pressable
                disabled={deleting}
                onPress={confirmDeletion}
                style={styles.deleteAccountButton}
              >
                {deleting ? (
                  <ActivityIndicator color="#B62956" size="small" />
                ) : (
                  <Text style={styles.deleteAccountButtonText}>
                    Delete Account
                  </Text>
                )}
              </Pressable>
            </View>
          </>
        )}
        {anonymous && (
          <View style={styles.accountPageTrust}>
            <Ionicons color="#6E6577" name="lock-closed" size={13} />
            <Text style={styles.accountPageTrustText}>
              Free to create • No subscription required
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function AppContent() {
  const [showStaffRemote, setShowStaffRemote] = useState(false);
  const [showConsumerRemote, setShowConsumerRemote] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingRemoteInvite, setPendingRemoteInvite] = useState(false);
  const [source, setSource] = useState<LanguageCode>("so");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
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

  const selectTab = useCallback((tab: AppTab) => {
    setShowCredits(tab === "individual");
    setShowStaffRemote(tab === "school");
    setShowAccount(tab === "account");
  }, []);

  const statusText = useMemo(() => {
    if (isTranslating) return "Translating your conversation…";
    if (recorderState.isRecording) {
      return `Tap to stop • ${formatDuration(recorderState.durationMillis)}`;
    }
    return "Translate Conversations Instantly";
  }, [
    isTranslating,
    recorderState.durationMillis,
    recorderState.isRecording,
  ]);

  const liveStatus = isTranslating
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
      if (!supabase) {
        Alert.alert("Free trial unavailable", "Please try again shortly.");
        return;
      }
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.session) {
        Alert.alert(
          "Free trial unavailable",
          error?.message ?? "Please check your connection and try again.",
        );
        return;
      }
      setSession(data.session);
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
          anonymous ? "Your free trial has ended" : "Translation balance empty",
          anonymous
            ? "Continue translating by creating your free Isfaham account."
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

  const handleMicPress = useCallback(() => {
    if (recorderState.isRecording) {
      void stopAndTranslate();
    } else {
      void startRecording();
    }
  }, [recorderState.isRecording, startRecording, stopAndTranslate]);

  const switchSpeaker = useCallback(() => {
    if (recorderState.isRecording || isTranslating) return;
    setSource((current) => (current === "so" ? "en" : "so"));
    Haptics.selectionAsync();
  }, [isTranslating, recorderState.isRecording]);

  if (showStaffRemote) {
    return (
      <View style={styles.tabScreen}>
        <StaffRemote onClose={() => selectTab("translate")} />
        <BottomNavigation active="school" onSelect={selectTab} />
      </View>
    );
  }

  if (showCredits) {
    return (
      <View style={styles.tabScreen}>
        <CreditsScreen
          onClose={() => selectTab("translate")}
          onRemote={() => {
            setShowCredits(false);
            openConsumerRemote();
          }}
          session={session}
        />
        <BottomNavigation active="individual" onSelect={selectTab} />
      </View>
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

  if (showAccount) {
    return (
      <View style={styles.tabScreen}>
        <AccountScreen
          onCreateAccount={() => {
            setShowAccount(false);
            setShowCredits(true);
          }}
          onDeleteAccount={async () => {
            if (!session || session.user.is_anonymous) {
              throw new Error("Sign in before deleting an account.");
            }
            await deleteAccount(session.access_token);
            await logOutPurchases().catch(() => undefined);
            await supabase?.auth.signOut({ scope: "local" });
            selectTab("translate");
          }}
          onSignOut={() => {
            void logOutPurchases()
              .catch(() => undefined)
              .then(() => supabase?.auth.signOut({ scope: "local" }))
              .finally(() => selectTab("translate"));
          }}
          session={session}
        />
        <BottomNavigation active="account" onSelect={selectTab} />
      </View>
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
            <Text style={styles.logoTagline}>Real-Time Voice Translation</Text>
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <Text style={styles.languageSectionLabel}>
          I’m Speaking
        </Text>
        <View style={styles.languageRow}>
          <Pressable
            accessibilityLabel="Speak Somali"
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
            <Ionicons name="swap-horizontal" color="#5B38D2" size={24} />
          </Pressable>

          <Pressable
            accessibilityLabel="Speak English"
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

        {(recorderState.isRecording ||
          isTranslating ||
          playerStatus.playing ||
          turns.length > 0) && (
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
        )}

        <View style={styles.micArea}>
          <Pressable
            accessibilityHint={
              recorderState.isRecording
                ? "Tap to stop recording and translate"
                : "Tap to start recording"
            }
            accessibilityLabel={`Speak ${LANGUAGES[source].name}`}
            disabled={isTranslating}
            onPress={handleMicPress}
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
                  size={58}
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
            {recorderState.isRecording
              ? "Tap the stop button when finished"
              : "Speak naturally. Hear the translation instantly."}
          </Text>
          {!recorderState.isRecording && !isTranslating && (
            <>
              <Pressable
                onPress={handleMicPress}
                style={({ pressed }) => [
                  styles.startButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.startButtonText}>
                  {!session || isAnonymous
                    ? "Try It Free"
                    : "Start Translating"}
                </Text>
              </Pressable>
              {(!session || isAnonymous) && (
                <View style={styles.trustRow}>
                  {[
                    "No Sign-up Required",
                    "2 Free Minutes",
                    "Private by Default",
                  ].map((label) => (
                    <View key={label} style={styles.trustItem}>
                      <Ionicons
                        color="#198462"
                        name="checkmark-circle"
                        size={12}
                      />
                      <Text numberOfLines={1} style={styles.trustItemText}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
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
          <View style={styles.activeConversation}>
            <View style={styles.activeConversationIcon}>
              <Ionicons color="#5B38D2" name="chatbubbles" size={25} />
            </View>
            <Text style={styles.activeConversationTitle}>
              Conversation in progress
            </Text>
            <Text style={styles.activeConversationDescription}>
              Keep taking turns. Open the floating transcript whenever you
              want to read the translations.
            </Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.howItWorks}>
              <Text style={styles.howItWorksTitle}>How it works</Text>
              <View style={styles.howItWorksSteps}>
                {["Tap", "Speak", "Translate"].map((label, index) => (
                  <View key={label} style={styles.howItWorksStep}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.emptyDescription}>
              Perfect for schools, healthcare, business, travel, and everyday
              conversations.
            </Text>
          </View>
        )}
      </ScrollView>
      {turns.length > 0 && (
        <Pressable
          accessibilityLabel={`Open transcript with ${turns.length} translations`}
          onPress={() => setShowTranscript(true)}
          style={({ pressed }) => [
            styles.transcriptFloatingButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Ionicons color="#FFFFFF" name="chatbox-ellipses" size={20} />
          <Text style={styles.transcriptFloatingText}>Transcript</Text>
          <View style={styles.transcriptFloatingCount}>
            <Text style={styles.transcriptFloatingCountText}>{turns.length}</Text>
          </View>
        </Pressable>
      )}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowTranscript(false)}
        transparent
        visible={showTranscript}
      >
        <View style={styles.transcriptModal}>
          <Pressable
            accessibilityLabel="Close transcript"
            onPress={() => setShowTranscript(false)}
            style={styles.transcriptBackdrop}
          />
          <SafeAreaView edges={["bottom"]} style={styles.transcriptSheet}>
            <View style={styles.transcriptSheetHandle} />
            <View style={styles.transcriptSheetHeader}>
              <View>
                <Text style={styles.transcriptSheetTitle}>
                  Conversation transcript
                </Text>
                <Text style={styles.transcriptCount}>
                  {turns.length}{" "}
                  {turns.length === 1 ? "translation" : "translations"}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close transcript"
                onPress={() => setShowTranscript(false)}
                style={styles.transcriptCloseButton}
              >
                <Ionicons color="#554C5C" name="close" size={22} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.transcriptSheetContent}
              showsVerticalScrollIndicator={false}
            >
              {turns.map((turn) => (
                <ConversationCard
                  key={turn.id}
                  onPlay={playTranslation}
                  turn={turn}
                />
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
      <BottomNavigation active="translate" onSelect={selectTab} />
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
  tabScreen: {
    backgroundColor: "#FAF9FD",
    flex: 1,
  },
  bottomSafeArea: {
    backgroundColor: "#FFFFFF",
    borderTopColor: "#E8E3EC",
    borderTopWidth: 1,
  },
  bottomNavigation: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 61,
    paddingHorizontal: 6,
  },
  bottomTab: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    justifyContent: "center",
    paddingVertical: 8,
  },
  bottomTabLabel: {
    color: "#8A8291",
    fontSize: 9,
    fontWeight: "700",
  },
  bottomTabLabelActive: {
    color: "#5B38D2",
    fontWeight: "900",
  },
  accountPage: {
    backgroundColor: "#FAF9FD",
    flex: 1,
  },
  accountPageContent: {
    alignItems: "center",
    flex: 1,
    padding: 24,
    paddingTop: 165,
  },
  accountPageBrand: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    marginBottom: 16,
  },
  accountPageBrandText: {
    color: "#241A31",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  accountPageTitle: {
    color: "#281F32",
    fontSize: 27,
    fontWeight: "900",
  },
  accountPageDescription: {
    color: "#756B7D",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    maxWidth: 340,
    textAlign: "center",
  },
  accountPageBenefits: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 20,
    maxWidth: 360,
  },
  accountPageBenefit: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  accountPageBenefitText: {
    color: "#554C5C",
    fontSize: 12,
    fontWeight: "700",
  },
  accountPageButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#5B38D2",
    borderRadius: 14,
    marginTop: 24,
    paddingVertical: 16,
  },
  accountPageButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
  },
  accountPageSecondary: {
    marginTop: 24,
    padding: 12,
  },
  accountPageSecondaryText: {
    color: "#B62956",
    fontSize: 13,
    fontWeight: "900",
  },
  deleteAccountSection: {
    alignItems: "center",
    borderTopColor: "#E7E1EA",
    borderTopWidth: 1,
    marginTop: 20,
    paddingTop: 20,
    width: "100%",
  },
  deleteAccountDescription: {
    color: "#817884",
    fontSize: 10,
    lineHeight: 15,
    maxWidth: 300,
    textAlign: "center",
  },
  deleteAccountButton: {
    alignItems: "center",
    borderColor: "#D8A4B3",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 11,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  deleteAccountButtonText: {
    color: "#B62956",
    fontSize: 12,
    fontWeight: "900",
  },
  accountPageTrust: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 13,
  },
  accountPageTrustText: {
    color: "#746C7B",
    fontSize: 9,
    fontWeight: "600",
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
    borderRadius: 11,
    height: 38,
    width: 38,
  },
  logoText: {
    color: "#241444",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  logoTagline: {
    color: "#5F5668",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 0,
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
    justifyContent: "flex-start",
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
  activeConversation: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 42,
  },
  activeConversationIcon: {
    alignItems: "center",
    backgroundColor: "#EEE8FF",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    marginBottom: 13,
    width: 48,
  },
  activeConversationTitle: {
    color: "#2A2330",
    fontSize: 20,
    fontWeight: "900",
  },
  activeConversationDescription: {
    color: "#7A7281",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
    maxWidth: 310,
    textAlign: "center",
  },
  transcriptFloatingButton: {
    alignItems: "center",
    backgroundColor: "#5B38D2",
    borderRadius: 22,
    bottom: 80,
    elevation: 8,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 11,
    position: "absolute",
    right: 16,
    shadowColor: "#39258A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  transcriptFloatingText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  transcriptFloatingCount: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    height: 20,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 5,
  },
  transcriptFloatingCountText: {
    color: "#5B38D2",
    fontSize: 9,
    fontWeight: "900",
  },
  transcriptModal: {
    flex: 1,
    justifyContent: "flex-end",
  },
  transcriptBackdrop: {
    backgroundColor: "rgba(28, 20, 35, 0.42)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  transcriptSheet: {
    backgroundColor: "#FAF9FD",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "78%",
    minHeight: 420,
    overflow: "hidden",
  },
  transcriptSheetHandle: {
    alignSelf: "center",
    backgroundColor: "#D5CFDA",
    borderRadius: 2,
    height: 4,
    marginTop: 9,
    width: 42,
  },
  transcriptSheetHeader: {
    alignItems: "center",
    borderBottomColor: "#E7E2EB",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  transcriptSheetTitle: {
    color: "#2A2330",
    fontSize: 18,
    fontWeight: "900",
  },
  transcriptCloseButton: {
    alignItems: "center",
    backgroundColor: "#EEEAF1",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  transcriptSheetContent: {
    gap: 4,
    padding: 16,
    paddingBottom: 28,
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
    paddingTop: 18,
  },
  emptyTitle: {
    color: "#241E2D",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  emptyDescription: {
    color: "#746D7D",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 16,
    maxWidth: 340,
    textAlign: "center",
  },
  howItWorks: {
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
    borderColor: "#E8E3EC",
    borderRadius: 16,
    borderWidth: 1,
    gap: 13,
    padding: 15,
  },
  howItWorksTitle: {
    color: "#2A2330",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  howItWorksSteps: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  howItWorksStep: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  stepNumber: {
    alignItems: "center",
    backgroundColor: "#EEE8FF",
    borderRadius: 11,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  stepNumberText: {
    color: "#5B38D2",
    fontSize: 10,
    fontWeight: "900",
  },
  stepLabel: {
    color: "#514958",
    fontSize: 12,
    fontWeight: "700",
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
    marginTop: 14,
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
  languageSectionLabel: {
    color: "#3B3343",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
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
    borderWidth: 2,
    elevation: 2,
    shadowColor: "#6A48D7",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
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
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
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
    marginTop: 9,
  },
  micButton: {
    alignItems: "center",
    borderRadius: 77,
    elevation: 8,
    height: 154,
    justifyContent: "center",
    shadowColor: "#5B38D2",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    width: 154,
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
    fontSize: 15,
    fontWeight: "800",
    marginTop: 10,
  },
  micStatusRecording: {
    color: "#C52E59",
  },
  micHint: {
    color: "#918B98",
    fontSize: 11,
    marginTop: 4,
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "#5B38D2",
    borderRadius: 12,
    marginTop: 13,
    minWidth: 170,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  trustRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    justifyContent: "center",
    marginTop: 7,
  },
  trustItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
  },
  trustItemText: {
    color: "#6D6674",
    fontSize: 8,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
