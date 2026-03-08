import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, isSameDay } from 'date-fns';
import { fetchActivitiesByDate } from '../config/api';

export default function DailySummaryScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchActivitiesByDate(selectedDate);
        if (active) setActivities(data);
      } catch (err) {
        console.error("Failed to load summary stats: ", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [selectedDate]);

  const isToday = isSameDay(selectedDate, new Date());

  const totalHours = activities.reduce((sum, act) => sum + (act.durationHours || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Daily Summary</Text>
      <Text style={styles.dateDisplay}>{format(selectedDate, 'EEEE, MMMM do, yyyy')}</Text>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#C9D6ED" />
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="pie-chart-outline" size={80} color="#D0E5C9" />
          <Text style={styles.emptyTitle}>No Data for {isToday ? 'Today' : format(selectedDate, 'MMM do')}</Text>
          <Text style={styles.emptySubtitle}>Track activities on the schedule screen to see your summary!</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.statsCard}>
            <Ionicons name="time" size={48} color="#C9D6ED" />
            <Text style={styles.totalHoursText}>{totalHours.toFixed(1)}</Text>
            <Text style={styles.hoursLabel}>hours studied</Text>
            <Text style={styles.statsSubtitle}>{isToday ? 'Today' : format(selectedDate, 'MMM do')}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFBF7',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Nunito_700Bold',
    color: '#2A2724',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  dateDisplay: {
    fontSize: 16,
    fontFamily: 'Lora_600SemiBold',
    color: '#777777',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Lora_700Bold',
    color: '#3E2723',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#777777',
    marginTop: 8,
    width: '70%',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Lora_500Medium',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 48,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAE6DF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
  },
  totalHoursText: {
    fontSize: 72,
    fontFamily: 'Lora_700Bold',
    color: '#3E2723',
    marginTop: 16,
  },
  hoursLabel: {
    fontSize: 20,
    fontFamily: 'Lora_600SemiBold',
    color: '#555',
    marginTop: 8,
  },
  statsSubtitle: {
    fontSize: 16,
    color: '#999',
    fontFamily: 'Lora_500Medium',
    marginTop: 8,
  },
});
