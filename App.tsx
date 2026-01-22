import { NavigationContainer } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { init } from "./src/db/database";
import Tabs from "./src/navigation/Tabs";

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    init()
      .then(() => {
        if (isMounted) {
          setIsReady(true);
        }
      })
      .catch((error: unknown) => {
        console.error("DB init failed", error);
        if (isMounted) {
          setInitError("Failed to initialize local database.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 12, color: "#111111" }}>
            {initError ?? "Loading..."}
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tabs />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}