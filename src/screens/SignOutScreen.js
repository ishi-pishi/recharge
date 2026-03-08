import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, Image } from 'react-native';
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Image source={require('../../assets/recharge_logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Account Settings</Text>
          <Text style={styles.subtitle}>Signed in as:</Text>
          <Text style={styles.email}>{user?.email || 'Unknown User'}</Text>

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
    fontSize: 16,
    color: '#777777',
    fontFamily: 'Quicksand_600SemiBold',
    marginTop: 8,
  },
  email: {
    fontSize: 18,
    color: '#3E2723',
    fontFamily: 'Quicksand_600SemiBold',
    marginVertical: 16,
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
