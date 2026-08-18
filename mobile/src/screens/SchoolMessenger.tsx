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
import type { Session } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

import { getCreditBalance } from "../lib/credits";
import { requestStaffCode } from "../lib/remote";
import { supabase } from "../lib/supabase";
import {
  createVoiceMessage,
  DeliveryChannel,
  sendVoiceMessage,
  transcribeVoiceMessage,
  translateVoiceMessage,
  updateVoiceMessageEnglish,
  VoiceMessageDraft,
} from "../lib/voice-messages";

type Step = "record" | "preview" | "send";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function SchoolMessenger() {
  const [session, setSession] = useState<Session | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [checkingStaff, setCheckingStaff] = useState(true);
  const [parentPhone, setParentPhone] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("record");
  const [message, setMessage] = useState<VoiceMessageDraft | null>(null);
  const [englishText, setEnglishText] = useState("");
  const [somaliText, setSomaliText] = useState("");
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  const [listenUrl, setListenUrl] = useState("");
  const [deliveryChannel, setDeliveryChannel] =
    useState<DeliveryChannel>("sms");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const countdownActive = useRef(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(null);
  const recording = recorderState.isRecording;

  useEffect(() => {
    if (!recording) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!supabase) {
      setCheckingStaff(false);
      return;
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
    if (!session || session.user.is_anonymous) {
      setIsStaff(false);
      setCheckingStaff(false);
      return;
    }
    setCheckingStaff(true);
    void getCreditBalance(session.access_token)
      .then((balance) => {
        if (active) setIsStaff(balance.schoolFunded);
      })
      .catch(() => {
        if (active) setIsStaff(false);
      })
      .finally(() => {
        if (active) setCheckingStaff(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  async function ensureStaffSession() {
    if (session && !session.user.is_anonymous && isStaff) {
      return session;
    }
    setShowAuth(true);
    return null;
  }

  async function sendCode() {
    try {
      setBusy(true);
      setError("");
      await requestStaffCode(authEmail.trim().toLowerCase());
      setCodeSent(true);
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Could not send code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!supabase) {
      setError("Sign in is unavailable.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: authEmail.trim().toLowerCase(),
        token: authCode.trim(),
        type: "email",
      });
      if (verifyError) {
        throw verifyError;
      }
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (!data.session) {
        throw new Error("Sign in failed.");
      }
      const balance = await getCreditBalance(data.session.access_token);
      if (!balance.schoolFunded) {
        throw new Error("This email is not approved for school messaging.");
      }
      setIsStaff(true);
      setShowAuth(false);
      setCodeSent(false);
      setAuthCode("");
    } catch (verifyErr) {
      setError(
        verifyErr instanceof Error ? verifyErr.message : "Invalid code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function startRecordingFlow() {
    setError("");
    if (countdown !== null || countdownActive.current || recording) {
      return;
    }
    if (!parentPhone.trim()) {
      setError("Enter the parent’s phone number first.");
      return;
    }
    const activeSession = await ensureStaffSession();
    if (!activeSession) {
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError("Microphone permission is required.");
      return;
    }

    try {
      setBusy(true);
      countdownActive.current = true;
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      const created = await createVoiceMessage(
        parentPhone,
        activeSession.access_token,
      );
      setMessage(created.message);
      setEnglishText("");
      setSomaliText("");
      setAudioDataUri(null);
      setListenUrl("");
      setStep("record");
      setBusy(false);

      for (const value of [3, 2, 1]) {
        if (!countdownActive.current) {
          return;
        }
        setCountdown(value);
        await wait(1000);
      }
      setCountdown(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setElapsedSeconds(0);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to start recording.",
      );
      setCountdown(null);
    } finally {
      countdownActive.current = false;
      setBusy(false);
    }
  }

  async function stopAndTranscribe() {
    if (!session || !message || busy) return;
    try {
      setBusy(true);
      setError("");
      setCountdown(null);
      countdownActive.current = false;
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        throw new Error("Recording was empty. Please try again.");
      }
      const transcribed = await transcribeVoiceMessage(
        message.id,
        uri,
        session.access_token,
      );
      setMessage(transcribed.message);
      setEnglishText(transcribed.message.english_text || "");
      setStep("preview");
    } catch (stopError) {
      setError(
        stopError instanceof Error
          ? stopError.message
          : "Unable to transcribe recording.",
      );
    } finally {
      setBusy(false);
    }
  }

  function onMainButtonPress() {
    if (countdown !== null) {
      return;
    }
    if (recording) {
      void stopAndTranscribe();
      return;
    }
    void startRecordingFlow();
  }

  async function buildSomaliPreview() {
    if (!session || !message) return;
    try {
      setBusy(true);
      setError("");
      if (englishText.trim() !== (message.english_text || "").trim()) {
        await updateVoiceMessageEnglish(
          message.id,
          englishText.trim(),
          session.access_token,
        );
      }
      const translated = await translateVoiceMessage(
        message.id,
        session.access_token,
      );
      setMessage(translated.message);
      setSomaliText(translated.message.somali_text || "");
      const path = `${FileSystem.cacheDirectory}isfaham-preview-${message.id}.mp3`;
      await FileSystem.writeAsStringAsync(path, translated.audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setAudioDataUri(path);
      player.replace(path);
      setStep("send");
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Unable to create Somali preview.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendToParent() {
    if (!session || !message) return;
    try {
      setBusy(true);
      setError("");
      const result = await sendVoiceMessage(
        message.id,
        session.access_token,
        deliveryChannel,
      );
      setListenUrl(result.listenUrl);
      setMessage(result.message);
      if (result.warning) {
        Alert.alert("Message ready", result.warning);
      } else {
        Alert.alert(
          "Sent",
          deliveryChannel === "whatsapp"
            ? "The parent WhatsApp message was sent with a secure listen link."
            : "The parent SMS was sent with a secure listen link.",
        );
      }
      setStep("record");
      setMessage(null);
      setEnglishText("");
      setSomaliText("");
      setAudioDataUri(null);
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Unable to send.",
      );
    } finally {
      setBusy(false);
    }
  }

  function resetRecording() {
    setMessage(null);
    setEnglishText("");
    setSomaliText("");
    setAudioDataUri(null);
    setListenUrl("");
    setStep("record");
    setError("");
    setCountdown(null);
    setElapsedSeconds(0);
    countdownActive.current = false;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBlock}>
            <View style={styles.header}>
              <Image
                accessibilityLabel="Isfaham logo"
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require("../../assets/isfaham-icon.png")}
                style={styles.logo}
              />
              <View>
                <Text style={styles.brand}>Isfaham</Text>
                <Text style={styles.subtitle}>
                  School-to-Family Voice Messages
                </Text>
              </View>
            </View>

            <Text style={styles.heading}>Speak English. Parents hear Somali.</Text>
            <Text style={styles.support}>
              Send a Somali voice message.
            </Text>
          </View>

          {showAuth ? (
            <View style={styles.authCard}>
              <Text style={styles.authTitle}>School sign in</Text>
              <Text style={styles.authCopy}>
                Enter your authorized school email to continue.
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setAuthEmail}
                placeholder="you@school.org"
                style={styles.input}
                value={authEmail}
              />
              {codeSent ? (
                <TextInput
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={setAuthCode}
                  placeholder="6-digit code"
                  style={styles.input}
                  value={authCode}
                />
              ) : null}
              <Pressable
                disabled={busy}
                onPress={() => void (codeSent ? verifyCode() : sendCode())}
                style={styles.primaryButton}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {codeSent ? "Verify and continue" : "Send code"}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Parent phone number</Text>
              <View style={styles.phoneField}>
                <Ionicons color="#5B38D2" name="call-outline" size={18} />
                <TextInput
                  keyboardType="phone-pad"
                  onChangeText={setParentPhone}
                  placeholder="(612) 555-0123"
                  placeholderTextColor="#9B93A8"
                  style={styles.phoneInput}
                  value={parentPhone}
                />
              </View>

              {step === "record" || !message ? (
                <View style={styles.micStage}>
                  {countdown !== null ? (
                    <Text style={styles.countdownHint}>Get ready…</Text>
                  ) : null}
                  <Pressable
                    disabled={busy || checkingStaff || countdown !== null}
                    onPress={onMainButtonPress}
                    style={[
                      styles.micButton,
                      recording && styles.stopButtonActive,
                      countdown !== null && styles.countdownButton,
                    ]}
                  >
                    {busy && !recording && countdown === null ? (
                      <ActivityIndicator color="#fff" size="large" />
                    ) : countdown !== null ? (
                      <Text style={styles.countdownNumber}>{countdown}</Text>
                    ) : recording ? (
                      <View style={styles.stopSquare} />
                    ) : (
                      <Ionicons color="#fff" name="mic" size={72} />
                    )}
                  </Pressable>
                  {countdown !== null ? (
                    <Text style={styles.micLabel}>Starting in {countdown}…</Text>
                  ) : recording ? (
                    <>
                      <Text style={styles.recordingTimer}>
                        {formatElapsed(elapsedSeconds)}
                      </Text>
                      <Text style={styles.stopText}>
                        Recording… Tap red button to stop
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.micLabel}>Tap to Record in English</Text>
                  )}
                </View>
              ) : null}

              {step === "preview" && message ? (
                <View style={styles.previewCard}>
                  <Text style={styles.previewLabel}>English transcript</Text>
                  <TextInput
                    multiline
                    onChangeText={setEnglishText}
                    style={styles.transcriptInput}
                    value={englishText}
                  />
                  <Pressable
                    disabled={busy}
                    onPress={() => void buildSomaliPreview()}
                    style={styles.primaryButton}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Continue to Somali
                      </Text>
                    )}
                  </Pressable>
                  <Pressable onPress={resetRecording} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Record again</Text>
                  </Pressable>
                </View>
              ) : null}

              {step === "send" && message ? (
                <View style={styles.previewCard}>
                  <Text style={styles.previewLabel}>Somali message</Text>
                  <Text style={styles.somaliText}>{somaliText}</Text>
                  <Pressable
                    disabled={!audioDataUri}
                    onPress={() => {
                      if (audioDataUri) {
                        player.replace(audioDataUri);
                        player.play();
                      }
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Listen in Somali
                    </Text>
                  </Pressable>

                  <Text style={styles.previewLabel}>Send by</Text>
                  <View style={styles.channelRow}>
                    <Pressable
                      onPress={() => setDeliveryChannel("sms")}
                      style={[
                        styles.channelChip,
                        deliveryChannel === "sms" && styles.channelChipActive,
                      ]}
                    >
                      <Ionicons
                        color={deliveryChannel === "sms" ? "#fff" : "#5B38D2"}
                        name="chatbubble-ellipses-outline"
                        size={16}
                      />
                      <Text
                        style={[
                          styles.channelChipText,
                          deliveryChannel === "sms" &&
                            styles.channelChipTextActive,
                        ]}
                      >
                        SMS
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setDeliveryChannel("whatsapp")}
                      style={[
                        styles.channelChip,
                        deliveryChannel === "whatsapp" &&
                          styles.channelChipActive,
                      ]}
                    >
                      <Ionicons
                        color={
                          deliveryChannel === "whatsapp" ? "#fff" : "#5B38D2"
                        }
                        name="logo-whatsapp"
                        size={16}
                      />
                      <Text
                        style={[
                          styles.channelChipText,
                          deliveryChannel === "whatsapp" &&
                            styles.channelChipTextActive,
                        ]}
                      >
                        WhatsApp
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={styles.channelHint}>
                    Use WhatsApp if the parent uses it. Otherwise send SMS.
                  </Text>

                  <Pressable
                    disabled={busy}
                    onPress={() => void sendToParent()}
                    style={styles.primaryButton}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {deliveryChannel === "whatsapp"
                          ? "Send on WhatsApp"
                          : "Send SMS"}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable onPress={resetRecording} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Record again</Text>
                  </Pressable>
                  {listenUrl ? (
                    <Text style={styles.listenUrl}>{listenUrl}</Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.stepsCard}>
                <View style={styles.stepsTrack}>
                  {(
                    [
                      ["1", "Record", "record"],
                      ["2", "Preview", "preview"],
                      ["3", "Send", "send"],
                    ] as const
                  ).map(([number, label, key], index, list) => {
                    const order = { record: 0, preview: 1, send: 2 } as const;
                    const current = order[step];
                    const thisOrder = order[key];
                    const isCurrent = thisOrder === current;
                    const isDone = thisOrder < current;
                    return (
                      <View key={key} style={styles.stepCluster}>
                        <View style={styles.stepItem}>
                          <View
                            style={[
                              styles.stepCircle,
                              isDone && styles.stepCircleDone,
                              isCurrent && styles.stepCircleCurrent,
                            ]}
                          >
                            <Text
                              style={[
                                styles.stepNumber,
                                (isCurrent || isDone) && styles.stepNumberActive,
                              ]}
                            >
                              {number}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.stepLabel,
                              isCurrent && styles.stepLabelActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </View>
                        {index < list.length - 1 ? (
                          <View style={styles.stepConnector}>
                            <View style={styles.stepDotMark} />
                            <View style={styles.stepDotMark} />
                            <View style={styles.stepDotMark} />
                            <View style={styles.stepDotMark} />
                            <View style={styles.stepDotMark} />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.privacy}>
                <Ionicons color="#5B38D2" name="shield-checkmark" size={16} />
                <Text style={styles.privacyText}>
                  Your personal phone number stays private.
                </Text>
              </View>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "#FAF9FD", flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  topBlock: {
    marginBottom: 8,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  logo: { borderRadius: 10, height: 34, width: 34 },
  brand: {
    color: "#5B38D2",
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: "#7C748A",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  heading: {
    color: "#2C2140",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  support: {
    color: "#7C748A",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 20,
  },
  fieldLabel: {
    color: "#2C2140",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  phoneField: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#E4DFEC",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  phoneInput: {
    color: "#2C2140",
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
  },
  micStage: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 260,
    paddingVertical: 18,
  },
  micButton: {
    alignItems: "center",
    backgroundColor: "#5B38D2",
    borderRadius: 100,
    elevation: 8,
    height: 196,
    justifyContent: "center",
    shadowColor: "#5B38D2",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    width: 196,
  },
  micActive: { backgroundColor: "#3F1FA8" },
  stopButtonActive: {
    backgroundColor: "#D92D20",
    shadowColor: "#D92D20",
  },
  countdownButton: {
    backgroundColor: "#5B38D2",
  },
  countdownNumber: {
    color: "#fff",
    fontSize: 72,
    fontWeight: "800",
  },
  countdownHint: {
    color: "#5B38D2",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 12,
  },
  stopSquare: {
    backgroundColor: "#fff",
    borderRadius: 8,
    height: 42,
    width: 42,
  },
  recordingTimer: {
    color: "#D92D20",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 18,
  },
  micLabel: {
    color: "#5B38D2",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 16,
  },
  stopText: {
    color: "#D92D20",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 6,
  },
  stepsCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E8E1F4",
    borderRadius: 24,
    borderWidth: 1,
    elevation: 3,
    marginBottom: 14,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 20,
    shadowColor: "#5B38D2",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  stepsTrack: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "center",
  },
  stepCluster: {
    alignItems: "center",
    flexDirection: "row",
  },
  stepItem: {
    alignItems: "center",
    minWidth: 64,
  },
  stepConnector: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginHorizontal: 6,
    marginTop: 15,
  },
  stepDotMark: {
    backgroundColor: "#C9BEDD",
    borderRadius: 3,
    height: 4,
    width: 4,
  },
  stepCircle: {
    alignItems: "center",
    backgroundColor: "#F3EEFA",
    borderColor: "#D9CEF0",
    borderRadius: 17,
    borderWidth: 1.5,
    height: 34,
    justifyContent: "center",
    marginBottom: 8,
    width: 34,
  },
  stepCircleDone: {
    backgroundColor: "#5B38D2",
    borderColor: "#5B38D2",
  },
  stepCircleCurrent: {
    backgroundColor: "#5B38D2",
    borderColor: "#5B38D2",
    elevation: 3,
    shadowColor: "#5B38D2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  stepNumber: { color: "#5B38D2", fontSize: 13, fontWeight: "800" },
  stepNumberActive: { color: "#fff" },
  stepLabel: { color: "#7C748A", fontSize: 12, fontWeight: "700" },
  stepLabelActive: { color: "#5B38D2" },
  privacy: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 8,
    marginTop: 2,
  },
  privacyText: { color: "#8A8296", fontSize: 11, fontWeight: "600" },
  previewCard: {
    backgroundColor: "#fff",
    borderColor: "#E4DFEC",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
    padding: 14,
  },
  previewLabel: {
    color: "#5B38D2",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  transcriptInput: {
    backgroundColor: "#FAF9FD",
    borderColor: "#E4DFEC",
    borderRadius: 12,
    borderWidth: 1,
    color: "#2C2140",
    fontSize: 14,
    minHeight: 100,
    padding: 12,
    textAlignVertical: "top",
  },
  somaliText: {
    color: "#2C2140",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  channelRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  channelChip: {
    alignItems: "center",
    backgroundColor: "#F3EFFA",
    borderColor: "#D9D1E8",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 12,
  },
  channelChipActive: {
    backgroundColor: "#5B38D2",
    borderColor: "#5B38D2",
  },
  channelChipText: {
    color: "#5B38D2",
    fontSize: 13,
    fontWeight: "800",
  },
  channelChipTextActive: { color: "#fff" },
  channelHint: {
    color: "#7C748A",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#5B38D2",
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 12,
  },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D9D1E8",
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 11,
  },
  secondaryButtonText: { color: "#5B38D2", fontSize: 13, fontWeight: "800" },
  authCard: {
    backgroundColor: "#fff",
    borderColor: "#E4DFEC",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  authTitle: {
    color: "#2C2140",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },
  authCopy: { color: "#7C748A", fontSize: 13, marginBottom: 12 },
  input: {
    backgroundColor: "#FAF9FD",
    borderColor: "#E4DFEC",
    borderRadius: 12,
    borderWidth: 1,
    color: "#2C2140",
    fontSize: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  error: {
    color: "#B42318",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  listenUrl: {
    color: "#7C748A",
    fontSize: 11,
    marginTop: 10,
  },
});
