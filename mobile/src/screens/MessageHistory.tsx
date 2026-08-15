import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";

import { listVoiceMessages, VoiceMessageHistoryItem } from "../lib/voice-messages";
import { supabase } from "../lib/supabase";

export function MessageHistory() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<VoiceMessageHistoryItem[]>([]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
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

  const load = useCallback(async () => {
    if (!session || session.user.is_anonymous) {
      setMessages([]);
      setLoading(false);
      setError("");
      setInfo("Sign in from New Message to view history.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setInfo("");
      const result = await listVoiceMessages(session.access_token);
      setMessages(result.messages);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load history.",
      );
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Pressable onPress={() => void load()}>
          <Text style={styles.refresh}>Refresh</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color="#5B38D2" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {info ? <Text style={styles.info}>{info}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!error && !info && messages.length === 0 ? (
            <Text style={styles.empty}>No messages yet.</Text>
          ) : null}
          {messages.map((message) => (
            <View key={message.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                Parent •••• {message.parent_phone_last_four}
              </Text>
              <Text style={styles.meta}>
                {new Date(message.created_at).toLocaleString()}
              </Text>
              <Text style={styles.meta}>
                Status: {message.status}
                {message.delivery_status ? ` · SMS ${message.delivery_status}` : ""}
              </Text>
              <Text style={styles.meta}>
                Opened: {message.link_opened_at ? "Yes" : "No"} · Played:{" "}
                {message.audio_played_at ? "Yes" : "No"}
              </Text>
              {message.english_text ? (
                <Text style={styles.body} numberOfLines={3}>
                  {message.english_text}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "#FAF9FD", flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  title: { color: "#2C2140", fontSize: 22, fontWeight: "800" },
  refresh: { color: "#5B38D2", fontSize: 13, fontWeight: "800" },
  content: { padding: 22, paddingBottom: 120 },
  empty: { color: "#7C748A", fontSize: 13, marginTop: 24, textAlign: "center" },
  info: {
    color: "#7C748A",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  error: {
    color: "#B42318",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderColor: "#E4DFEC",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  cardTitle: { color: "#2C2140", fontSize: 14, fontWeight: "800" },
  meta: { color: "#7C748A", fontSize: 12, marginTop: 4 },
  body: { color: "#2C2140", fontSize: 13, marginTop: 10 },
});
