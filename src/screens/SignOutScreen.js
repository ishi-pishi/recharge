import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';

export default function SignOutScreen() {
  const user = auth.currentUser;

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Account Settings</Text>
        <Text style={styles.subtitle}>Signed in as:</Text>
        <Text style={styles.email}>{user?.email || 'Unknown User'}</Text>

        <TouchableOpacity style={styles.button} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFBF7',
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
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Quicksand_700Bold',
    color: '#2A2724',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Quicksand_600SemiBold',
    marginBottom: 8,
  },
  email: {
    fontSize: 18,
    color: '#2A2724',
    fontFamily: 'Quicksand_600SemiBold',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#eda09a',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#eda09a',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Quicksand_700Bold',
  },
});
