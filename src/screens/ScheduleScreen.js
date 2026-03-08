import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, subDays, isSameDay } from 'date-fns';
import { saveActivity, fetchActivitiesByDate } from '../config/api';

const CATEGORIES = ['Work', 'Sleep', 'Exercise', 'Socializing', 'Leisure/Self-Care'];

export default function ScheduleScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activities, setActivities] = useState([]); 
  const [loadingTasks, setLoadingTasks] = useState(false);
  
  // Modals state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  
  // Form State
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [durationHours, setDurationHours] = useState('1');
  const [isSaving, setIsSaving] = useState(false);

  // Timer State
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const loadActivities = async () => {
      setLoadingTasks(true);
      const data = await fetchActivitiesByDate(selectedDate);
      setActivities(data);
      setLoadingTasks(false);
    };
    loadActivities();
  }, [selectedDate]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const formatTimer = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const saveManualActivity = async () => {
    setIsSaving(true);
    const newActivity = {
      category: selectedCategory,
      durationHours: parseFloat(durationHours),
      date: selectedDate.toISOString(),
      timestamp: new Date().getTime()
    };
    try {
      const saved = await saveActivity(newActivity);
      setActivities([saved, ...activities]);
      setAddModalVisible(false);
      setDurationHours('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const saveTimerActivity = async () => {
    setIsSaving(true);
    const hours = timerSeconds / 3600;
    const newActivity = {
      category: selectedCategory,
      durationHours: hours,
      date: new Date().toISOString(),
      timestamp: new Date().getTime()
    };
    try {
      const saved = await saveActivity(newActivity);
      setActivities([saved, ...activities]);
      setTimerModalVisible(false);
      setTimerSeconds(0);
      setTimerRunning(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

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

  return (
    <SafeAreaView style={styles.container}>
      {renderDateSelector()}
      
      {loadingTasks ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color="#333" />
          <Text style={styles.emptyTitle}>No schedule yet</Text>
          <Text style={styles.emptySubtitle}>You haven't tracked anything for this day.</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={({ item }) => (
            <View style={styles.activityItem}>
              <View style={styles.activityHeader}>
                <Ionicons 
                  name={item.category.includes('Work') ? 'briefcase' : item.category.includes('Sleep') ? 'moon' : 'fitness'} 
                  size={20} 
                  color="#FFF" 
                />
                <Text style={styles.activityTitle}>{item.category}</Text>
              </View>
              <Text style={styles.activityDuration}>{item.durationHours.toFixed(2)} hrs log</Text>
            </View>
          )}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fabSecondary} onPress={() => setTimerModalVisible(true)}>
          <Ionicons name="time" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabPrimary} onPress={() => setAddModalVisible(true)}>
          <Ionicons name="add" size={32} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Add Activity Modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Activity</Text>
            
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Duration (Hours)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={durationHours}
              onChangeText={setDurationHours}
              placeholder="e.g. 1.5"
              placeholderTextColor="#666"
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonPrimary} onPress={saveManualActivity} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#000" /> : <Text style={styles.modalButtonTextPrimary}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Timer Modal */}
      <Modal visible={timerModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Live Timer</Text>
            
            <Text style={styles.label}>What are you doing?</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.timerDisplay}>
              <Text style={styles.timerText}>{formatTimer(timerSeconds)}</Text>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity 
                style={[styles.modalButtonPrimary, { backgroundColor: timerRunning ? '#FF3B30' : '#34C759', flex: 1, marginRight: 8 }]} 
                onPress={() => setTimerRunning(!timerRunning)}
              >
                <Text style={styles.modalButtonTextPrimary}>{timerRunning ? 'Stop' : 'Start'}</Text>
              </TouchableOpacity>

              {(!timerRunning && timerSeconds > 0) && (
                <TouchableOpacity style={[styles.modalButtonPrimary, { flex: 1, marginLeft: 8 }]} onPress={saveTimerActivity} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#000" /> : <Text style={styles.modalButtonTextPrimary}>Log Activity</Text>}
                </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity style={{alignItems: 'center', marginTop: 16}} onPress={() => {setTimerModalVisible(false); setTimerRunning(false); setTimerSeconds(0);}}>
              <Text style={styles.modalButtonTextSecondary}>Close Timer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  dateItem: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  dateItemSelected: {
    backgroundColor: '#FFFFFF',
  },
  dateDay: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    fontWeight: '500',
  },
  dateNumber: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: 'bold',
  },
  dateTextSelected: {
    color: '#000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  listContainer: {
    padding: 16,
  },
  activityItem: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  activityDuration: {
    color: '#888',
    fontSize: 14,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  fabPrimary: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#D0D0D0',
    fontWeight: '600',
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 8,
  },
  categoryPill: {
    backgroundColor: '#333',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  categoryPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  categoryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#000',
  },
  input: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 32,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButtonSecondary: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  modalButtonPrimary: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    marginLeft: 8,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  modalButtonTextSecondary: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalButtonTextPrimary: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  timerDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  timerText: {
    fontSize: 64,
    fontWeight: '200',
    color: '#FFF',
    fontVariant: ['tabular-nums'],
  },
});
