import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchLast7DaysActivities, fetchActivitiesByDate } from '../config/api';
import { GoogleGenerativeAI } from '@google/generative-ai';

const CATEGORY_INFO = {
  'Work': { emoji: '💼', color: '#C9D6ED' },
  'Sleep': { emoji: '🌙', color: '#D0E5C9' },
  'Exercise': { emoji: '💪', color: '#F2C7AD' },
  'Socializing': { emoji: '🗣️', color: '#F2E1A8' },
  'Leisure/Self-Care': { emoji: '🧘', color: '#D2D6E8' },
};

export default function BurnoutScreen() {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [todaySummary, setTodaySummary] = useState({});
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
      ])
    ).start();

    const fetchToday = async () => {
      try {
        const activities = await fetchActivitiesByDate(new Date());
        const summary = activities.reduce((acc, act) => {
          if (!acc[act.category]) acc[act.category] = 0;
          acc[act.category] += act.durationHours;
          return acc;
        }, {});
        setTodaySummary(summary);
      } catch (err) {}
    };
    fetchToday();
  }, [breatheAnim]);

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

      // Removed isolated daily calculation string builder
      // 3. Prompt Gemini for suggestions only
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing Gemini API Key in .env");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

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
      setInsight({ suggestion: "Error fetching suggestions. Please check your network or API limits." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={32} color="#C9D6ED" />
        <Text style={styles.title}>Burnout</Text>
        <Text style={styles.subtitle}>Get personalized burnout advice and daily insights.</Text>
      </View>

      {!insight && !loading && (
        <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
          <Text style={styles.generateText}>Generate Suggestions</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D0E5C9" />
          <Text style={styles.loadingText}>Gemini is generating your recommendation...</Text>
        </View>
      )}

      {insight && !loading && (
        <View style={styles.insightCard}>

          <Animated.View style={[styles.scoreRingBackground, { 
            transform: [{ scale: breatheAnim }],
            backgroundColor: insight.burnoutRiskScore?.includes('Good') ? '#A8E6CF' : 
                             insight.burnoutRiskScore?.includes('Attention') ? '#FFD3B6' : '#EAE6DF'
          }]}>
            <TouchableOpacity style={styles.scoreCircle} onPress={() => setModalVisible(true)}>
              <Text style={styles.scoreLabel}>Score</Text>
              <Text style={styles.scoreValue}>{insight.burnoutRiskScore}</Text>
              <Text style={styles.scoreTapHint}>Tap for details</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.dailyBarsContainer}>
            <Text style={styles.dailyBarsTitle}>Today's Breakdown</Text>
            {Object.keys(CATEGORY_INFO).map((cat, idx) => (
              <View key={idx} style={styles.barRow}>
                <Text style={styles.barLabel}>{CATEGORY_INFO[cat]?.emoji} {cat}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { 
                    backgroundColor: CATEGORY_INFO[cat]?.color || '#CCC',
                    width: `${Math.min(((todaySummary[cat] || 0) / 12) * 100, 100)}%`
                  }]} />
                </View>
                <Text style={styles.barTime}>{(todaySummary[cat] || 0).toFixed(1)}h</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={handleGenerate}>
            <Ionicons name="refresh" size={20} color="#F2C7AD" />
            <Text style={styles.refreshText}>Recalculate</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Explanation Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Burnout Breakdown</Text>
            <Text style={styles.modalText}>{insight?.explanation}</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

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
    fontFamily: 'Lora_700Bold',
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
    fontFamily: 'Lora_700Bold',
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
    fontSize: 12,
    fontFamily: 'Lora_600SemiBold',
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
    width: 35,
    fontSize: 12,
    fontFamily: 'Lora_600SemiBold',
    color: '#777',
    textAlign: 'right',
  },
  refreshButton: {
    flexDirection: 'row',
    backgroundColor: '#FDFBF7',
    borderWidth: 2,
    borderColor: '#F2C7AD',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    color: '#F2C7AD',
    fontFamily: 'Lora_700Bold',
    marginLeft: 8,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'Lora_700Bold',
    color: '#3E2723',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    fontFamily: 'Lora_500Medium',
    color: '#555',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalClose: {
    backgroundColor: '#C9D6ED',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  modalCloseText: {
    color: '#3E2723',
    fontFamily: 'Lora_700Bold',
    fontSize: 16,
  },
});
