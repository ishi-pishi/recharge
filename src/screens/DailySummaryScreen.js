import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, subDays, isSameDay } from 'date-fns';
import { fetchActivitiesByDate } from '../config/api';

const CATEGORY_COLORS = {
  'Work': '#7b9ed8', // muted light blue
  'Sleep': '#8ed89e', // muted light green
  'Exercise': '#eda09a', // muted coral/peach
  'Socializing': '#FFD24D',
  'Leisure/Self-Care': '#4DDFD2'
};

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

  const renderDateSelector = () => {
    const dates = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 3 - i));

    return (
      <View style={styles.dateSelector}>
        {dates.map((date, idx) => {
          const isSelected = isSameDay(date, selectedDate);
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.dateItem, isSelected && styles.dateItemSelected]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>
                {format(date, 'EEE')}
              </Text>
              <Text style={[styles.dateNumber, isSelected && styles.dateTextSelected]}>
                {format(date, 'd')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const calculateStats = () => {
    const totalHours = activities.reduce((sum, act) => sum + (act.durationHours || 0), 0);

    // Group by category
    const grouped = activities.reduce((acc, act) => {
      acc[act.category] = (acc[act.category] || 0) + (act.durationHours || 0);
      return acc;
    }, {});

    // Sort by duration descending
    const breakdown = Object.entries(grouped)
      .map(([category, durationHours]) => ({ category, durationHours }))
      .sort((a, b) => b.durationHours - a.durationHours);

    return { totalHours, breakdown };
  };

  const { totalHours, breakdown } = calculateStats();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Daily Summary</Text>

      {renderDateSelector()}

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="pie-chart-outline" size={80} color="#8ed89e" />
          <Text style={styles.emptyTitle}>No Data for {format(selectedDate, 'MMM do')}</Text>
          <Text style={styles.emptySubtitle}>Track activities on the schedule screen to see your summary!</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Top Stats Overview */}
          <View style={styles.statsCard}>
            <Ionicons name="time" size={32} color="#7b9ed8" />
            <Text style={styles.totalHoursText}>{totalHours.toFixed(1)} <Text style={{ fontSize: 20 }}>hrs</Text></Text>
            <Text style={styles.statsSubtitle}>Total Logged Time</Text>
          </View>

          {/* Breakdown List */}
          <Text style={styles.sectionTitle}>Breakdown</Text>
          <FlatList
            data={breakdown}
            keyExtractor={(item) => item.category}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => {
              const percentage = totalHours > 0 ? (item.durationHours / totalHours) * 100 : 0;
              const color = CATEGORY_COLORS[item.category] || '#FFF';

              return (
                <View style={styles.breakdownItem}>
                  <View style={styles.breakdownHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.colorDot, { backgroundColor: color }]} />
                      <Text style={styles.breakdownCategory}>{item.category}</Text>
                    </View>
                    <Text style={styles.breakdownDuration}>{item.durationHours.toFixed(1)} hrs</Text>
                  </View>

                  {/* Mini Progress Bar */}
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
                  </View>
                </View>
              );
            }}
          />
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
    fontFamily: 'Quicksand_700Bold',
    color: '#2A2724',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE6DF',
  },
  dateItem: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  dateItemSelected: {
    backgroundColor: '#8ed89e',
  },
  dateDay: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    fontFamily: 'Quicksand_600SemiBold',
  },
  dateNumber: {
    fontSize: 18,
    color: '#555',
    fontFamily: 'Quicksand_700Bold',
  },
  dateTextSelected: {
    color: '#2A2724',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Quicksand_700Bold',
    color: '#2A2724',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#777',
    marginTop: 8,
    width: '70%',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Quicksand_500Medium',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAE6DF',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  totalHoursText: {
    fontSize: 56,
    fontFamily: 'Quicksand_700Bold',
    color: '#2A2724',
    marginTop: 8,
  },
  statsSubtitle: {
    fontSize: 16,
    color: '#777',
    fontFamily: 'Quicksand_600SemiBold',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Quicksand_700Bold',
    color: '#2A2724',
    marginBottom: 16,
  },
  breakdownItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EAE6DF',
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  breakdownCategory: {
    fontSize: 16,
    color: '#2A2724',
    fontFamily: 'Quicksand_700Bold',
  },
  breakdownDuration: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Quicksand_600SemiBold',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: '#EAE6DF',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  }
});
