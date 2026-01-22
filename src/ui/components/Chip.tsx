import { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../theme";

type ChipProps = PropsWithChildren;

export default function Chip({ children }: ChipProps) {
  return (
    <View style={styles.chip}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  text: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "500",
  },
});