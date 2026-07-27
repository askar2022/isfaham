import { Ionicons } from "@expo/vector-icons";
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
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createRemoteConversation,
  getRemoteRoom,
  RemoteMessage,
  RemoteRoom,
  requestStaffCode,
  speakRemoteMessage,
  translateRemoteTurn,
  updateRemoteRoom,
} from "../lib/remote";
import { getCreditBalance } from "../lib/credits";
import { supabase } from "../lib/supabase";

export function StaffRemote({ onClose }: { onClose: () => void }) {
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [teacherPhone, setTeacherPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [room, setRoom] = useState<RemoteRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(null);
  const playedMessages = useRef(new Set<string>());

  useEffect(() => {
    if (!supabase) {
      const unavailable = setTimeout(() => setCheckingSession(false), 0);
      return () => clearTimeout(unavailable);
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_, next) => {
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    const checkAccount = setTimeout(() => {
      if (!session || session.user.is_anonymous) {
        if (active) {
          setIsStaff(false);
          setCheckingSession(false);
        }
        return;
      }

      void getCreditBalance(session.access_token)
        .then((balance) => {
          if (active) setIsStaff(balance.schoolFunded);
        })
        .catch(() => {
          if (active) setIsStaff(false);
        })
        .finally(() => {
          if (active) setCheckingSession(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(checkAccount);
    };
  }, [session]);

  const playAudio = useCallback(
    async (audioBase64: string, id: string) => {
      const uri = `${FileSystem.cacheDirectory}isfaham-remote-${id}.mp3`;
      await FileSystem.writeAsStringAsync(uri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      player.replace({ uri });
      player.play();
    },
    [player],
  );

  const loadRoom = useCallback(async () => {
    if (!token || !session) return;
    try {
      const nextRoom = await getRemoteRoom(token, session.access_token);
      setRoom(nextRoom);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Conversation unavailable.",
      );
    }
  }, [session, token]);

  useEffect(() => {
    if (!token || !session) return;
    const firstLoad = setTimeout(() => void loadRoom(), 0);
    const poll = setInterval(() => void loadRoom(), 2000);
    return () => {
      clearTimeout(firstLoad);
      clearInterval(poll);
    };
  }, [loadRoom, session, token]);

  useEffect(() => {
    if (!room || room.status !== "active") return;
    const latestParentMessage = [...room.messages]
      .reverse()
      .find(
        (message) =>
          message.speaker === "parent" &&
          !playedMessages.current.has(message.id),
      );
    room.messages.forEach((message) => playedMessages.current.add(message.id));
    if (!latestParentMessage || !token) return;

    void speakRemoteMessage(token, latestParentMessage.id)
      .then((audio) => playAudio(audio.audioBase64, latestParentMessage.id))
      .catch(() => {
        // The visible Listen action remains available.
      });
  }, [playAudio, room, token]);

  async function sendCode() {
    setBusy(true);
    setError("");
    try {
      await requestStaffCode(email);
      setCodeSent(true);
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      });
      if (verifyError || !data.session) {
        throw new Error("That code is incorrect or has expired.");
      }
      setSession(data.session);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createInvitation() {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const conversation = await createRemoteConversation(
        teacherPhone,
        parentPhone,
        session.access_token,
      );
      setToken(conversation.publicToken);
      if (!conversation.smsSent && conversation.warning) {
        Alert.alert("Invitation created", conversation.warning);
      }
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeRoomStatus(status: "active" | "ended") {
    if (!token || !session) return;
    setBusy(true);
    setError("");
    try {
      await updateRemoteRoom(token, status, session.access_token);
      await loadRoom();
    } catch (statusError) {
      setError(
        statusError instanceof Error ? statusError.message : "Please try again.",
      );
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
    if (!recorderState.isRecording || !token || !session) return;
    const durationMs = recorderState.durationMillis;
    setBusy(true);
    setError("");
    try {
      await recorder.stop();
      if (!recorder.uri || durationMs < 500) {
        throw new Error("Speak for a moment before stopping.");
      }
      const result = await translateRemoteTurn(
        token,
        recorder.uri,
        durationMs,
        session.access_token,
      );
      await playAudio(result.audioBase64, `${Date.now()}`);
      await loadRoom();
    } catch (translationError) {
      setError(
        translationError instanceof Error
          ? translationError.message
          : "Translation failed.",
      );
    } finally {
      setBusy(false);
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    }
  }

  async function listen(message: RemoteMessage) {
    if (!token) return;
    try {
      const audio = await speakRemoteMessage(token, message.id);
      await playAudio(audio.audioBase64, message.id);
    } catch {
      setError("Audio playback is unavailable.");
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
    setToken(null);
    setRoom(null);
  }

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color="#5B38D2" size="large" />
      </SafeAreaView>
    );
  }

  if (!session || session.user.is_anonymous || !isStaff) {
    return (
      <SafeAreaView style={styles.page}>
        <Header onBack={onClose} title="School Sign In" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.signInCentered}
        >
          <View style={styles.card}>
            <View style={styles.lockIcon}>
              <Ionicons color="#5B38D2" name="school" size={27} />
            </View>
            <Text style={styles.title}>
              {codeSent
                ? "Check Your Email"
                : "Access Your School Translation Tools"}
            </Text>
            <Text style={styles.description}>
              {codeSent
                ? `Enter the six-digit code sent to ${email}.`
                : session && !session.user.is_anonymous
                  ? "Sign in with your verified school email to switch from Personal to your school's secure translation tools."
                  : "Sign in with your verified school email to access secure translation tools for your school."}
            </Text>
            {!codeSent && (
              <View style={styles.staffBenefits}>
                {[
                  "Secure school access",
                  "Communicate with families",
                  "Real-time voice translation",
                ].map((benefit) => (
                  <View key={benefit} style={styles.staffBenefit}>
                    <Ionicons
                      color="#198462"
                      name="checkmark-circle"
                      size={17}
                    />
                    <Text style={styles.staffBenefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
            )}
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              editable={!codeSent}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="teacher@school.org"
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />
            {codeSent && (
              <TextInput
                autoFocus
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(value) =>
                  setCode(value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                style={[styles.input, styles.codeInput]}
                textContentType="oneTimeCode"
                value={code}
              />
            )}
            <PrimaryButton
              disabled={busy || (codeSent ? code.length !== 6 : !email)}
              label={codeSent ? "Verify and sign in" : "Continue"}
              loading={busy}
              onPress={() => void (codeSent ? verifyCode() : sendCode())}
            />
            {codeSent && (
              <Pressable
                onPress={() => {
                  setCodeSent(false);
                  setCode("");
                  setError("");
                }}
              >
                <Text style={styles.textButton}>Use a different email</Text>
              </Pressable>
            )}
            {!codeSent && (
              <View style={styles.staffTrust}>
                <Ionicons color="#6E6577" name="lock-closed" size={13} />
                <Text style={styles.staffTrustText}>
                  Only verified school email addresses can access school
                  features
                </Text>
              </View>
            )}
            {!!error && <Text style={styles.error}>{error}</Text>}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.page}>
        <Header onBack={onClose} title="Remote conversation" />
        <ScrollView contentContainerStyle={styles.formPage}>
          <Text style={styles.eyebrow}>STAFF WORKSPACE</Text>
          <Text style={styles.largeTitle}>Invite a parent</Text>
          <Text style={styles.descriptionLeft}>
            Both phone numbers stay private. The parent receives a secure link
            that expires automatically.
          </Text>
          <View style={styles.card}>
            <Text style={styles.label}>Your school or personal phone</Text>
            <TextInput
              keyboardType="phone-pad"
              onChangeText={setTeacherPhone}
              placeholder="612 555 0123"
              style={styles.input}
              value={teacherPhone}
            />
            <Text style={styles.label}>Parent phone</Text>
            <TextInput
              keyboardType="phone-pad"
              onChangeText={setParentPhone}
              placeholder="612 555 0456"
              style={styles.input}
              value={parentPhone}
            />
            <PrimaryButton
              disabled={busy || !teacherPhone || !parentPhone}
              label="Create and send invitation"
              loading={busy}
              onPress={() => void createInvitation()}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
          </View>
          <Pressable onPress={() => void signOut()}>
            <Text style={styles.textButton}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!room) {
    return (
      <SafeAreaView style={styles.page}>
        <Header onBack={() => setToken(null)} title="Remote conversation" />
        <View style={styles.centered}>
          <ActivityIndicator color="#5B38D2" size="large" />
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  if (room.status === "waiting") {
    return (
      <SafeAreaView style={styles.page}>
        <Header onBack={() => setToken(null)} title={room.schoolName} />
        <View style={styles.centeredContent}>
          <View style={styles.waitIcon}>
            <Ionicons color="#5B38D2" name="people" size={34} />
          </View>
          <Text style={styles.largeTitle}>Invitation sent</Text>
          <Text style={styles.description}>
            Start when you and the parent are ready. Their browser will join the
            same private conversation.
          </Text>
          <PrimaryButton
            disabled={busy}
            label="Start conversation"
            loading={busy}
            onPress={() => void changeRoomStatus("active")}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  if (room.status === "ended") {
    return (
      <SafeAreaView style={styles.page}>
        <Header onBack={onClose} title="Conversation ended" />
        <View style={styles.centeredContent}>
          <Ionicons color="#238765" name="checkmark-circle" size={64} />
          <Text style={styles.largeTitle}>Conversation complete</Text>
          <PrimaryButton
            label="Invite another parent"
            onPress={() => {
              setToken(null);
              setRoom(null);
              setParentPhone("");
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.liveHeader}>
        <View>
          <Text style={styles.liveTitle}>Live conversation</Text>
          <Text style={styles.liveSchool}>{room.schoolName}</Text>
        </View>
        <Pressable
          disabled={busy}
          onPress={() => void changeRoomStatus("ended")}
          style={styles.endButton}
        >
          <Ionicons color="#B32A50" name="call" size={15} />
          <Text style={styles.endButtonText}>End</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.messages}>
        {!room.messages.length && (
          <View style={styles.emptyMessages}>
            <Ionicons color="#6B48DA" name="sparkles" size={30} />
            <Text style={styles.title}>Begin when you’re ready</Text>
            <Text style={styles.description}>
              Tap the microphone and speak English.
            </Text>
          </View>
        )}
        {room.messages.map((message) => {
          const mine = message.speaker === "teacher";
          return (
            <View
              key={message.id}
              style={[styles.message, mine && styles.messageMine]}
            >
              <Text style={[styles.messageLabel, mine && styles.messageMineText]}>
                {mine ? "TEACHER" : "PARENT"}
              </Text>
              <Text style={[styles.messageText, mine && styles.messageMineText]}>
                {message.original_text}
              </Text>
              <View style={styles.translation}>
                <Ionicons
                  color={mine ? "#E2D9FF" : "#6944DF"}
                  name="sparkles"
                  size={12}
                />
                <Text
                  style={[
                    styles.translationText,
                    mine && styles.messageMineText,
                  ]}
                >
                  {message.translated_text}
                </Text>
              </View>
              <Pressable onPress={() => void listen(message)}>
                <Text
                  style={[styles.listenText, mine && styles.messageMineText]}
                >
                  🔊 Listen
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.remoteControls}>
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
            style={styles.mic}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Ionicons
                color="white"
                name={recorderState.isRecording ? "stop" : "mic"}
                size={31}
              />
            )}
          </LinearGradient>
        </Pressable>
        <Text style={styles.micText}>
          {recorderState.isRecording
            ? "Tap to stop and translate"
            : "Tap to speak English"}
        </Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
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
        <Ionicons color="#4F4660" name="chevron-back" size={23} />
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
  disabled?: boolean;
  label: string;
  loading?: boolean;
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
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 22,
  },
  signInCentered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 110,
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  centeredContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 28,
  },
  header: {
    alignItems: "center",
    backgroundColor: "white",
    borderBottomColor: "#E8E3ED",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  headerButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  headerTitle: { color: "#261D34", fontSize: 16, fontWeight: "800" },
  card: {
    backgroundColor: "white",
    borderColor: "#E4DFE9",
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 430,
    padding: 24,
    width: "100%",
  },
  lockIcon: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#F0EBFF",
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    marginBottom: 16,
    width: 52,
  },
  title: {
    color: "#261E30",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  largeTitle: {
    color: "#241B31",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    color: "#766E7F",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20,
    marginTop: 7,
    textAlign: "center",
  },
  staffBenefits: {
    gap: 9,
    marginBottom: 18,
  },
  staffBenefit: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  staffBenefitText: {
    color: "#554C5C",
    fontSize: 12,
    fontWeight: "700",
  },
  descriptionLeft: {
    color: "#766E7F",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
  },
  input: {
    backgroundColor: "#FAF9FC",
    borderColor: "#DDD7E4",
    borderRadius: 12,
    borderWidth: 1,
    color: "#292230",
    fontSize: 15,
    marginBottom: 14,
    padding: 14,
  },
  codeInput: {
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: 9,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#5B38D2",
    borderRadius: 13,
    justifyContent: "center",
    marginTop: 4,
    minHeight: 51,
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: "white", fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  textButton: {
    color: "#5B38D2",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 17,
    textAlign: "center",
  },
  error: {
    color: "#B62956",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 13,
    textAlign: "center",
  },
  staffTrust: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginTop: 13,
  },
  staffTrustText: {
    color: "#746C7B",
    fontSize: 9,
    fontWeight: "600",
  },
  formPage: { padding: 24 },
  eyebrow: {
    color: "#6540D9",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  label: {
    color: "#504758",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 7,
  },
  waitIcon: {
    alignItems: "center",
    backgroundColor: "#F0EBFF",
    borderRadius: 38,
    height: 76,
    justifyContent: "center",
    marginBottom: 19,
    width: 76,
  },
  liveHeader: {
    alignItems: "center",
    backgroundColor: "white",
    borderBottomColor: "#E8E3ED",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  liveTitle: { color: "#24202B", fontSize: 15, fontWeight: "900" },
  liveSchool: { color: "#89818F", fontSize: 10, marginTop: 2 },
  endButton: {
    alignItems: "center",
    backgroundColor: "#FDECF1",
    borderRadius: 18,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  endButtonText: { color: "#B32A50", fontSize: 11, fontWeight: "800" },
  messages: { flexGrow: 1, padding: 17 },
  emptyMessages: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 260,
  },
  message: {
    alignSelf: "flex-start",
    backgroundColor: "white",
    borderColor: "#E2DCE8",
    borderRadius: 17,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    marginBottom: 14,
    maxWidth: "88%",
    padding: 15,
  },
  messageMine: {
    alignSelf: "flex-end",
    backgroundColor: "#5B38D2",
    borderBottomLeftRadius: 17,
    borderBottomRightRadius: 5,
    borderColor: "#5B38D2",
  },
  messageLabel: {
    color: "#6540D9",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  messageText: {
    color: "#29212F",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 6,
  },
  messageMineText: { color: "white" },
  translation: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 5,
    marginTop: 10,
  },
  translationText: {
    color: "#655B6E",
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  listenText: {
    color: "#6540D9",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 10,
  },
  remoteControls: {
    alignItems: "center",
    backgroundColor: "white",
    borderTopColor: "#E7E2EB",
    borderTopWidth: 1,
    padding: 13,
  },
  mic: {
    alignItems: "center",
    borderRadius: 34,
    height: 68,
    justifyContent: "center",
    width: 68,
  },
  micText: {
    color: "#312839",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },
});
