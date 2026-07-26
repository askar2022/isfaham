import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
      </View>
    </View>
  );
}

function AppContent() {
  const [source, setSource] = useState<LanguageCode>("so");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [transcriptExpanded, setTranscriptExpanded] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(null);
  const target: LanguageCode = source === "so" ? "en" : "so";

  const statusText = useMemo(() => {
    if (isTranslating) return "Translating your conversation…";
    if (recorderState.isRecording) {
      return `Listening • ${formatDuration(recorderState.durationMillis)}`;
    }
    return `Tap to speak ${LANGUAGES[source].name}`;
  }, [
    isTranslating,
    recorderState.durationMillis,
    recorderState.isRecording,
    source,
  ]);

  const playTranslation = useCallback(
    (turn: ConversationTurn) => {
      player.replace({
        uri: `data:${turn.audioMimeType};base64,${turn.audioBase64}`,
      });
      player.play();
    },
    [player],
  );

  const startRecording = useCallback(async () => {
    if (isTranslating) return;

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
  }, [isTranslating, recorder]);

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
      const result = await translateRecording(uri, source, target);
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
      Alert.alert(
        "Translation unavailable",
        error instanceof Error ? error.message : "Please try that again.",
      );
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
          </Pressable>
        </View>

        <View style={styles.micArea}>
          <Pressable
            accessibilityHint="Hold while speaking and release to translate"
            accessibilityLabel={`Speak ${LANGUAGES[source].name}`}
            disabled={isTranslating}
            onPressIn={startRecording}
            onPressOut={stopAndTranslate}
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
                  size={40}
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
          <Text style={styles.micHint}>Hold to talk • Release to translate</Text>
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
            <Text style={styles.emptyTitle}>Start a conversation</Text>
            <Text style={styles.emptyDescription}>
              Hold the microphone while someone speaks.
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
  switchButton: {
    alignItems: "center",
    backgroundColor: "#F0ECFC",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  micArea: {
    alignItems: "center",
    marginTop: 16,
  },
  micButton: {
    alignItems: "center",
    borderRadius: 46,
    elevation: 8,
    height: 92,
    justifyContent: "center",
    shadowColor: "#5B38D2",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    width: 92,
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
