import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Step = "welcome" | "choice" | "one-phone";

export function WelcomeFlow({
  onCreateAccount,
  onInviteSomeone,
  onStartConversation,
}: {
  onCreateAccount: () => void;
  onInviteSomeone: () => void;
  onStartConversation: () => void;
}) {
  const [step, setStep] = useState<Step>("welcome");

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        {step === "welcome" && (
          <>
            <Image
              accessibilityLabel="Isfaham logo"
              source={require("../../assets/isfaham-icon.png")}
              style={styles.brandIcon}
            />
            <Text style={styles.brand}>Isfaham</Text>
            <Text style={styles.tagline}>
              Live Somali ⇄ English translation.
            </Text>
            <View style={styles.trialBadge}>
              <Ionicons color="#5B38D2" name="gift-outline" size={18} />
              <Text style={styles.trialText}>
                Try 2 minutes free — no account required.
              </Text>
            </View>
            <View style={styles.languageCard}>
              <Text style={styles.language}>Somali</Text>
              <Ionicons color="#6B48DD" name="swap-horizontal" size={24} />
              <Text style={styles.language}>English</Text>
            </View>
            <Pressable onPress={() => setStep("choice")}>
              <LinearGradient
                colors={["#7552E9", "#4C27BD"]}
                style={styles.mic}
              >
                <Ionicons color="white" name="mic" size={46} />
              </LinearGradient>
            </Pressable>
            <Text style={styles.instruction}>
              Tap the microphone and start speaking
            </Text>
            <Pressable
              onPress={() => setStep("choice")}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Try It Now</Text>
            </Pressable>
            <Pressable onPress={onCreateAccount} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>Create Free Account</Text>
            </Pressable>
          </>
        )}

        {step === "choice" && (
          <>
            <View style={styles.smallIcon}>
              <Ionicons color="#5B38D2" name="chatbubbles" size={30} />
            </View>
            <Text style={styles.title}>Choose how to translate</Text>
            <Pressable
              onPress={() => setStep("one-phone")}
              style={styles.optionCard}
            >
              <View style={styles.optionIcon}>
                <Ionicons color="#5B38D2" name="phone-portrait" size={24} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>Use One Phone</Text>
                <Text style={styles.optionDescription}>
                  Share one phone and take turns speaking.
                </Text>
              </View>
              <Ionicons color="#8A7D96" name="chevron-forward" size={21} />
            </Pressable>
            <Pressable onPress={onInviteSomeone} style={styles.optionCard}>
              <View style={styles.optionIcon}>
                <Ionicons color="#5B38D2" name="link" size={24} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>Invite Another Phone</Text>
                <Text style={styles.optionDescription}>
                  Send a link or QR code so someone can join remotely. A free
                  host account is required.
                </Text>
              </View>
              <Ionicons color="#8A7D96" name="chevron-forward" size={21} />
            </Pressable>
            <Pressable
              onPress={() => setStep("welcome")}
              style={styles.textButton}
            >
              <Text style={styles.textButtonLabel}>Back</Text>
            </Pressable>
          </>
        )}

        {step === "one-phone" && (
          <>
            <View style={styles.smallIcon}>
              <Ionicons color="#5B38D2" name="people" size={32} />
            </View>
            <Text style={styles.title}>One phone, two speakers</Text>
            <Text style={styles.description}>
              Share your phone and take turns speaking.
            </Text>
            <Text style={styles.description}>
              Isfaham translates Somali and English so you can both follow the
              conversation.
            </Text>
            <Pressable
              onPress={onStartConversation}
              style={[styles.primaryButton, styles.startButton]}
            >
              <Text style={styles.primaryButtonText}>Start Conversation</Text>
            </Pressable>
            <Pressable
              onPress={() => setStep("choice")}
              style={styles.textButton}
            >
              <Text style={styles.textButtonLabel}>Back</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: "#FAF9FD", flex: 1 },
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  brandIcon: {
    borderRadius: 18,
    height: 64,
    marginBottom: 16,
    width: 64,
  },
  brand: {
    color: "#251D2D",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  tagline: {
    color: "#766C7E",
    fontSize: 15,
    marginTop: 6,
  },
  trialBadge: {
    alignItems: "center",
    backgroundColor: "#F0EBFF",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    marginTop: 22,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  trialText: { color: "#5434B6", fontSize: 12, fontWeight: "800" },
  languageCard: {
    alignItems: "center",
    backgroundColor: "white",
    borderColor: "#E3DCEB",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 22,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  language: { color: "#302738", fontSize: 15, fontWeight: "900" },
  mic: {
    alignItems: "center",
    borderRadius: 48,
    height: 96,
    justifyContent: "center",
    marginTop: 25,
    width: 96,
  },
  instruction: {
    color: "#554C5D",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 15,
  },
  primaryButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#5B38D2",
    borderRadius: 14,
    marginTop: 26,
    paddingVertical: 16,
  },
  primaryButtonText: { color: "white", fontSize: 15, fontWeight: "900" },
  textButton: { marginTop: 19, padding: 8 },
  textButtonLabel: { color: "#5B38D2", fontSize: 13, fontWeight: "800" },
  smallIcon: {
    alignItems: "center",
    backgroundColor: "#F0EBFF",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    marginBottom: 18,
    width: 56,
  },
  title: {
    color: "#251D2D",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 22,
    textAlign: "center",
  },
  optionCard: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "white",
    borderColor: "#E3DCEB",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 17,
  },
  optionIcon: {
    alignItems: "center",
    backgroundColor: "#F0EBFF",
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  optionCopy: { flex: 1, marginHorizontal: 13 },
  optionTitle: { color: "#302738", fontSize: 16, fontWeight: "900" },
  optionDescription: {
    color: "#786E80",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  description: {
    color: "#6F6577",
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 12,
    maxWidth: 330,
    textAlign: "center",
  },
  startButton: { marginTop: 20 },
});
