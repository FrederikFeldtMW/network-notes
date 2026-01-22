import * as Contacts from "expo-contacts";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { deletePerson, getPersonById, updatePerson, type Person } from "../db/database";
import type { PeopleStackParamList } from "../navigation/PeopleStack";
import AppText from "../ui/components/AppText";
import Divider from "../ui/components/Divider";
import Input from "../ui/components/Input";
import PrimaryActionButton from "../ui/components/PrimaryActionButton";
import Screen from "../ui/components/Screen";
import { colors, spacing } from "../ui/theme";

type EditRoute = RouteProp<PeopleStackParamList, "EditPerson">;

type EditNav = NativeStackNavigationProp<PeopleStackParamList, "EditPerson">;

export default function EditPersonScreen() {
  const route = useRoute<EditRoute>();
  const navigation = useNavigation<EditNav>();
  const { personId } = route.params;
  const [person, setPerson] = useState<Person | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [tags, setTags] = useState("");
  const [importance, setImportance] = useState("3");
  const [isSaving, setIsSaving] = useState(false);
  const [isMissing, setIsMissing] = useState(false);
  const [contactMessage, setContactMessage] = useState<string | null>(null);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [contactPhoneInput, setContactPhoneInput] = useState("");

  const loadPerson = useCallback(async () => {
    const personRow = await getPersonById(personId);
    if (!personRow) {
      setPerson(null);
      setIsMissing(true);
      return;
    }
    setPerson(personRow);
    setName(personRow.name);
    setCity(personRow.city ?? "");
    setTags(personRow.tags ?? "");
    setImportance(String(personRow.importance));
    setContactPhoneInput(personRow.phoneNumber ?? "");
    setIsMissing(false);
  }, [personId]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      loadPerson().catch((error: unknown) => {
        if (isActive) {
          console.error("Failed to load person", error);
        }
      });
      return () => {
        isActive = false;
      };
    }, [loadPerson])
  );

  const ensureContactsPermission = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== Contacts.PermissionStatus.GRANTED) {
      setContactMessage("Contacts permission denied.");
      return false;
    }
    return true;
  };

  const linkExistingContact = async () => {
    setContactMessage(null);
    const allowed = await ensureContactsPermission();
    if (!allowed) {
      return;
    }
    const contact = await Contacts.presentContactPickerAsync();
    if (!contact) {
      return;
    }
    const phone = contact.phoneNumbers?.[0]?.number ?? null;
    await updatePerson(personId, {
      phoneContactId: contact.id,
      phoneNumber: phone,
      preferredChannel: phone ? "sms" : null,
    });
    await loadPerson();
  };

  const createPhoneContact = async () => {
    if (!person) {
      return;
    }
    const number = contactPhoneInput.trim();
    if (!number) {
      Alert.alert("Phone number required", "Please enter a phone number.");
      return;
    }
    setContactMessage(null);
    const allowed = await ensureContactsPermission();
    if (!allowed) {
      return;
    }
    const contactId = await Contacts.addContactAsync({
      [Contacts.Fields.FirstName]: person.name,
      [Contacts.Fields.PhoneNumbers]: [{ label: "mobile", number }],
    });
    await updatePerson(personId, {
      phoneContactId: contactId,
      phoneNumber: number,
      preferredChannel: "sms",
    });
    setShowCreateContact(false);
    await loadPerson();
  };

  const unlinkContact = async () => {
    await updatePerson(personId, {
      phoneContactId: null,
      phoneNumber: null,
      preferredChannel: null,
    });
    setContactPhoneInput("");
    await loadPerson();
  };

  const savePerson = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Please enter a name.");
      return;
    }
    const parsedImportance = Number.parseInt(importance, 10);
    const safeImportance = Number.isNaN(parsedImportance)
      ? 3
      : Math.min(5, Math.max(1, parsedImportance));

    setIsSaving(true);
    try {
      await updatePerson(personId, {
        name: trimmedName,
        city: city.trim() ? city : null,
        tags: tags.trim() ? tags : null,
        importance: safeImportance,
      });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to update person", error);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete this person?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deletePerson(personId);
          navigation.reset({ index: 0, routes: [{ name: "PeopleList" }] });
        },
      },
    ]);
  };

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
      <AppText variant="title" style={{ marginBottom: spacing.lg }}>
        Edit Person
      </AppText>

      <Input label="Name" value={name} onChangeText={setName} placeholder="Required" />
      <Input label="City" value={city} onChangeText={setCity} placeholder="Optional" />
      <Input label="Tags" value={tags} onChangeText={setTags} placeholder="Optional" />
      <Input
        label="Importance (1-5)"
        value={importance}
        onChangeText={setImportance}
        keyboardType="number-pad"
        placeholder="3"
      />

      <View style={{ marginTop: spacing.lg }}>
        <AppText variant="subtitle">Phone Contact</AppText>
        <Divider />
        {!!person?.phoneNumber && (
          <AppText variant="muted" style={{ marginTop: spacing.xs }}>
            Linked: {person.phoneNumber}
          </AppText>
        )}
        {contactMessage && (
          <AppText variant="muted" style={{ marginTop: spacing.xs }}>
            {contactMessage}
          </AppText>
        )}
        <View style={styles.inlineButtons}>
          <PrimaryActionButton title="Link existing" onPress={linkExistingContact} />
          <View style={{ marginTop: spacing.sm }}>
            <PrimaryActionButton
              title={showCreateContact ? "Hide create" : "Create contact"}
              onPress={() => setShowCreateContact((prev) => !prev)}
            />
          </View>
        </View>
        {showCreateContact && (
          <View style={{ marginTop: spacing.sm }}>
            <Input
              value={contactPhoneInput}
              onChangeText={setContactPhoneInput}
              placeholder="Phone number"
              keyboardType="phone-pad"
            />
            <PrimaryActionButton title="Save contact" onPress={createPhoneContact} />
          </View>
        )}
        {person?.phoneContactId && (
          <View style={{ marginTop: spacing.sm }}>
            <PrimaryActionButton title="Unlink" onPress={unlinkContact} />
          </View>
        )}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <PrimaryActionButton title={isSaving ? "Saving…" : "Save changes"} loading={isSaving} onPress={savePerson} />
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <Pressable onPress={confirmDelete} style={styles.deletePressable}>
          <AppText variant="caption" style={styles.deleteText}>Delete person</AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  inlineButtons: {
    marginTop: spacing.sm,
  },
  deletePressable: {
    paddingVertical: spacing.sm,
  },
  deleteText: {
    color: colors.danger,
  },
});