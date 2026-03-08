import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useFocusEffect } from '@react-navigation/native';
import { fetchLast7DaysActivities } from '../config/api';

export default function SuggestionsScreen({ route, navigation }) {
  // If navigated from Assessment, we might have insight already. 
  // If not, we prompt the user to go to Assessment first.
  const passedInsight = route.params?.insight || null;
  const passedScheduleText = route.params?.scheduleText || null;

  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      if (!suggestions && !loading) {
        fetchSuggestions();
      }
      
      return () => {
        // Optional cleanup if we want it to reset every time they leave the tab
        // setSuggestions(null);
      };
    }, [passedInsight])
  );

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing Gemini API Key in .env");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      let prompt;

      if (passedInsight && passedScheduleText) {
        prompt = `
          You are a supportive burnout and self-care AI assistant. 
          The user just received a Burnout Score of "${passedInsight.burnoutRiskScore}".
          Here is their 7-day schedule:
          ${passedScheduleText}
          
          Provide a short (2-3 sentences max) comforting observation, followed by exactly 3 bullet points of actionable, gentle advice tailored to their specific schedule to improve their balance.
        `;
      } else {
        const activities = await fetchLast7DaysActivities();
        const summary = activities.reduce((acc, act) => {
          if (!acc[act.category]) acc[act.category] = 0;
          acc[act.category] += act.durationHours;
          return acc;
        }, {});
        
        let localScheduleText = "Over the past 7 days, my schedule was roughly:\n";
        for (const [cat, hours] of Object.entries(summary)) {
          localScheduleText += `- ${cat}: ${hours.toFixed(1)} hours\n`;
        }
        if (activities.length === 0) {
          localScheduleText = "I have not logged any activities in the past 7 days.";
        }
        
        prompt = `
          You are a supportive burnout and self-care AI assistant. 
          Here is the user's 7-day schedule:
          ${localScheduleText}
          
          Provide a short (2-3 sentences max) comforting observation analyzing their balance, followed by exactly 3 bullet points of actionable, gentle advice tailored to their specific schedule to improve their wellbeing.
        `;
      }

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      setSuggestions(text);
    } catch (error) {
      console.error("Gemini AI Error:", error);
      setSuggestions("Error fetching detailed suggestions. Please check your network or API limits.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={32} color="#F2E1A8" />
        <Text style={styles.title}>Suggestions</Text>
        <Text style={styles.subtitle}>Detailed AI analysis on how to improve your daily balance.</Text>
      </View>

      {/* Removed emptyContainer block that blocked rendering without passedInsight */}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F2C7AD" />
          <Text style={styles.loadingText}>Analyzing your week...</Text>
        </View>
      )}

      {suggestions && !loading && (
        <View style={styles.card}>
          {passedInsight && (
            <>
              <Text style={styles.scoreContext}>Based on your score:</Text>
              <Text style={styles.scoreValue}>{passedInsight.burnoutRiskScore}</Text>
              <View style={styles.divider} />
            </>
          )}
          
          <Text style={styles.suggestionText}>{suggestions}</Text>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFBF7',
  },
  content: {
    padding: 24,
  },
  header: {
    marginTop: 48,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Lora_700Bold',
    color: '#3E2723',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#777777',
    marginTop: 8,
    lineHeight: 24,
    fontFamily: 'Lora_500Medium',
  },
  emptyContainer: {
    marginTop: 64,
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Quicksand_600SemiBold',
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#F2C7AD',
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Lora_600SemiBold',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EAE6DF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  scoreContext: {
    fontSize: 14,
    color: '#777',
    fontFamily: 'Lora_600SemiBold',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 24,
    color: '#3E2723',
    fontFamily: 'Lora_700Bold',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#EAE6DF',
    marginBottom: 16,
  },
  suggestionText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 28,
    fontFamily: 'Quicksand_600SemiBold',
  },
});
