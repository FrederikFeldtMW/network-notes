import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import TodayScreen from "../screens/TodayScreen";
import PeopleScreen from "../screens/PeopleScreen";
import MapScreen from "../screens/MapScreen";

export type RootTabParamList = {
  Today: undefined;
  People: undefined;
  Map: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        tabBarLabelPosition: "below-icon",
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="People" component={PeopleScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
    </Tab.Navigator>
  );
}
