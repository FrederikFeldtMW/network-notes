import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { createPerson, updatePersonPlaceLabel } from "../db/database";
import type { PeopleStackParamList } from "../navigation/PeopleStack";
import { getCurrentLocationWithPlaceLabel } from "../utils/location";
import AppText from "../ui/components/AppText";
import Divider from "../ui/components/Divider";
import Input from "../ui/components/Input";
import PrimaryActionButton from "../ui/components/PrimaryActionButton";
import Screen from "../ui/components/Screen";
import { colors, spacing } from "../ui/theme";

type AddPersonNav = NativeStackNavigationProp<
  PeopleStackParamList,
  "AddPerson"
>;

export default function AddPersonScreen() {
  const navigation = useNavigation<AddPersonNav>();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [tags, setTags] = useState("");
  const [importance, setImportance] = useState("3");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmLabel, setConfirmLabel] = useState<string | null>(null);
  const confirmResolver = useRef<((value: boolean) => void) | null>(null);

  const confirmPlaceLabel = (label: string) =>
    new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setConfirmLabel(label);
    });

  const savePerson = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    const parsedImportance = Number.parseInt(importance, 10);
    const safeImportance = Number.isNaN(parsedImportance)
      ? 3
      : Math.min(5, Math.max(1, parsedImportance));

    setIsSaving(true);
    try {
      const location = await getCurrentLocationWithPlaceLabel();
      const candidateLabel = location?.placeLabel;

      const person = await createPerson({
        name: trimmedName,
        city: city.trim() ? city : null,
        tags: tags.trim() ? tags : null,
        importance: safeImportance,
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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to save person", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <AppText variant="title" style={{ marginBottom: spacing.lg }}>
        Add Person
      </AppText>
      <Input label="Name" value={name} onChangeText={setName} placeholder="Required" />
      <Input label="City" value={city} onChangeText={setCity} placeholder="Optional" />
      <Input label="Tags" value={tags} onChangeText={setTags} placeholder="Optional (comma-separated)" />
      <Input
        label="Importance (1-5)"
        value={importance}
        onChangeText={setImportance}
        keyboardType="number-pad"
        placeholder="3"
      />
      <PrimaryActionButton title={isSaving ? "Saving…" : "Save"} loading={isSaving} onPress={savePerson} />

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
            <View style={{ marginTop: spacing.md }}>
              <PrimaryActionButton
                title="Yes"
                onPress={() => {
                  confirmResolver.current?.(true);
                  confirmResolver.current = null;
                  setConfirmLabel(null);
                }}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  confirmSecondary: {
    marginTop: spacing.sm,
    color: colors.muted,
  },
});