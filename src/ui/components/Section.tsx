import { StyleSheet, View } from "react-native";
import AppText from "./AppText";
import { spacing } from "../theme";

type SectionProps = {
  title: string;
  actionLabel?: string;
  onPressAction?: () => void;
};

export default function Section({ title, actionLabel }: SectionProps) {
  return (
    <View style={styles.container}>
      <AppText variant="subtitle">{title}</AppText>
      {actionLabel ? <AppText variant="caption">{actionLabel}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
});