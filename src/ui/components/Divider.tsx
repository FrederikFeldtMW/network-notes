import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

type DividerProps = {
  inset?: number;
};

export default function Divider({ inset = 0 }: DividerProps) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
});