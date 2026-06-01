import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/constants/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Не найдено" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Эта страница не найдена.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Вернуться на главную</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: theme.bg,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.ink,
  },
  link: {
    marginTop: 16,
    paddingVertical: 12,
  },
  linkText: {
    color: theme.accent,
    fontWeight: "500",
  },
});
