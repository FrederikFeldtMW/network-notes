import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "city_context";

export async function getCityContext() {
  const stored = await AsyncStorage.getItem(KEY);
  if (!stored || stored === "All") {
    return "All";
  }
  return stored;
}

export async function setCityContext(city: string | null) {
  if (!city || city === "All") {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await AsyncStorage.setItem(KEY, city);
}