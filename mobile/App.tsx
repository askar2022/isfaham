import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { supabase } from "./src/lib/supabase";
import { MessageHistory } from "./src/screens/MessageHistory";
import { SchoolMessenger } from "./src/screens/SchoolMessenger";

// Personal/two-way translate UI is preserved in App.legacy.tsx and related
// screens (CreditsScreen, ConsumerRemote, WelcomeFlow) for later restore.

type AppTab = "message" | "history" | "account";

function BottomNavigation({
  active,
  onSelect,
}: {
  active: AppTab;
  onSelect: (tab: AppTab) => void;
}) {
  const tabs: Array<{
    id: AppTab;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { id: "message", label: "New Message", icon: "mic" },
    { id: "history", label: "History", icon: "time-outline" },
    { id: "account", label: "Account", icon: "person-outline" },
  ];

  return (
    <SafeAreaView edges={["bottom"]} style={styles.navSafe}>
      <View style={styles.nav}>
        {tabs.map((tab) => {
          const selected = active === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => onSelect(tab.id)}
              style={styles.navItem}
            >
              <Ionicons
                color={selected ? "#5B38D2" : "#9B93A8"}
                name={tab.icon}
                size={22}
              />
              <Text style={[styles.navLabel, selected && styles.navLabelActive]}>
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
  session,
  onSignedOut,
}: {
  session: Session | null;
  onSignedOut: () => void;
}) {
  return (
    <SafeAreaView style={styles.accountSafe} edges={["top"]}>
      <Text style={styles.accountTitle}>Account</Text>
      <Text style={styles.accountCopy}>
        Isfaham is currently focused on school-to-family Somali voice messages.
        Staff sign in with an authorized school email.
      </Text>
      <Text style={styles.accountMeta}>
        {session && !session.user.is_anonymous
          ? session.user.email || "Signed in"
          : "Not signed in"}
      </Text>
      {session && !session.user.is_anonymous ? (
        <Pressable
          onPress={() => {
            void supabase?.auth.signOut().then(() => onSignedOut());
          }}
          style={styles.signOut}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      ) : (
        <Text style={styles.accountHint}>
          Tap the microphone on New Message to sign in when you are ready to
          record.
        </Text>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  const [tab, setTab] = useState<AppTab>("message");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_, next) => {
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {tab === "message" ? <SchoolMessenger /> : null}
        {tab === "history" ? <MessageHistory /> : null}
        {tab === "account" ? (
          <AccountScreen
            onSignedOut={() => setSession(null)}
            session={session}
          />
        ) : null}
        <BottomNavigation active={tab} onSelect={setTab} />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#FAF9FD", flex: 1 },
  navSafe: {
    backgroundColor: "#fff",
    borderTopColor: "#EDE8F5",
    borderTopWidth: 1,
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingBottom: 4,
    paddingTop: 8,
  },
  navItem: { alignItems: "center", minWidth: 96, paddingVertical: 4 },
  navLabel: {
    color: "#9B93A8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  navLabelActive: { color: "#5B38D2" },
  accountSafe: { flex: 1, paddingHorizontal: 22, paddingTop: 18 },
  accountTitle: {
    color: "#2C2140",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 10,
  },
  accountCopy: {
    color: "#7C748A",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  accountMeta: {
    color: "#2C2140",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  accountHint: { color: "#7C748A", lineHeight: 20 },
  signOut: {
    alignSelf: "flex-start",
    backgroundColor: "#5B38D2",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  signOutText: { color: "#fff", fontWeight: "800" },
});
