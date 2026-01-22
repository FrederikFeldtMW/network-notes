import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AddPersonScreen from "../screens/AddPersonScreen";
import EditPersonScreen from "../screens/EditPersonScreen";
import PeopleScreen from "../screens/PeopleScreen";
import PersonDetailScreen from "../screens/PersonDetailScreen";
import QuickAddPersonScreen from "../screens/QuickAddPersonScreen";

export type PeopleStackParamList = {
  PeopleList: undefined;
  AddPerson: undefined;
  PersonDetail: { personId: string };
  EditPerson: { personId: string };
  QuickAdd: undefined;
};

const Stack = createNativeStackNavigator<PeopleStackParamList>();

export default function PeopleStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleStyle: { fontSize: 17, fontWeight: "600" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="PeopleList"
        component={PeopleScreen}
        options={{ title: "People" }}
      />
      <Stack.Screen
        name="AddPerson"
        component={AddPersonScreen}
        options={{ title: "Add Person" }}
      />
      <Stack.Screen
        name="QuickAdd"
        component={QuickAddPersonScreen}
        options={{ title: "Quick Add" }}
      />
      <Stack.Screen
        name="PersonDetail"
        component={PersonDetailScreen}
        options={{ title: "Person" }}
      />
      <Stack.Screen
        name="EditPerson"
        component={EditPersonScreen}
        options={{ title: "Edit Person" }}
      />
    </Stack.Navigator>
  );
}