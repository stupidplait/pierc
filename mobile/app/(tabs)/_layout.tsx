import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { TABS } from "@/constants/config";

const PRIMARY = "#fe017e";
const INACTIVE = "#888888";

/**
 * Bottom tab nav. Each tab loads a different URL inside the WebView.
 * The 4 tabs match the studio's primary public surfaces:
 *   • Главная — landing/storytelling
 *   • Каталог — 3D try-on (or lite mode on low-WebGL devices)
 *   • Запись  — booking flow
 *   • Профиль — account
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          borderTopColor: "#e5e5e5",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: TABS.home.title,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TABS.home.icon} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: TABS.catalog.title,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TABS.catalog.icon} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: TABS.book.title,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TABS.book.icon} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: TABS.account.title,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TABS.account.icon} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
