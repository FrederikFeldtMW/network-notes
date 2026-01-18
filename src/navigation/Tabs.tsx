import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import TodayScreen from "../screens/TodayScreen";
import PeopleScreen from "../screens/PeopleScreen";
import MapScreen from "../screens/MapScreen";

export type TabsParamList = {
  Today: undefined;
  People: undefined;
  Map: undefined;
};

const Tab = createBottomTabNavigator<TabsParamList>();

export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e5e5ea",
          borderTopWidth: 1,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
        tabBarActiveTintColor: "#007aff",
        tabBarInactiveTintColor: "#8e8e93",
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="People" component={PeopleScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
    </Tab.Navigator>
  );
}
