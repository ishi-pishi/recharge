import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchActivitiesByDate } from '../config/api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useFocusEffect } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';

export default function BurnoutScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState({});
  const [scheduleText, setScheduleText] = useState("");
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      setInsight(null);
      setSuggestions(null);
    }, [])
  );

  useEffect(() => {
    let isActive = true;
    const fetchDaily = async () => {
      setLoading(true);
      try {
        const activities = await fetchActivitiesByDate(new Date());
        const summary = activities.reduce((acc, act) => {
          if (!acc[act.category]) acc[act.category] = 0;
          acc[act.category] += act.durationHours;
          return acc;
        }, {});

        let promptText = "Today, my schedule was roughly:\n";
        for (const [cat, hours] of Object.entries(summary)) {
          // Display "Discretionary" instead of "Leisure/Self-Care" in prompts
          const displayCat = cat === 'Leisure/Self-Care' ? 'Discretionary' : cat;
          promptText += `- ${displayCat}: ${hours.toFixed(1)} hours\n`;
        }
        if (activities.length === 0) {
          promptText = "I have not logged any activities today.";
        }

        if (isActive) {
          setWeeklySummary(summary);
          setScheduleText(promptText);
        }
      } catch (err) {
        console.error("Error fetching daily data", err);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchDaily();

    return () => { isActive = false; }
  }, []);

  const handleGenerate = async () => {
    if (insight) return;
    setLoading(true);

    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing Gemini API Key in .env");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const scorePrompt = `
        You are a supportive burnout and self-care AI assistant. 
        Analyze the user's daily activity log, weighing all categories fairly to determine a balanced 'Burnout Score'. If they have too much work and no sleep/discretionary time, the score is 'Needs Attention'. If perfectly balanced, the score is 'Doing Good!'. 
        The only valid score outputs are: 'Doing Good!', 'Moderate', or 'Needs Attention'.
        The best hours for each activity is: 7-9 hours sleep, 2-3 hours discretionary time, at least 1 hour socializing, and max 8 hours work/obligations. Sometimes too much or little is okay (e.g., lots of exercise, less work).
        Provide a BRIEF (1-2 sentence) explanation of why they received this score.

        Activities:
        ${scheduleText}

        Respond EXACTLY in this JSON format, and nothing else:
        {
          "burnoutRiskScore": "Doing Good! | Moderate | Needs Attention",
          "explanation": "..."
        }
      `;

      const scoreResult = await model.generateContent(scorePrompt);
      const scoreText = scoreResult.response.text().trim();
      const cleanedScoreText = scoreText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedScoreText);
      setInsight({ ...parsed });

      // Now generate suggestions
      const suggestionsPrompt = `
        You are a supportive burnout and self-care AI assistant. 
        The user just received a Burnout Score of "${parsed.burnoutRiskScore}".
        Here is their daily schedule:
        ${scheduleText}
        
        Provide a short (2-3 sentences max) comforting observation, followed by exactly 3 bullet points of actionable, gentle advice tailored to their specific schedule to improve their balance.
      `;

      const suggestionsResult = await model.generateContent(suggestionsPrompt);
      const suggestionsText = suggestionsResult.response.text().trim();
      setSuggestions(suggestionsText);

    } catch (error) {
      console.error("Gemini AI Error:", error);
      setInsight({ explanation: "Error fetching suggestions. Please check your network or API limits." });
    } finally {
      setLoading(false);
    }
  };

  const handleCirclePress = () => {
    if (!insight) {
      handleGenerate();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={32} color="#F2E1A8" />
        <Text style={styles.title}>Suggestions</Text>
        <Text style={styles.subtitle}>AI analysis on how to improve your daily balance.</Text>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D0E5C9" />
          <Text style={styles.loadingText}>Fetching your schedule...</Text>
        </View>
      )}

      {!loading && (
        <View style={styles.insightCard}>
          <Animated.View style={[styles.scoreRingBackground, {
            transform: [{ scale: breatheAnim }],
            backgroundColor: insight?.burnoutRiskScore?.includes('Good') ? '#A8E6CF' :
              insight?.burnoutRiskScore?.includes('Attention') ? '#FFD3B6' : '#EAE6DF'
          }]}>
            <TouchableOpacity style={styles.scoreCircle} onPress={handleCirclePress}>
              {insight ? (
                <>
                  <Text style={styles.scoreLabel}>Score</Text>
                  <Text style={styles.scoreValue}>{insight.burnoutRiskScore}</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.scoreLabel, { fontFamily: 'Quicksand_700Bold', fontSize: 28 }]}>Analyze</Text>
                  <Text style={[styles.scoreTapHint, { marginTop: 4, fontFamily: 'Lora_600SemiBold' }]}>Tap to generate</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {suggestions && (
            <View style={styles.suggestionsContainer}>
              <Markdown style={markdownStyles}>{suggestions}</Markdown>
            </View>
          )}
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
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  header: {
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
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#D0E5C9',
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Lora_600SemiBold',
  },
  insightCard: {
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
  scoreRingBackground: {
    alignSelf: 'center',
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 15,
    elevation: 5,
  },
  scoreCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FDFBF7',
  },
  scoreLabel: {
    color: '#777',
    fontSize: 14,
    fontFamily: 'Lora_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  scoreValue: {
    color: '#3E2723',
    fontSize: 22,
    fontFamily: 'Quicksand_700Bold',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  scoreTapHint: {
    color: '#999',
    fontSize: 12,
    fontFamily: 'Lora_500Medium',
    marginTop: 8,
  },
  suggestionsContainer: {
    marginTop: 8,
  },
});

const markdownStyles = {
  body: {
    fontSize: 16,
    color: '#555',
    lineHeight: 28,
    fontFamily: 'Quicksand_600SemiBold',
  },
  heading1: {
    fontSize: 24,
    fontFamily: 'Lora_700Bold',
    color: '#3E2723',
    marginTop: 16,
    marginBottom: 12,
  },
  heading2: {
    fontSize: 20,
    fontFamily: 'Lora_700Bold',
    color: '#3E2723',
    marginTop: 12,
    marginBottom: 8,
  },
  heading3: {
    fontSize: 18,
    fontFamily: 'Lora_700Bold',
    color: '#3E2723',
    marginTop: 10,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 16,
    color: '#555',
    lineHeight: 28,
    marginBottom: 12,
  },
  strong: {
    fontWeight: '700',
    color: '#3E2723',
  },
  em: {
    fontStyle: 'italic',
    fontFamily: 'Lora_500Medium',
  },
  bullet_list: {
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  list_item: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bullet_list_icon: {
    fontSize: 16,
    color: '#F2C7AD',
    marginRight: 8,
    marginTop: 4,
  },
  bullet_list_content: {
    flex: 1,
    fontSize: 16,
    color: '#555',
    lineHeight: 26,
  },
  code_inline: {
    backgroundColor: '#F5F5F5',
    color: '#C9D6ED',
    fontFamily: 'monospace',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  fence: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  blockquote: {
    backgroundColor: '#F9F9F9',
    borderLeftWidth: 4,
    borderLeftColor: '#D0E5C9',
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  hr: {
    backgroundColor: '#EAE6DF',
    height: 1,
    marginVertical: 16,
  },
};
