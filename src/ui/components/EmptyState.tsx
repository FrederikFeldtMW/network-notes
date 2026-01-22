import { StyleSheet, View } from "react-native";
import AppText from "./AppText";
import Button from "./Button";
import PrimaryActionButton from "./PrimaryActionButton";
import { colors, spacing } from "../theme";

type EmptyStateProps = {
  emoji?: string;
  title: string;
  subtitle: string;
  primaryAction?: { title: string; onPress: () => void };
  secondaryAction?: { title: string; onPress: () => void };
};

export default function EmptyState({
  emoji = "✨",
  title,
  subtitle,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <AppText variant="title" style={styles.emoji}>
        {emoji}
      </AppText>
      <AppText variant="subtitle" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="body" style={styles.subtitle}>
        {subtitle}
      </AppText>
      {primaryAction && (
        <View style={styles.button}>
          <PrimaryActionButton title={primaryAction.title} onPress={primaryAction.onPress} />
        </View>
      )}
      {secondaryAction && (
        <View style={styles.button}>
          <Button title={secondaryAction.title} variant="ghost" onPress={secondaryAction.onPress} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: colors.muted,
  },
  button: {
    alignSelf: "stretch",
    marginTop: spacing.md,
  },
});