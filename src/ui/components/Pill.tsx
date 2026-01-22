import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import AppText from "./AppText";
import { colors, radii, spacing } from "../theme";

type PillProps = PropsWithChildren;

export default function Pill({ children }: PillProps) {
  return (
    <View style={styles.pill}>
      <AppText variant="caption" style={styles.text}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  text: {
    color: colors.accent,
  },
});