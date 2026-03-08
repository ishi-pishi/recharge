import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, DeviceEventEmitter, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { fetchActivitiesByDate, fetchLast7DaysActivities } from '../config/api';
import { GoogleGenerativeAI } from '@google/generative-ai';

const CATEGORIES = [
  { key: 'Work', label: 'Work' },
  { key: 'Sleep', label: 'Sleep' },
  { key: 'Exercise', label: 'Exercise' },
  { key: 'Socializing', label: 'Socializing' },
  { key: 'Leisure/Self-Care', label: 'Leisure' },
];

const INITIAL_TOTALS = CATEGORIES.reduce((acc, cat) => {
  acc[cat.key] = 0;
  return acc;
}, {});

export default function DailySummaryScreen() {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [totals, setTotals] = useState(INITIAL_TOTALS);
  const [insight, setInsight] = useState(null);
  const isFocused = useIsFocused();
  const hasLoadedOnce = React.useRef(false);

  useEffect(() => {
    const loadTotals = async () => {
      // Only show the loader the very first time this screen loads.
      if (!hasLoadedOnce.current) setLoading(true);
      try {
        const activities = await fetchActivitiesByDate(new Date());
        const summary = activities.reduce((acc, act) => {
          const key = act.category || 'Other';
          acc[key] = (acc[key] || 0) + (act.durationHours || 0);
          return acc;
        }, {});
        setTotals({ ...INITIAL_TOTALS, ...summary });
      } catch (err) {
        console.error(err);
        setTotals(INITIAL_TOTALS);
      } finally {
        hasLoadedOnce.current = true;
        setLoading(false);
      }
    };

    const subscription = DeviceEventEmitter.addListener('activitySaved', loadTotals);

    if (isFocused) {
      loadTotals();
    }

    return () => subscription.remove();
  }, [isFocused]);

  const getScoreColor = (score) => {
    if (score === "?") return "#666";
    if (score < 30) return "#34C759";
    if (score < 70) return "#FF9500";
    return "#FF3B30";
  };

  const handleGenerate = async () => {
    setAiLoading(true);
    setInsight(null);

    try {
      const activities = await fetchLast7DaysActivities();
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

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing Gemini API Key in .env");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

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
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(cleanedText);
      setInsight(parsed);
    } catch (err) {
      console.error("Gemini AI Error:", err);
      setInsight({ score: "?", suggestion: "Error fetching analysis. Please check your network or API limits." });
    } finally {
      setAiLoading(false);
    }
  };

  const renderRow = ({ key, label }) => {
    const value = totals[key] ?? 0;
    return (
      <View key={key} style={styles.box}>
        <Text style={styles.boxLabel}>{label}</Text>
        <Text style={styles.boxValue}>{value.toFixed(2)}</Text>
        <Text style={styles.boxUnits}>hrs</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Daily Summary</Text>
      <Text style={styles.subtitle}>Today&apos;s totals for tracked activities.</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading your day...</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.grid}>
              {CATEGORIES.map(renderRow)}
            </View>

            {Object.values(totals).every((v) => v === 0) && (
              <Text style={styles.emptyText}>No activities logged for today. Add some in the Schedule tab.</Text>
            )}
          </View>

          {!insight && !aiLoading && (
            <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
              <Text style={styles.generateText}>Generate Burnout Score</Text>
            </TouchableOpacity>
          )}

          {aiLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>Gemini is analyzing your schedule...</Text>
            </View>
          )}

          {insight && !aiLoading && (
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
        </>
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    fontSize: 16,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: '#141414',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    padding: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  box: {
    width: '48%',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  boxLabel: {
    color: '#DDD',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  boxValue: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  boxUnits: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 36,
  },
  loadingText: {
    color: '#4A90E2',
    marginTop: 12,
    fontSize: 16,
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
    marginTop: 20,
  },
  generateText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  insightCard: {
    backgroundColor: '#141414',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#222',
    marginTop: 20,
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
