import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { colors, radii } from "../theme";

type CardProps = PropsWithChildren<ViewProps>;

export default function Card({ style, children, ...rest }: CardProps) {
  return (
    <View {...rest} style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
});