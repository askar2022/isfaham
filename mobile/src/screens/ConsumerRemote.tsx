import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createConsumerRemoteConversation,
  getRemoteRoom,
  type RemoteMessage,
  type RemoteRoom,
  speakRemoteMessage,
  translateRemoteTurn,
  updateRemoteRoom,
} from "../lib/remote";

type Invitation = {
  conversationUrl: string;
  publicToken: string;
};

export function ConsumerRemote({
  onClose,
  onCredits,
  session,
}: {
  onClose: () => void;
  onCredits: () => void;
  session: Session;
}) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [room, setRoom] = useState<RemoteRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(null);
  const playedMessages = useRef(new Set<string>());

  const playAudio = useCallback(
    async (audioBase64: string, id: string) => {
      const uri = `${FileSystem.cacheDirectory}isfaham-consumer-${id}.mp3`;
      await FileSystem.writeAsStringAsync(uri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      player.replace({ uri });
      player.play();
    },
    [player],
  );

  const loadRoom = useCallback(async () => {
    if (!invitation) return;
    try {
      const next = await getRemoteRoom(
        invitation.publicToken,
        session.access_token,
      );
      setRoom(next);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Conversation unavailable.",
      );
    }
  }, [invitation, session.access_token]);

  useEffect(() => {
    if (!invitation) return;
    const firstLoad = setTimeout(() => void loadRoom(), 0);
    const poll = setInterval(() => void loadRoom(), 2_000);
    return () => {
      clearTimeout(firstLoad);
      clearInterval(poll);
    };
  }, [invitation, loadRoom]);

  useEffect(() => {
    if (!room || room.status !== "active" || !invitation) return;
    const latestGuestMessage = [...room.messages]
      .reverse()
      .find(
        (message) =>
          message.speaker === "parent" &&
          !playedMessages.current.has(message.id),
      );
    room.messages.forEach((message) => playedMessages.current.add(message.id));
    if (!latestGuestMessage) return;
    void speakRemoteMessage(invitation.publicToken, latestGuestMessage.id)
      .then((audio) =>
        playAudio(audio.audioBase64, latestGuestMessage.id),
      )
      .catch(() => undefined);
  }, [invitation, playAudio, room]);

  async function createInvitation() {
    setBusy(true);
    setError("");
    try {
      const next = await createConsumerRemoteConversation(
        session.access_token,
      );
      setInvitation(next);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Invitation could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function shareInvitation() {
    if (!invitation) return;
    await Share.share({
      message: `Join my private Isfaham Somali-English conversation:\n${invitation.conversationUrl}`,
      url: invitation.conversationUrl,
    });
  }

  async function changeStatus(status: "active" | "ended") {
    if (!invitation) return;
    setBusy(true);
    try {
      await updateRemoteRoom(
        invitation.publicToken,
        status,
        session.access_token,
      );
      if (status === "ended") {
        onClose();
      } else {
        await loadRoom();
      }
    } catch (statusError) {
      const message =
        statusError instanceof Error ? statusError.message : "Please try again.";
      if (message.includes("Translation Credits")) {
        Alert.alert("More credits needed", message, [
          { text: "Not now", style: "cancel" },
          { text: "Add credits", onPress: onCredits },
        ]);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    if (busy || room?.status !== "active") return;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Microphone permission is required.");
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: 60 });
    } catch (recordError) {
      setError(
        recordError instanceof Error
          ? recordError.message
          : "Recording could not start.",
      );
    }
  }

  async function stopAndTranslate() {
    if (!recorderState.isRecording || !invitation) return;
    const durationMs = recorderState.durationMillis;
    setBusy(true);
    setError("");
    try {
      await recorder.stop();
      if (!recorder.uri || durationMs < 500) {
        throw new Error("Speak for a moment before stopping.");
      }
      const result = await translateRemoteTurn(
        invitation.publicToken,
        recorder.uri,
        durationMs,
        session.access_token,
      );
      await playAudio(result.audioBase64, `${Date.now()}`);
      await loadRoom();
    } catch (translationError) {
      const message =
        translationError instanceof Error
          ? translationError.message
          : "Translation failed.";
      if (message.includes("Translation Credits")) {
        Alert.alert("More credits needed", message, [
          { text: "Not now", style: "cancel" },
          { text: "Add credits", onPress: onCredits },
        ]);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    }
  }

  async function listen(message: RemoteMessage) {
    if (!invitation) return;
    try {
      const audio = await speakRemoteMessage(
        invitation.publicToken,
        message.id,
      );
      await playAudio(audio.audioBase64, message.id);
    } catch {
      setError("Audio playback is unavailable.");
    }
  }

  if (!invitation) {
    return (
      <SafeAreaView style={styles.page}>
        <Header onBack={onClose} title="Invite another phone" />
        <View style={styles.centered}>
          <View style={styles.heroIcon}>
            <Ionicons color="#5B38D2" name="link" size={34} />
          </View>
          <Text style={styles.title}>Talk from two phones</Text>
          <Text style={styles.description}>
            You are the host. Your guest joins free, and translation time is
            charged only to your balance.
          </Text>
          <PrimaryButton
            disabled={busy}
            label="Create Invitation"
            loading={busy}
            onPress={() => void createInvitation()}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  if (!room || room.status === "waiting") {
    return (
      <SafeAreaView style={styles.page}>
        <Header onBack={onClose} title="Invite another phone" />
        <ScrollView contentContainerStyle={styles.centered}>
          <Text style={styles.title}>Invite your guest</Text>
          <Text style={styles.description}>
            They do not need an account. Share this private link or let them
            scan the QR code.
          </Text>
          <View style={styles.qrCard}>
            <QRCode
              backgroundColor="#FFFFFF"
              color="#2F2340"
              size={180}
              value={invitation.conversationUrl}
            />
          </View>
          <View style={styles.linkCard}>
            <Text numberOfLines={2} style={styles.linkText}>
              {invitation.conversationUrl}
            </Text>
          </View>
          <PrimaryButton
            disabled={busy}
            label="Share Invitation"
            loading={false}
            onPress={() => void shareInvitation()}
          />
          <Pressable
            disabled={busy}
            onPress={() => void changeStatus("active")}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Start Conversation</Text>
          </Pressable>
          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <Header onBack={onClose} title="Remote conversation" />
      <ScrollView contentContainerStyle={styles.roomContent}>
        <View style={styles.roomStatus}>
          <View style={styles.liveDot} />
          <Text style={styles.roomStatusText}>Guest connected by private link</Text>
        </View>
        {room.messages.map((message) => (
          <View key={message.id} style={styles.messageCard}>
            <Text style={styles.messageSpeaker}>
              {message.speaker === "teacher" ? "You" : "Guest"} •{" "}
              {message.source_language === "en" ? "English" : "Somali"}
            </Text>
            <Text style={styles.originalText}>{message.original_text}</Text>
            <View style={styles.divider} />
            <Text style={styles.translationText}>
              {message.translated_text}
            </Text>
            <Pressable
              onPress={() => void listen(message)}
              style={styles.listenButton}
            >
              <Ionicons color="#5B38D2" name="volume-medium" size={17} />
              <Text style={styles.listenText}>Listen</Text>
            </Pressable>
          </View>
        ))}
        {!room.messages.length && (
          <Text style={styles.description}>
            Tap the microphone and speak English. Your guest speaks Somali.
          </Text>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
      <View style={styles.roomControls}>
        <Pressable
          disabled={busy}
          onPress={() =>
            void (recorderState.isRecording
              ? stopAndTranslate()
              : startRecording())
          }
        >
          <LinearGradient
            colors={
              recorderState.isRecording
                ? ["#E14972", "#B62956"]
                : ["#7552E9", "#4C27BD"]
            }
            style={styles.micButton}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Ionicons
                color="white"
                name={recorderState.isRecording ? "stop" : "mic"}
                size={34}
              />
            )}
          </LinearGradient>
        </Pressable>
        <Text style={styles.micLabel}>
          {recorderState.isRecording ? "Tap to translate" : "Tap to speak English"}
        </Text>
        <Pressable onPress={() => void changeStatus("ended")}>
          <Text style={styles.endText}>End conversation</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Header({
  onBack,
  title,
}: {
  onBack: () => void;
  title: string;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.headerButton}>
        <Ionicons color="#50465C" name="chevron-back" size={24} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerButton} />
    </View>
  );
}

function PrimaryButton({
  disabled,
  label,
  loading,
  onPress,
}: {
  disabled: boolean;
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: "#FAF9FD", flex: 1 },
  header: {
    alignItems: "center",
    backgroundColor: "white",
    borderBottomColor: "#E9E4ED",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerTitle: { color: "#281F32", fontSize: 16, fontWeight: "900" },
  centered: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "#F0EBFF",
    borderRadius: 30,
    height: 60,
    justifyContent: "center",
    marginBottom: 18,
    width: 60,
  },
  title: {
    color: "#281F32",
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
  },
  description: {
    color: "#746A7C",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
    marginTop: 9,
    maxWidth: 340,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#5B38D2",
    borderRadius: 14,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 52,
  },
  primaryButtonText: { color: "white", fontSize: 14, fontWeight: "900" },
  secondaryButton: { marginTop: 18, padding: 9 },
  secondaryButtonText: { color: "#5B38D2", fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  error: {
    color: "#B62956",
    fontSize: 12,
    marginTop: 16,
    textAlign: "center",
  },
  qrCard: {
    backgroundColor: "white",
    borderColor: "#E3DCEB",
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 15,
    padding: 18,
  },
  linkCard: {
    backgroundColor: "#F0EBFF",
    borderRadius: 12,
    marginBottom: 10,
    padding: 12,
    width: "100%",
  },
  linkText: { color: "#5434B6", fontSize: 11, textAlign: "center" },
  roomContent: { gap: 12, padding: 18, paddingBottom: 180 },
  roomStatus: {
    alignItems: "center",
    backgroundColor: "#ECFAF5",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  liveDot: {
    backgroundColor: "#20A277",
    borderRadius: 5,
    height: 9,
    width: 9,
  },
  roomStatusText: { color: "#28745D", fontSize: 11, fontWeight: "800" },
  messageCard: {
    backgroundColor: "white",
    borderColor: "#E6E0EA",
    borderRadius: 17,
    borderWidth: 1,
    padding: 16,
  },
  messageSpeaker: {
    color: "#7C7085",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  originalText: {
    color: "#302738",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  divider: { backgroundColor: "#ECE7F0", height: 1, marginVertical: 12 },
  translationText: {
    color: "#5B38D2",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
  },
  listenButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 5,
    marginTop: 12,
  },
  listenText: { color: "#5B38D2", fontSize: 11, fontWeight: "800" },
  roomControls: {
    alignItems: "center",
    backgroundColor: "white",
    borderTopColor: "#E6E0EA",
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingBottom: 18,
    paddingTop: 12,
    position: "absolute",
    right: 0,
  },
  micButton: {
    alignItems: "center",
    borderRadius: 35,
    height: 70,
    justifyContent: "center",
    width: 70,
  },
  micLabel: {
    color: "#4D4355",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 7,
  },
  endText: {
    color: "#B62956",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 10,
  },
});
