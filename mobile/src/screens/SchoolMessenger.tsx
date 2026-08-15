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
import { useEffect, useState } from "react";
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
  sendVoiceMessage,
  transcribeVoiceMessage,
  translateVoiceMessage,
  updateVoiceMessageEnglish,
  VoiceMessageDraft,
} from "../lib/voice-messages";

type Step = "record" | "preview" | "send";

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

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(null);

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
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to start recording.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function stopAndTranscribe() {
    if (!session || !message) return;
    try {
      setBusy(true);
      setError("");
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
      const result = await sendVoiceMessage(message.id, session.access_token);
      setListenUrl(result.listenUrl);
      setMessage(result.message);
      if (result.warning) {
        Alert.alert("Message ready", result.warning);
      } else {
        Alert.alert("Sent", "The parent SMS was sent with a secure listen link.");
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
  }

  const recording = recorderState.isRecording;

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
          <View style={styles.header}>
            <Image
              accessibilityLabel="Isfaham logo"
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../../assets/isfaham-icon.png")}
              style={styles.logo}
            />
            <View>
              <Text style={styles.brand}>Isfaham</Text>
              <Text style={styles.subtitle}>School-to-Family Voice Messages</Text>
            </View>
          </View>

          <Text style={styles.heading}>Send a Somali Voice Message</Text>
          <Text style={styles.support}>
            Record in English. Parents receive Somali audio.
          </Text>

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
              <View style={styles.phoneField}>
                <Ionicons color="#5B38D2" name="call-outline" size={18} />
                <TextInput
                  keyboardType="phone-pad"
                  onChangeText={setParentPhone}
                  placeholder="Parent phone number"
                  placeholderTextColor="#9B93A8"
                  style={styles.phoneInput}
                  value={parentPhone}
                />
              </View>

              {step === "record" || !message ? (
                <View style={styles.micBlock}>
                  <Pressable
                    disabled={busy || checkingStaff || recording}
                    onPress={() => void startRecordingFlow()}
                    style={[styles.micButton, recording && styles.micActive]}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" size="large" />
                    ) : (
                      <Ionicons color="#fff" name="mic" size={42} />
                    )}
                  </Pressable>
                  {recording ? (
                    <Pressable
                      onPress={() => void stopAndTranscribe()}
                      style={styles.stopButton}
                    >
                      <Text style={styles.stopText}>Tap to stop & review</Text>
                    </Pressable>
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
                        Create Somali preview
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
                      Preview Somali audio
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => void sendToParent()}
                    style={styles.primaryButton}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send to parent</Text>
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

              <View style={styles.steps}>
                {(
                  [
                    ["1", "Record", "record"],
                    ["2", "Preview", "preview"],
                    ["3", "Send", "send"],
                  ] as const
                ).map(([number, label, key], index) => {
                  const active =
                    step === key ||
                    (key === "record" && step === "record") ||
                    (key === "preview" && (step === "preview" || step === "send")) ||
                    (key === "send" && step === "send");
                  return (
                    <View key={key} style={styles.stepItem}>
                      <View
                        style={[
                          styles.stepDot,
                          active && styles.stepDotActive,
                          index < 2 && styles.stepSpacer,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stepNumber,
                            active && styles.stepNumberActive,
                          ]}
                        >
                          {number}
                        </Text>
                      </View>
                      <Text style={styles.stepLabel}>{label}</Text>
                    </View>
                  );
                })}
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
    paddingHorizontal: 22,
    paddingBottom: 120,
    paddingTop: 12,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  logo: { borderRadius: 12, height: 42, width: 42 },
  brand: {
    color: "#5B38D2",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#7C748A",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  heading: {
    color: "#2C2140",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  support: {
    color: "#7C748A",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
  },
  phoneField: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#E4DFEC",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 34,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  phoneInput: {
    color: "#2C2140",
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  micBlock: { alignItems: "center", marginBottom: 28 },
  micButton: {
    alignItems: "center",
    backgroundColor: "#5B38D2",
    borderRadius: 56,
    height: 112,
    justifyContent: "center",
    width: 112,
  },
  micActive: { backgroundColor: "#3F1FA8" },
  micLabel: {
    color: "#5B38D2",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 16,
  },
  stopButton: { marginTop: 16 },
  stopText: { color: "#B42318", fontSize: 16, fontWeight: "800" },
  steps: {
    backgroundColor: "#F3F0F8",
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  stepItem: { alignItems: "center", flex: 1 },
  stepDot: {
    alignItems: "center",
    backgroundColor: "#E6DFF5",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    marginBottom: 8,
    width: 32,
  },
  stepDotActive: { backgroundColor: "#5B38D2" },
  stepSpacer: {},
  stepNumber: { color: "#5B38D2", fontWeight: "800" },
  stepNumberActive: { color: "#fff" },
  stepLabel: { color: "#6F677D", fontSize: 13, fontWeight: "700" },
  privacy: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 4,
  },
  privacyText: { color: "#8A8296", fontSize: 13, fontWeight: "600" },
  previewCard: {
    backgroundColor: "#fff",
    borderColor: "#E4DFEC",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 22,
    padding: 16,
  },
  previewLabel: {
    color: "#5B38D2",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  transcriptInput: {
    backgroundColor: "#FAF9FD",
    borderColor: "#E4DFEC",
    borderRadius: 12,
    borderWidth: 1,
    color: "#2C2140",
    fontSize: 16,
    minHeight: 110,
    padding: 12,
    textAlignVertical: "top",
  },
  somaliText: {
    color: "#2C2140",
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#5B38D2",
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 14,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D9D1E8",
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: "#5B38D2", fontSize: 15, fontWeight: "800" },
  authCard: {
    backgroundColor: "#fff",
    borderColor: "#E4DFEC",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  authTitle: {
    color: "#2C2140",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  authCopy: { color: "#7C748A", marginBottom: 14 },
  input: {
    backgroundColor: "#FAF9FD",
    borderColor: "#E4DFEC",
    borderRadius: 12,
    borderWidth: 1,
    color: "#2C2140",
    fontSize: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  error: {
    color: "#B42318",
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  listenUrl: {
    color: "#7C748A",
    fontSize: 12,
    marginTop: 10,
  },
});
