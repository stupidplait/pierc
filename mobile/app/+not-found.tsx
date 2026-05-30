import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

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
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  link: {
    marginTop: 16,
    paddingVertical: 12,
  },
  linkText: {
    color: "#fe017e",
    fontWeight: "500",
  },
});
