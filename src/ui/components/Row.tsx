import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import AppText from "./AppText";
import { colors, spacing } from "../theme";

type RowProps = PropsWithChildren<{
  title: string;
  subtitle?: string | null;
  onPress?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle;
}>;

export default function Row({ title, subtitle, onPress, left, right, style, children }: RowProps) {
  const content = (
    <View style={[styles.row, style]}>
      {left && <View style={styles.left}>{left}</View>}
      <View style={styles.center}>
        <AppText variant="body" style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="muted" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
        {children}
      </View>
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  left: {
    marginRight: spacing.md,
  },
  center: {
    flex: 1,
  },
  right: {
    marginLeft: spacing.md,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  title: {
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
  },
  pressed: {
    opacity: 0.6,
  },
});