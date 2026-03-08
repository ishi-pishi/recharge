import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { auth } from './src/config/firebase';
import { useFonts, Quicksand_400Regular, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { DefaultTheme } from '@react-navigation/native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

// Import Screens (to be created)
import LoginScreen from './src/screens/LoginScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import DailySummaryScreen from './src/screens/DailySummaryScreen';
import BurnoutScreen from './src/screens/BurnoutScreen';
import SignOutScreen from './src/screens/SignOutScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tabs Navigator (Main App)
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Schedule') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Summary') {
            iconName = focused ? 'pie-chart' : 'pie-chart-outline';
          } else if (route.name === 'AI Insights') {
            iconName = focused ? 'bulb' : 'bulb-outline';
          } else if (route.name === 'Account') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#7b9ed8', // Toned down blue
        tabBarInactiveTintColor: '#999999',
        tabBarLabelStyle: {
          fontFamily: 'Quicksand_600SemiBold',
        },
        tabBarStyle: {
          backgroundColor: '#FDFBF7',
          borderTopColor: '#EAE6DF',
          elevation: 0,
          shadowOpacity: 0.1,
        },
        headerStyle: {
          backgroundColor: '#FDFBF7',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#EAE6DF'
        },
        headerTintColor: '#2A2724', // Warm dark black
        headerTitleStyle: {
          fontFamily: 'Quicksand_700Bold',
          color: '#2A2724'
        },
      })}
    >
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Summary" component={DailySummaryScreen} />
      <Tab.Screen name="AI Insights" component={BurnoutScreen} />
      <Tab.Screen name="Account" component={SignOutScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  let [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFBF7' }}>
        <ActivityIndicator size="large" color="#7b9ed8" />
      </View>
    );
  }

  // Create a custom light theme extending DefaultTheme
  const AppTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#FDFBF7',
      card: '#FDFBF7',
      text: '#2A2724',
      primary: '#7b9ed8'
    },
  };

  return (
    <NavigationContainer theme={AppTheme}>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false, backgroundColor: '#FDFBF7' }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
