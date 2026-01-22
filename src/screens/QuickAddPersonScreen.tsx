import * as Contacts from "expo-contacts";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addNote,
  createPerson,
  updatePerson,
  updatePersonLastInteraction,
  updatePersonPlaceLabel,
} from "../db/database";
import type { PeopleStackParamList } from "../navigation/PeopleStack";
import { getCurrentLocationWithPlaceLabel } from "../utils/location";
import AppText from "../ui/components/AppText";
import Divider from "../ui/components/Divider";
import IconButton from "../ui/components/IconButton";
import Input from "../ui/components/Input";
import PrimaryActionButton from "../ui/components/PrimaryActionButton";
import Screen from "../ui/components/Screen";
import { colors, spacing } from "../ui/theme";

type QuickAddNav = NativeStackNavigationProp<PeopleStackParamList, "QuickAdd">;

export default function QuickAddPersonScreen() {
  const navigation = useNavigation<QuickAddNav>();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [contactMessage, setContactMessage] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [confirmLabel, setConfirmLabel] = useState<string | null>(null);
  const confirmResolver = useRef<((value: boolean) => void) | null>(null);
  const slideAnim = useRef(new Animated.Value(12)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, opacityAnim]);

  const confirmPlaceLabel = (label: string) =>
    new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setConfirmLabel(label);
    });

  const ensureContactsPermission = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== Contacts.PermissionStatus.GRANTED) {
      setContactMessage("Contacts permission denied.");
      return false;
    }
    return true;
  };

  const createPhoneContact = async (personName: string, number: string) => {
    const allowed = await ensureContactsPermission();
    if (!allowed) {
      return null;
    }
    const contactId = await Contacts.addContactAsync({
      [Contacts.Fields.FirstName]: personName,
      [Contacts.Fields.PhoneNumbers]: [{ label: "mobile", number }],
    });
    return contactId;
  };

  const saveQuickAdd = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setContactMessage("Name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const location = await getCurrentLocationWithPlaceLabel();
      const candidateLabel = location?.placeLabel;

      const person = await createPerson({
        name: trimmedName,
        phoneNumber: phoneNumber.trim() || null,
        preferredChannel: phoneNumber.trim() ? "sms" : null,
        placeLabel: candidateLabel ?? null,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      });

      if (candidateLabel) {
        const confirmed = await confirmPlaceLabel(candidateLabel);
        if (!confirmed) {
          await updatePersonPlaceLabel(person.id, null);
        }
      }

      if (note.trim()) {
        await addNote({
          personId: person.id,
          content: note.trim(),
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
          placeLabel: location?.placeLabel ?? null,
        });
        await updatePersonLastInteraction(person.id, new Date().toISOString());
      }

      if (phoneNumber.trim()) {
        const contactId = await createPhoneContact(
          trimmedName,
          phoneNumber.trim()
        );
        if (contactId) {
          await updatePerson(person.id, {
            phoneContactId: contactId,
            phoneNumber: phoneNumber.trim(),
            preferredChannel: "sms",
          });
        }
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 800);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to quick add", error);
      setContactMessage("Save failed. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: opacityAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.headerRow}>
              <AppText variant="title">Quick Add</AppText>
              <IconButton name="close" onPress={() => navigation.goBack()} />
            </View>
            {contactMessage && (
              <AppText variant="muted" style={{ marginBottom: spacing.sm }}>
                {contactMessage}
              </AppText>
            )}
            <Input label="Name" value={name} onChangeText={setName} placeholder="Required" autoFocus />
            <Input
              label="Note"
              value={note}
              onChangeText={setNote}
              placeholder="Add a short memory"
              multiline
              style={styles.noteInput}
            />
            <Input
              label="Phone"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Optional"
              keyboardType="phone-pad"
            />
          </Animated.View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
          <PrimaryActionButton
            title={isSaving ? "Saving…" : "Save"}
            loading={isSaving}
            onPress={saveQuickAdd}
          />
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={!!confirmLabel}
        transparent
        animationType="fade"
        onRequestClose={() => {
          confirmResolver.current?.(false);
          confirmResolver.current = null;
          setConfirmLabel(null);
        }}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmSheet}>
            <AppText variant="subtitle">Confirm place</AppText>
            <AppText variant="body" style={{ marginTop: spacing.sm }}>
              Did you meet this person at “{confirmLabel}”?
            </AppText>
            <View style={styles.confirmActions}>
              <PrimaryActionButton
                title="Yes"
                onPress={() => {
                  confirmResolver.current?.(true);
                  confirmResolver.current = null;
                  setConfirmLabel(null);
                }}
              />
              <IconButton
                name="close"
                onPress={() => {
                  confirmResolver.current?.(false);
                  confirmResolver.current = null;
                  setConfirmLabel(null);
                }}
                style={styles.confirmClose}
              />
            </View>
            <Divider />
            <Pressable
              onPress={() => {
                confirmResolver.current?.(false);
                confirmResolver.current = null;
                setConfirmLabel(null);
              }}
            >
              <AppText variant="caption" style={styles.confirmSecondary}>
                No, clear the place
              </AppText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {showSaved && (
        <View style={styles.toast}>
          <AppText variant="caption" style={{ color: colors.surface }}>
            Saved
          </AppText>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  noteInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  footer: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  toast: {
    position: "absolute",
    bottom: spacing.xxl,
    alignSelf: "center",
    backgroundColor: "#111111",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  confirmSheet: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  confirmActions: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confirmClose: {
    marginLeft: spacing.sm,
  },
  confirmSecondary: {
    marginTop: spacing.sm,
    color: colors.muted,
  },
});