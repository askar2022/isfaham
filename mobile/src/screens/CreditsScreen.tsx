import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
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
  CreditBalance,
  CreditPackage,
  getCreditBalance,
} from "../lib/credits";
import {
  getStoreCreditProducts,
  isCancelledPurchase,
  logOutPurchases,
  purchaseStoreCredits,
  type StoreCreditProduct,
} from "../lib/iap";
import { supabase } from "../lib/supabase";

const STORE_PRODUCT_BY_PACKAGE: Record<string, string> = {
  starter: "isfaham_1_hour",
  standard: "isfaham_5_hours",
  premium: "isfaham_10_hours",
};

function formatBalance(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function CreditsScreen({
  onClose,
  onRemote,
  session,
}: {
  onClose: () => void;
  onRemote: () => void;
  session: Session | null;
}) {
  if (!session || session.user.is_anonymous) {
    return <IndividualSignIn onClose={onClose} session={session} />;
  }
  return (
    <CreditWallet onClose={onClose} onRemote={onRemote} session={session} />
  );
}

function CreditWallet({
  onClose,
  onRemote,
  session,
}: {
  onClose: () => void;
  onRemote: () => void;
  session: Session;
}) {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [storeProducts, setStoreProducts] = useState<StoreCreditProduct[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await getCreditBalance(session.access_token);
      setBalance(next);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Translation balance is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, [session.access_token]);

  useEffect(() => {
    const firstLoad = setTimeout(() => void refresh(), 0);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      clearTimeout(firstLoad);
      listener.remove();
    };
  }, [refresh]);

  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    let active = true;
    void getStoreCreditProducts(session.user.id)
      .then((products) => {
        if (active) setStoreProducts(products);
      })
      .catch((productError) => {
        if (active) {
          setError(
            productError instanceof Error
              ? productError.message
              : "In-app purchases are unavailable.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [session.user.id]);

  async function waitForPurchasedCredits(previousBalance: number) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      const next = await getCreditBalance(session.access_token);
      setBalance(next);
      if (next.balanceSeconds > previousBalance) return true;
    }
    return false;
  }

  async function buy(creditPackage: CreditPackage) {
    setBuying(creditPackage.id);
    setError("");
    try {
      const productId = STORE_PRODUCT_BY_PACKAGE[creditPackage.id];
      const product = storeProducts.find(
        (candidate) => candidate.identifier === productId,
      );
      if (!product) {
        throw new Error(
          Platform.OS === "ios"
            ? "This Apple purchase is unavailable."
            : "This Google Play purchase is unavailable.",
        );
      }

      await purchaseStoreCredits(session.user.id, product);
      const updated = await waitForPurchasedCredits(
        balance?.balanceSeconds ?? 0,
      );
      if (!updated) {
        Alert.alert(
          "Purchase confirmed",
          `${
            Platform.OS === "ios" ? "Apple" : "Google Play"
          } confirmed your purchase. Your balance will update shortly.`,
        );
      }
    } catch (checkoutError) {
      if (isCancelledPurchase(checkoutError)) return;
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Checkout is unavailable.",
      );
    } finally {
      setBuying(null);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.headerButton}>
          <Ionicons color="#50465C" name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Translation Credits</Text>
        <Pressable onPress={() => void refresh()} style={styles.headerButton}>
          <Ionicons color="#5B38D2" name="refresh" size={20} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#5B38D2" size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceIcon}>
              <Ionicons color="#FFFFFF" name="time" size={27} />
            </View>
            <Text style={styles.balanceLabel}>
              {balance?.schoolFunded
                ? "School-funded access"
                : "Translation balance"}
            </Text>
            <Text style={styles.balanceValue}>
              {balance?.schoolFunded
                ? "Included"
                : formatBalance(balance?.balanceSeconds ?? 0)}
            </Text>
            <Text style={styles.balanceHint}>
              Credits count only processed speech—not idle time.
            </Text>
          </View>

          {!balance?.schoolFunded && (
            <Pressable onPress={onRemote} style={styles.remoteCard}>
              <View style={styles.remoteIcon}>
                <Ionicons color="#5B38D2" name="link" size={22} />
              </View>
              <View style={styles.remoteCopy}>
                <Text style={styles.remoteTitle}>Invite another phone</Text>
                <Text style={styles.remoteDescription}>
                  Your guest joins free. Translation time uses your balance.
                </Text>
              </View>
              <Ionicons color="#8A7D96" name="chevron-forward" size={20} />
            </Pressable>
          )}

          {!balance?.schoolFunded && (
            <>
              <Text style={styles.sectionTitle}>Reload credits</Text>
              <Text style={styles.sectionDescription}>
                {Platform.OS === "ios"
                  ? "Purchase securely with your Apple ID. Apple displays the price for your region."
                  : "Purchase securely with Google Play. Google displays the price for your region."}
              </Text>
              <View style={styles.packages}>
                {balance?.packages.map((creditPackage) => (
                  (() => {
                    const storeProduct = storeProducts.find(
                      (product) =>
                        product.identifier ===
                        STORE_PRODUCT_BY_PACKAGE[creditPackage.id],
                    );
                    const unavailable = !storeProduct;
                    return (
                  <Pressable
                    disabled={Boolean(buying) || unavailable}
                    key={creditPackage.id}
                    onPress={() => void buy(creditPackage)}
                    style={({ pressed }) => [
                      styles.packageCard,
                      unavailable && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View>
                      <Text style={styles.packageName}>
                        {creditPackage.name}
                      </Text>
                      <Text style={styles.packageHours}>
                        {creditPackage.hours}{" "}
                        {creditPackage.hours === 1 ? "hour" : "hours"}
                      </Text>
                    </View>
                    {buying === creditPackage.id ? (
                      <ActivityIndicator color="#5B38D2" />
                    ) : (
                      <Text style={styles.packagePrice}>
                        {storeProduct?.priceString ?? "Unavailable"}
                      </Text>
                    )}
                  </Pressable>
                    );
                  })()
                ))}
              </View>
              <Text style={styles.disclosure}>
                {Platform.OS === "ios"
                  ? "Payment is charged to your Apple ID. Translation Credits are consumable and can be purchased again."
                  : "Payment is charged through Google Play. Translation Credits are consumable and can be purchased again."}
              </Text>
            </>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            onPress={() =>
              void logOutPurchases()
                .catch(() => undefined)
                .then(() => supabase?.auth.signOut())
            }
          >
            <Text style={styles.signOut}>
              Sign out{session.user.email ? ` • ${session.user.email}` : ""}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function IndividualSignIn({
  onClose,
  session,
}: {
  onClose: () => void;
  session: Session | null;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const emailInputRef = useRef<TextInput>(null);
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function sendCode() {
    if (!supabase) {
      setError("Individual accounts are not configured.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error: sendError } = session?.user.is_anonymous
        ? await supabase.auth.updateUser({ email: normalizedEmail })
        : await supabase.auth.signInWithOtp({
            email: normalizedEmail,
            options: { shouldCreateUser: true },
          });
      if (sendError) throw sendError;
      setCodeSent(true);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "We could not send your code.",
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
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: session?.user.is_anonymous ? "email_change" : "email",
      });
      if (verifyError) throw new Error("That code is incorrect or has expired.");
      onClose();
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.headerButton}>
          <Ionicons color="#50465C" name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Personal Account</Text>
        <View style={styles.headerButton} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.centered}
      >
        <View style={styles.accountCard}>
          <View style={styles.accountIcon}>
            <Ionicons color="#5B38D2" name="person" size={27} />
          </View>
          <Text style={styles.accountTitle}>
            {codeSent
              ? "Check Your Email"
              : "Create Your Free Account"}
          </Text>
          <Text style={styles.accountDescription}>
            {codeSent
              ? `Enter the six-digit code sent to ${email}.`
              : "Create an account to save your translation minutes and continue translating on any device."}
          </Text>
          {!codeSent && (
            <View style={styles.accountBenefits}>
              {[
                "Save your translation minutes",
                "Use Isfaham on all your devices",
                "Buy more translation minutes anytime",
                "Secure sign-in",
              ].map((benefit) => (
                <View key={benefit} style={styles.accountBenefit}>
                  <Ionicons
                    color="#198462"
                    name="checkmark-circle"
                    size={17}
                  />
                  <Text style={styles.accountBenefitText}>{benefit}</Text>
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
            placeholder="name@example.com"
            ref={emailInputRef}
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
          <Pressable
            disabled={busy || (codeSent ? code.length !== 6 : !emailIsValid)}
            onPress={() => void (codeSent ? verifyCode() : sendCode())}
            style={[
              styles.accountButton,
              (busy || (codeSent ? code.length !== 6 : !emailIsValid)) &&
                styles.accountButtonDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.accountButtonText}>
                {codeSent ? "Verify and continue" : "Continue"}
              </Text>
            )}
          </Pressable>
          {codeSent && (
            <Pressable
              onPress={() => {
                setCodeSent(false);
                setCode("");
                setError("");
              }}
            >
              <Text style={styles.changeEmail}>Use a different email</Text>
            </Pressable>
          )}
          {!codeSent && (
            <Pressable
              onPress={() => emailInputRef.current?.focus()}
              style={styles.existingAccount}
            >
              <Text style={styles.existingAccountText}>
                Already have an account?{" "}
                <Text style={styles.existingAccountLink}>Sign In</Text>
              </Text>
            </Pressable>
          )}
          {!codeSent && (
            <View style={styles.accountTrust}>
              <Ionicons color="#6E6577" name="lock-closed" size={13} />
              <Text style={styles.accountTrustText}>
                Secure sign-in with a one-time verification code
              </Text>
            </View>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    flex: 1,
    justifyContent: "center",
    paddingBottom: 110,
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  content: { padding: 20, paddingBottom: 44 },
  balanceCard: {
    alignItems: "center",
    backgroundColor: "#5B38D2",
    borderRadius: 24,
    padding: 26,
  },
  balanceIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    marginBottom: 12,
    width: 48,
  },
  balanceLabel: {
    color: "#DED5FF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  balanceValue: {
    color: "white",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 5,
  },
  balanceHint: {
    color: "#DED5FF",
    fontSize: 10,
    marginTop: 7,
    textAlign: "center",
  },
  remoteCard: {
    alignItems: "center",
    backgroundColor: "white",
    borderColor: "#E3DEE8",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 14,
    padding: 15,
  },
  remoteIcon: {
    alignItems: "center",
    backgroundColor: "#F0EBFF",
    borderRadius: 13,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  remoteCopy: { flex: 1, marginHorizontal: 12 },
  remoteTitle: { color: "#2A2330", fontSize: 14, fontWeight: "900" },
  remoteDescription: {
    color: "#837B89",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
  sectionTitle: {
    color: "#28202F",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 28,
  },
  sectionDescription: {
    color: "#776F7E",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 17,
    marginTop: 6,
  },
  packages: { gap: 10 },
  packageCard: {
    alignItems: "center",
    backgroundColor: "white",
    borderColor: "#E3DEE8",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  packageName: { color: "#2A2330", fontSize: 14, fontWeight: "900" },
  packageHours: { color: "#837B89", fontSize: 10, marginTop: 3 },
  packagePrice: { color: "#5B38D2", fontSize: 17, fontWeight: "900" },
  disclosure: {
    color: "#948C9A",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 17,
    textAlign: "center",
  },
  error: {
    color: "#B62956",
    fontSize: 12,
    marginTop: 16,
    textAlign: "center",
  },
  accountCard: {
    alignSelf: "stretch",
    backgroundColor: "white",
    borderColor: "#E9E4ED",
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
  },
  accountIcon: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#F1EDFF",
    borderRadius: 25,
    height: 50,
    justifyContent: "center",
    marginBottom: 14,
    width: 50,
  },
  accountTitle: {
    color: "#282230",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  accountDescription: {
    color: "#766B80",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 24,
    marginTop: 8,
    textAlign: "center",
  },
  accountBenefits: {
    alignSelf: "stretch",
    gap: 9,
    marginBottom: 18,
  },
  accountBenefit: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  accountBenefitText: {
    color: "#554C5C",
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#FBFAFC",
    borderColor: "#DED8E5",
    borderRadius: 13,
    borderWidth: 1,
    color: "#282230",
    fontSize: 15,
    marginBottom: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  codeInput: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
  },
  accountButton: {
    alignItems: "center",
    backgroundColor: "#5B38D2",
    borderRadius: 13,
    justifyContent: "center",
    minHeight: 50,
  },
  accountButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
  },
  accountButtonDisabled: {
    backgroundColor: "#CFCAD4",
  },
  existingAccount: {
    alignItems: "center",
    marginTop: 13,
  },
  existingAccountText: {
    color: "#746C7B",
    fontSize: 10,
    fontWeight: "600",
  },
  existingAccountLink: {
    color: "#5B38D2",
    fontWeight: "900",
  },
  accountTrust: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginTop: 10,
  },
  accountTrustText: {
    color: "#746C7B",
    fontSize: 9,
    fontWeight: "600",
  },
  disabled: { opacity: 0.45 },
  changeEmail: {
    color: "#5B38D2",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 16,
    textAlign: "center",
  },
  signOut: {
    color: "#796F81",
    fontSize: 12,
    marginTop: 24,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
