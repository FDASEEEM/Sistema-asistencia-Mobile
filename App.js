import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { theme } from "./src/theme";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import StudentSummaryScreen from "./src/screens/StudentSummaryScreen";
import AttendanceCalendarScreen from "./src/screens/AttendanceCalendarScreen";
import LateArrivalsScreen from "./src/screens/LateArrivalsScreen";
import EarlyExitsScreen from "./src/screens/EarlyExitsScreen";
import RequestsScreen from "./src/screens/RequestsScreen";
import RequestJustificationScreen from "./src/screens/RequestJustificationScreen";
import RequestEarlyExitScreen from "./src/screens/RequestEarlyExitScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import AnnouncementsScreen from "./src/screens/AnnouncementsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeIndex" component={HomeScreen} />
      <Stack.Screen name="StudentSummary" component={StudentSummaryScreen} />
      <Stack.Screen name="AttendanceCalendar" component={AttendanceCalendarScreen} />
      <Stack.Screen name="LateArrivals" component={LateArrivalsScreen} />
      <Stack.Screen name="EarlyExits" component={EarlyExitsScreen} />
    </Stack.Navigator>
  );
}

function RequestsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RequestsIndex" component={RequestsScreen} />
      <Stack.Screen name="RequestJustification" component={RequestJustificationScreen} />
      <Stack.Screen name="RequestEarlyExit" component={RequestEarlyExitScreen} />
    </Stack.Navigator>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          borderTopColor: theme.colors.border,
          height: 74,
          paddingBottom: 10,
          paddingTop: 8,
          paddingHorizontal: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        tabBarActiveTintColor: theme.colors.ink,
        tabBarInactiveTintColor: theme.colors.inkMuted,
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Inicio: "view-dashboard-outline",
            Solicitudes: "message-badge-outline",
            Notificaciones: "bell-ring-outline",
            Anuncios: "bullhorn-outline",
            Perfil: "account-circle-outline",
          };
          return <MaterialCommunityIcons name={icons[route.name]} size={size} color={color} />;
        },
      })}
      >
      <Tab.Screen
        name="Inicio"
        component={HomeStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const tab = state.routes.find((route) => route.name === "Inicio");
            const childState = tab?.state;
            if (childState?.index > 0) {
              e.preventDefault();
              navigation.navigate("Inicio", { screen: "HomeIndex" });
            }
          },
        })}
      />
      <Tab.Screen
        name="Solicitudes"
        component={RequestsStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const tab = state.routes.find((route) => route.name === "Solicitudes");
            const childState = tab?.state;
            if (childState?.index > 0) {
              e.preventDefault();
              navigation.navigate("Solicitudes", { screen: "RequestsIndex" });
            }
          },
        })}
      />
      <Tab.Screen name="Notificaciones" component={NotificationsScreen} />
      <Tab.Screen name="Anuncios" component={AnnouncementsScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={theme.colors.ink} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? <Stack.Screen name="AppTabs" component={AppTabs} /> : <Stack.Screen name="Login" component={LoginScreen} />}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <NavigationContainer
          theme={{
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              background: theme.colors.background,
              card: theme.colors.white,
              primary: theme.colors.primary,
              text: theme.colors.ink,
              border: theme.colors.border,
            },
          }}
        >
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
