import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchLast7DaysActivities, fetchActivitiesByDate } from '../config/api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useFocusEffect } from '@react-navigation/native';

const CATEGORY_INFO = {
  'Work': { emoji: '💼', color: '#C9D6ED' },
  'Sleep': { emoji: '🌙', color: '#D0E5C9' },
  'Exercise': { emoji: '💪', color: '#F2C7AD' },
  'Socializing': { emoji: '🗣️', color: '#F2E1A8' },
  'Leisure/Self-Care': { emoji: '🧘', color: '#D2D6E8' },
};

export default function BurnoutScreen({ navigation }) {
  const [loading, setLoading] = useState(true); // Start loading true
  const [insight, setInsight] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState({});
  const [scheduleText, setScheduleText] = useState("");
  const breatheAnim = useRef(new Animated.Value(1)).current;

  // Reset insight state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setInsight(null);
    }, [])
  );

  useEffect(() => {
    let isActive = true;
    const fetchWeekly = async () => {
      setLoading(true);
      try {
        const activities = await fetchLast7DaysActivities();
        const summary = activities.reduce((acc, act) => {
          if (!acc[act.category]) acc[act.category] = 0;
          acc[act.category] += act.durationHours;
          return acc;
        }, {});
        
        let promptText = "Over the past 7 days, my schedule was roughly:\n";
        for (const [cat, hours] of Object.entries(summary)) {
          promptText += `- ${cat}: ${hours.toFixed(1)} hours\n`;
        }
        if (activities.length === 0) {
          promptText = "I have not logged any activities in the past 7 days.";
        }

        if (isActive) {
          setWeeklySummary(summary);
          setScheduleText(promptText);
        }
      } catch (err) {
        console.error("Error fetching weekly data", err);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchWeekly();

    return () => { isActive = false; }
  }, []);

  const handleGenerate = async () => {
    if (insight) return; // already generated
    setLoading(true);

    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing Gemini API Key in .env");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
        You are a supportive burnout and self-care AI assistant. 
        Analyze the user's 7-day activity log, weighing all categories fairly to determine a balanced 'Burnout Score'. If they have too much work and no sleep/leisure, the score is 'Needs Attention'. If perfectly balanced, the score is 'Doing Good!'. 
        The only valid score outputs are: 'Doing Good!', 'Moderate', or 'Needs Attention'.
        Provide a BRIEF (1-2 sentence) explanation of why they received this score.

        Activities:
        ${scheduleText}

        Respond EXACTLY in this JSON format, and nothing else:
        {
          "burnoutRiskScore": "Doing Good! | Moderate | Needs Attention",
          "explanation": "..."
        }
      `;

      const result = await model.generateContent(prompt);

      const text = result.response.text().trim();

      // Remove any json markdown if model ignored the prompt format instruction
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(cleanedText);
      setInsight({ ...parsed });
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
    } else {
      navigation.navigate('Suggestions', { insight, scheduleText });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
                  <Text style={styles.scoreTapHint}>Tap for details</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.scoreLabel, { fontFamily: 'Quicksand_700Bold', fontSize: 28 }]}>Analyze</Text>
                  <Text style={[styles.scoreTapHint, { marginTop: 4, fontFamily: 'Lora_600SemiBold' }]}>Tap to generate score</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.dailyBarsContainer}>
            <Text style={styles.dailyBarsTitle}>7-Day History</Text>
            {Object.keys(CATEGORY_INFO).map((cat, idx) => {
              const totalHours = weeklySummary[cat] || 0;
              // Normalize against a roughly 168 hour week, scaled for visual clarity
              // E.g. 40 hours of work is a solid bar
              const maxExpected = cat === 'Sleep' ? 56 : cat === 'Work' ? 40 : 20; 
              const fillPercentage = Math.min((totalHours / maxExpected) * 100, 100);

              return (
                <View key={idx} style={styles.barRow}>
                  <Text style={styles.barLabel}>{CATEGORY_INFO[cat]?.emoji} {cat}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { 
                      backgroundColor: CATEGORY_INFO[cat]?.color || '#CCC',
                      width: `${fillPercentage}%`
                    }]} />
                  </View>
                  <Text style={styles.barTime}>{totalHours.toFixed(1)}h</Text>
                </View>
              );
            })}
          </View>
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
  generateButton: {
    backgroundColor: '#D0E5C9',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#D0E5C9',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  generateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Lora_700Bold',
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
  dailyBarsContainer: {
    marginBottom: 32,
    backgroundColor: '#FDFBF7',
    padding: 16,
    borderRadius: 16,
  },
  dailyBarsTitle: {
    fontSize: 16,
    fontFamily: 'Quicksand_700Bold',
    color: '#3E2723',
    marginBottom: 16,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  barLabel: {
    width: 100,
    fontSize: 14,
    fontFamily: 'Quicksand_600SemiBold',
    color: '#555',
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: '#EAE6DF',
    borderRadius: 6,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  barTime: {
    width: 45,
    fontSize: 14,
    fontFamily: 'Quicksand_600SemiBold',
    color: '#777',
    textAlign: 'right',
  },
});
