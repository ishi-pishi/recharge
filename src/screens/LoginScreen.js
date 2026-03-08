import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image } from 'react-native';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!isLogin && password.length < 6) {
      Alert.alert('Error', 'Password should be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      if (isLogin) {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err) {
      let errorMessage = err.message;
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      Alert.alert('Authentication Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address first to reset your password.');
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Success', 'Password reset email sent! Please check your inbox.');
    } catch (err) {
      let errorMessage = err.message;
      if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      }
      Alert.alert('Reset Error', errorMessage);
    }
  };


  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <Image source={require('../../assets/recharge_logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.subtitle}>Track your schedule, avoid burnout.</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>{isLogin ? 'Login' : 'Sign Up'}</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {isLogin && (
            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPasswordContainer} disabled={loading}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => setIsLogin(!isLogin)}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <Text style={styles.secondaryButtonTextHighlight}>
              {isLogin ? "Sign Up" : "Sign In"}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingBottom: 60,
  },
  headerContainer: {
    marginBottom: 48,
    alignItems: 'center',
  },
  logo: {
    width: 250,
    height: 120,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#777777',
    fontFamily: 'Lora_600SemiBold',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EAE6DF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    width: '100%',
    alignItems: 'stretch',
  },
  formTitle: {
    fontSize: 28,
    fontFamily: 'Quicksand_700Bold',
    color: '#3E2723',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#FDFBF7',
    borderRadius: 12,
    padding: 16,
    color: '#3E2723',
    fontSize: 16,
    fontFamily: 'Quicksand_600SemiBold',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EAE6DF',
  },
  primaryButton: {
    backgroundColor: '#8CBDB1',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#8CBDB1',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Lora_700Bold',
  },
  forgotPasswordContainer: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  forgotPasswordText: {
    color: '#C9D6ED',
    fontSize: 14,
    fontFamily: 'Quicksand_600SemiBold',
  },
  secondaryButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#888',
    fontSize: 14,
    fontFamily: 'Quicksand_600SemiBold',
  },
  secondaryButtonTextHighlight: {
    color: '#F2C7AD',
    fontFamily: 'Quicksand_700Bold',
  },
});
