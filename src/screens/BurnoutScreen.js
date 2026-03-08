import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchLast7DaysActivities } from '../config/api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format, parseISO, isAfter, subDays } from 'date-fns';

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

      // 3. Prompt Gemini
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing Gemini API Key in .env");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        You are a health span and burnout prediction assistant. 
        Read the user's activity log for the last 7 days and predict their burnout level.
        Activities:
        ${scheduleText}
        
        A high burnout score (close to 100) means they are extremely likely to burn out (e.g. low sleep, high work, low leisure). A low score (close to 0) means they are well rested.
        
        Respond EXACTLY in this JSON format, and nothing else (do not include markdown ticks \`\`\`json):
        {
          "score": 85,
          "suggestion": "You have been overworking with very little sleep. Please take a break."
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
      setInsight({ score: "?", suggestion: "Error fetching analysis. Please check your network or API limits." });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score === "?") return "#666";
    if (score < 30) return "#34C759";
    if (score < 70) return "#FF9500";
    return "#FF3B30";
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={32} color="#4A90E2" />
        <Text style={styles.title}>AI Analysis</Text>
        <Text style={styles.subtitle}>Get a score on your schedule burnout based on the last 7 days.</Text>
      </View>

      {!insight && !loading && (
        <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
          <Text style={styles.generateText}>Generate Score</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Gemini is analyzing your schedule...</Text>
        </View>
      )}

      {insight && !loading && (
        <View style={styles.insightCard}>
          <Text style={styles.scoreLabel}>Burnout Rating</Text>
          <View style={[styles.scoreBubble, { backgroundColor: getScoreColor(insight.score) + '20', borderColor: getScoreColor(insight.score) }]}>
            <Text style={[styles.scoreValue, { color: getScoreColor(insight.score) }]}>
              {insight.score}
            </Text>
            {insight.score !== "?" && <Text style={[styles.scoreScale, { color: getScoreColor(insight.score) }]}>/100</Text>}
          </View>
          
          <Text style={styles.suggestionTitle}>Insights</Text>
          <Text style={styles.suggestionText}>{insight.suggestion}</Text>

          <TouchableOpacity style={styles.refreshButton} onPress={handleGenerate}>
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.refreshText}>Recalculate</Text>
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
  scoreLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreBubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    borderWidth: 1,
    marginBottom: 32,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreScale: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 4,
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
