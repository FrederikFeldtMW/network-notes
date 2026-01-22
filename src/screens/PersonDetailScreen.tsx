import * as Contacts from "expo-contacts";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addNote,
  getNotesForPerson,
  getPersonById,
  updatePersonLastInteraction,
  type Note,
  type Person,
} from "../db/database";
import type { PeopleStackParamList } from "../navigation/PeopleStack";
import { getCurrentLocation } from "../utils/location";
import AppText from "../ui/components/AppText";
import Divider from "../ui/components/Divider";
import IconButton from "../ui/components/IconButton";
import Input from "../ui/components/Input";
import Pill from "../ui/components/Pill";
import PrimaryActionButton from "../ui/components/PrimaryActionButton";
import Screen from "../ui/components/Screen";
import { colors, spacing } from "../ui/theme";

type PersonDetailRoute = RouteProp<PeopleStackParamList, "PersonDetail">;

type PersonDetailNav = NativeStackNavigationProp<
  PeopleStackParamList,
  "PersonDetail"
>;

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

function InlineOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.inlineOption, active && styles.inlineOptionActive, pressed && styles.inlinePressed]}
    >
      <AppText variant="caption" style={[styles.inlineText, active && styles.inlineTextActive]}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function PersonDetailScreen() {
  const route = useRoute<PersonDetailRoute>();
  const navigation = useNavigation<PersonDetailNav>();
  const insets = useSafeAreaInsets();
  const { personId } = route.params;
  const [person, setPerson] = useState<Person | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpPreset, setFollowUpPreset] = useState<
    "tomorrow" | "3d" | "1w" | "pick" | null
  >(null);
  const [followUpDateInput, setFollowUpDateInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMissing, setIsMissing] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton name="create-outline" onPress={() => navigation.navigate("EditPerson", { personId })} />
      ),
    });
  }, [navigation, personId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [personRow, noteRows] = await Promise.all([
      getPersonById(personId),
      getNotesForPerson(personId),
    ]);
    if (!personRow) {
      setPerson(null);
      setNotes([]);
      setIsMissing(true);
      setIsLoading(false);
      return;
    }
    setPerson(personRow);
    setNotes(noteRows);
    setIsMissing(false);
    setIsLoading(false);
  }, [personId]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      loadData().catch((error: unknown) => {
        if (isActive) {
          console.error("Failed to load person detail", error);
          setIsLoading(false);
        }
      });
      return () => {
        isActive = false;
      };
    }, [loadData])
  );

  useEffect(() => {
    let isActive = true;
    if (!person?.phoneContactId) {
      setAvatarUri(null);
      return () => {
        isActive = false;
      };
    }
    (async () => {
      const permission = await Contacts.getPermissionsAsync();
      if (permission.status !== Contacts.PermissionStatus.GRANTED) {
        if (isActive) {
          setAvatarUri(null);
        }
        return;
      }
      const contact = await Contacts.getContactByIdAsync(person.phoneContactId, [
        Contacts.Fields.Image,
      ]);
      const uri =
        contact?.imageAvailable && contact.image?.uri
          ? contact.image.uri
          : null;
      if (isActive) {
        setAvatarUri(uri);
      }
    })().catch((error) => {
      if (isActive) {
        console.error("Failed to load contact avatar", error);
        setAvatarUri(null);
      }
    });
    return () => {
      isActive = false;
    };
  }, [person?.phoneContactId]);

  const followUpAt = useMemo(() => {
    if (!followUpEnabled || !followUpPreset) {
      return null;
    }
    const now = new Date();
    if (followUpPreset === "tomorrow") {
      now.setDate(now.getDate() + 1);
      return now.toISOString();
    }
    if (followUpPreset === "3d") {
      now.setDate(now.getDate() + 3);
      return now.toISOString();
    }
    if (followUpPreset === "1w") {
      now.setDate(now.getDate() + 7);
      return now.toISOString();
    }
    if (followUpPreset === "pick") {
      const trimmed = followUpDateInput.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }
      return parsed.toISOString();
    }
    return null;
  }, [followUpEnabled, followUpPreset, followUpDateInput]);

  const saveNote = async () => {
    const trimmed = noteContent.trim();
    if (!trimmed) {
      Alert.alert("Note required", "Please enter a note.");
      return;
    }
    if (followUpEnabled && !followUpAt) {
      Alert.alert("Follow-up date required", "Choose a follow-up date.");
      return;
    }

    setIsSaving(true);
    try {
      const location = await getCurrentLocation();
      const now = new Date().toISOString();

      await addNote({
        personId,
        content: trimmed,
        needsFollowUp: followUpEnabled ? 1 : 0,
        followUpAt,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        placeLabel: location?.placeLabel ?? null,
      });
      await updatePersonLastInteraction(personId, now);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNoteContent("");
      setFollowUpEnabled(false);
      setFollowUpPreset(null);
      setFollowUpDateInput("");
      await loadData();
    } catch (error) {
      console.error("Failed to save note", error);
      Alert.alert("Save failed", "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const header = (
    <View>
      <View style={styles.headerRow}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <AppText variant="caption" style={{ color: colors.accent }}>
              {getInitials(person?.name ?? "")}
            </AppText>
          </View>
        )}
        <View style={styles.headerMeta}>
          <AppText variant="title">{person?.name ?? "Person"}</AppText>
          <AppText variant="muted">
            {person?.city ?? person?.placeLabel ?? ""}
          </AppText>
        </View>
      </View>
      <View style={styles.pillRow}>
        {!!person?.tags &&
          person.tags.split(",").map((tag) => (
            <Pill key={tag.trim()}>{tag.trim()}</Pill>
          ))}
      </View>
      <View style={{ marginTop: spacing.lg }}>
        <AppText variant="subtitle">Notes</AppText>
      </View>
      <Divider />
    </View>
  );

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <AppText variant="muted">Loading…</AppText>
        </View>
      </Screen>
    );
  }

  if (isMissing) {
    return (
      <Screen>
        <View style={styles.centered}>
          <AppText variant="muted" style={{ marginBottom: spacing.md }}>
            This person no longer exists.
          </AppText>
          <PrimaryActionButton
            title="Back to People"
            onPress={() =>
              navigation.reset({ index: 0, routes: [{ name: "PeopleList" }] })
            }
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 180 }}
          renderItem={({ item, index }) => (
            <View>
              <View style={styles.noteBlock}>
                <AppText variant="body">{item.content}</AppText>
                {!!item.placeLabel && (
                  <AppText variant="muted" style={{ marginTop: 6 }}>
                    {item.placeLabel}
                  </AppText>
                )}
                <AppText variant="muted" style={{ marginTop: 6 }}>
                  {new Date(item.createdAt).toLocaleString()}
                </AppText>
              </View>
              {index < notes.length - 1 && <Divider />}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.noteBlock}>
              <AppText variant="muted">No notes yet.</AppText>
            </View>
          }
        />

        <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
          <Divider />
          <AppText variant="subtitle" style={{ marginTop: spacing.sm }}>
            Add note
          </AppText>
          <Input
            value={noteContent}
            onChangeText={setNoteContent}
            placeholder="Write something…"
            multiline
            style={styles.noteInput}
          />

          <View style={styles.followRow}>
            <AppText variant="caption">Follow up</AppText>
            <View style={styles.inlineRow}>
              <InlineOption
                label={followUpEnabled ? "On" : "Off"}
                active={followUpEnabled}
                onPress={() => {
                  const next = !followUpEnabled;
                  setFollowUpEnabled(next);
                  if (!next) {
                    setFollowUpPreset(null);
                    setFollowUpDateInput("");
                  }
                }}
              />
            </View>
          </View>

          {followUpEnabled && (
            <View style={styles.inlineRow}>
              {[
                { key: "tomorrow", label: "Tomorrow" },
                { key: "3d", label: "3 days" },
                { key: "1w", label: "1 week" },
                { key: "pick", label: "Pick date" },
              ].map((option) => (
                <InlineOption
                  key={option.key}
                  label={option.label}
                  active={followUpPreset === option.key}
                  onPress={() =>
                    setFollowUpPreset(option.key as "tomorrow" | "3d" | "1w" | "pick")
                  }
                />
              ))}
            </View>
          )}

          {followUpPreset === "pick" && (
            <Input
              value={followUpDateInput}
              onChangeText={setFollowUpDateInput}
              placeholder="YYYY-MM-DD"
            />
          )}

          <PrimaryActionButton
            title={isSaving ? "Saving…" : "Save note"}
            loading={isSaving}
            onPress={saveNote}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerMeta: {
    marginLeft: spacing.md,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.sm,
  },
  noteBlock: {
    paddingVertical: spacing.md,
  },
  composer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  noteInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  followRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  inlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  inlineOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  inlineOptionActive: {
    borderColor: colors.accent,
  },
  inlineText: {
    color: colors.text,
  },
  inlineTextActive: {
    color: colors.accent,
  },
  inlinePressed: {
    opacity: 0.7,
  },
});