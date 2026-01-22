import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, View } from "react-native";
import TodayStack from "./TodayStack";
import PeopleStack from "./PeopleStack";
import MapScreen from "../screens/MapScreen";
import { colors } from "../ui/theme";

export type TabsParamList = {
  Today: undefined;
  People: undefined;
  Map: undefined;
};

const Tab = createBottomTabNavigator<TabsParamList>();

export default function Tabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ focused, color }) => {
          const iconName =
            route.name === "Today"
              ? focused
                ? "sparkles"
                : "sparkles-outline"
              : route.name === "People"
              ? focused
                ? "people"
                : "people-outline"
              : focused
              ? "map"
              : "map-outline";
          return (
            <View style={styles.iconWrap}>
              <Ionicons name={iconName} size={24} color={color} />
              {focused && <View style={styles.activeDot} />}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Today" component={TodayStack} />
      <Tab.Screen name="People" component={PeopleStack} />
      <Tab.Screen name="Map" component={MapScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
});