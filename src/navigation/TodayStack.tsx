import { createNativeStackNavigator } from "@react-navigation/native-stack";
import QuickAddPersonScreen from "../screens/QuickAddPersonScreen";
import SettingsScreen from "../screens/SettingsScreen";
import TodayScreen from "../screens/TodayScreen";
import TripDetailScreen from "../screens/TripDetailScreen";
import TripsScreen from "../screens/TripsScreen";

export type TodayStackParamList = {
  TodayHome: undefined;
  Trips: undefined;
  TripDetail: { tripId: string };
  QuickAdd: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<TodayStackParamList>();

export default function TodayStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleStyle: { fontSize: 17, fontWeight: "600" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="TodayHome"
        component={TodayScreen}
        options={{ title: "Today" }}
      />
      <Stack.Screen
        name="Trips"
        component={TripsScreen}
        options={{ title: "Trips" }}
      />
      <Stack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: "Edit Trip" }}
      />
      <Stack.Screen
        name="QuickAdd"
        component={QuickAddPersonScreen}
        options={{ title: "Quick Add" }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
    </Stack.Navigator>
  );
}