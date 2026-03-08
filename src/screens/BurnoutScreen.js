import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchLast7DaysActivities } from '../config/api';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function BurnoutScreen() {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setInsight(null);
    try {
      // 1. Fetch 7 days Data
      const activities = await fetchLast7DaysActivities();
      
      // 2. Aggregate Data
      const summary = activities.reduce((acc, act) => {
        if (!acc[act.category]) acc[act.category] = 0;
        acc[act.category] += act.durationHours;
        return acc;
      }, {});

      let scheduleText = "Over the past 7 days, my schedule was roughly:\n";
      for (const [cat, hours] of Object.entries(summary)) {
        scheduleText += `- ${cat}: ${hours.toFixed(1)} hours\n`;
      }
      if (activities.length === 0) {
        scheduleText = "I have not logged any activities in the past 7 days.";
      }

      // 3. Prompt Gemini for suggestions only
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing Gemini API Key in .env");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

      const prompt = `
        You are a burnout and self-care assistant. Read the user's activity log for the last 7 days and provide a concise recommendation to reduce burnout and improve balance.
        Activities:
        ${scheduleText}

        Respond EXACTLY in this JSON format, and nothing else (do not include markdown ticks \`\`\`json):
        {
          "suggestion": "..."
        }
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Remove any json markdown if model ignored the prompt format instruction
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(cleanedText);
      setInsight(parsed);
    } catch (error) {
      console.error("Gemini AI Error:", error);
      setInsight({ suggestion: "Error fetching suggestions. Please check your network or API limits." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={32} color="#4A90E2" />
        <Text style={styles.title}>AI Recommendations</Text>
        <Text style={styles.subtitle}>Get personalized suggestions based on your recent schedule.</Text>
      </View>

      {!insight && !loading && (
        <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
          <Text style={styles.generateText}>Generate Suggestions</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Gemini is generating your recommendation...</Text>
        </View>
      )}

      {insight && !loading && (
        <View style={styles.insightCard}>

          <Text style={styles.suggestionTitle}>Suggestions</Text>
          <Text style={styles.suggestionText}>{insight.suggestion}</Text>

          <TouchableOpacity style={styles.refreshButton} onPress={handleGenerate}>
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.refreshText}>Re-run</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
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
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
    lineHeight: 24,
  },
  generateButton: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#4A90E2',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  generateText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#4A90E2',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  insightCard: {
    backgroundColor: '#141414',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#222',
  },
  suggestionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  suggestionText: {
    color: '#D0D0D0',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  refreshButton: {
    flexDirection: 'row',
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
});
