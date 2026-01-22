import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { colors, radii } from "../theme";

type IconButtonProps = {
  name: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  size?: number;
  color?: string;
  style?: ViewStyle;
  variant?: "plain" | "filled";
};

export default function IconButton({
  name,
  onPress,
  size = 20,
  color = colors.text,
  style,
  variant = "plain",
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "filled" && styles.filled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
  },
  filled: {
    backgroundColor: colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
});