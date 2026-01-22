import { PropsWithChildren } from "react";
import { StyleSheet, Text, TextProps } from "react-native";
import { colors, typography } from "../theme";

type Variant = "title" | "subtitle" | "body" | "caption" | "muted";

type AppTextProps = PropsWithChildren<TextProps & { variant?: Variant }>;

export default function AppText({ variant = "body", style, children, ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[styles.base, styles[variant], style]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text },
  title: typography.title,
  subtitle: typography.subtitle,
  body: typography.body,
  caption: typography.caption,
  muted: { ...typography.caption, color: colors.muted },
});