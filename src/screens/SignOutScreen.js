import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, Image, Switch, ActivityIndicator } from 'react-native';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { 
  getCalendarSyncEnabled, 
  setCalendarSyncEnabled, 
  requestCalendarPermissions,
  syncCalendarEvents,
  getLastSyncTime
} from '../config/calendarSync';
import { Ionicons } from '@expo/vector-icons';
import { format, subDays } from 'date-fns';

export default function SignOutScreen() {
  const user = auth.currentUser;
  const [calendarSyncEnabled, setCalendarSyncEnabledState] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const enabled = await getCalendarSyncEnabled();
    setCalendarSyncEnabledState(enabled);
    
    const lastSyncTime = await getLastSyncTime();
    setLastSync(lastSyncTime);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleCalendarToggle = async (value) => {
    if (value) {
      const hasPermission = await requestCalendarPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Calendar access is required to sync events.');
        return;
      }
    }
    
    setCalendarSyncEnabledState(value);
    await setCalendarSyncEnabled(value);
    
    if (value) {
      Alert.alert(
        'Calendar Sync Enabled',
        'Today\'s calendar events will be automatically imported and categorized when you view your schedule.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Image source={require('../../assets/recharge_logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Account Settings</Text>
          <Text style={styles.subtitle}>Signed in as</Text>
          <Text style={styles.email}>{user?.email || 'Unknown User'}</Text>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Calendar Sync</Text>
              <Text style={styles.settingDescription}>Auto-sync today's events</Text>
            </View>
            <Switch
              value={calendarSyncEnabled}
              onValueChange={handleCalendarToggle}
              trackColor={{ false: '#EAE6DF', true: '#A8E6CF' }}
              thumbColor={calendarSyncEnabled ? '#8CBDB1' : '#f4f3f4'}
            />
          </View>

          {lastSync && calendarSyncEnabled && (
            <Text style={styles.lastSyncText}>
              Last synced: {format(lastSync, 'MMM d, h:mm a')}
            </Text>
          )}

          <View style={styles.divider} />

          <TouchableOpacity style={styles.button} onPress={handleSignOut}>
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFBF7',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAE6DF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 4,
  },
  logo: {
    width: 200,
    height: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Quicksand_700Bold',
    color: '#3E2723',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#777777',
    fontFamily: 'Quicksand_600SemiBold',
    marginBottom: 8,
  },
  email: {
    fontSize: 18,
    color: '#3E2723',
    fontFamily: 'Quicksand_600SemiBold',
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#EAE6DF',
    width: '100%',
    marginVertical: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontFamily: 'Quicksand_700Bold',
    color: '#3E2723',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    fontFamily: 'Quicksand_600SemiBold',
    color: '#999',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDFBF7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8CBDB1',
    width: '100%',
    marginBottom: 12,
  },
  syncButtonText: {
    color: '#8CBDB1',
    fontSize: 15,
    fontFamily: 'Quicksand_700Bold',
  },
  lastSyncText: {
    fontSize: 12,
    fontFamily: 'Quicksand_600SemiBold',
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#FDFBF7',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F2C7AD',
    width: '100%',
    alignItems: 'center',
    shadowColor: '#F2C7AD',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#F2C7AD',
    fontSize: 16,
    fontFamily: 'Lora_700Bold',
  },
});
