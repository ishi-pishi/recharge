// ScheduleScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Modal,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, subDays, isSameDay } from 'date-fns';
import { saveActivity, fetchActivitiesByDate } from '../config/api';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const CATEGORIES = ['Work', 'Sleep', 'Exercise', 'Socializing', 'Leisure/Self-Care'];
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

export default function ScheduleScreen() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activities, setActivities] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Modals state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [timerModalVisible, setTimerModalVisible] = useState(false);

  // Form State
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Time Picker State
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState('start'); // 'start' or 'end'
  const [tempHour, setTempHour] = useState('09');
  const [tempMinute, setTempMinute] = useState('00');

  // Timer State
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef(null);

  // auth listener (run once)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  // load activities when user or date changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) {
        setActivities([]);
        setLoadingTasks(false);
        return;
      }
      setLoadingTasks(true);
      try {
        const data = await fetchActivitiesByDate(selectedDate);
        if (!cancelled) setActivities(data);
      } catch (err) {
        console.error('Failed to load activities:', err);
        if (!cancelled) setActivities([]);
      } finally {
        if (!cancelled) setLoadingTasks(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, selectedDate]);

  // timer interval
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

  const parseTime = (timeStr) => {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h + (m / 60);
  };

  // save manual activity with optimistic update
  const saveManualActivity = async () => {
    if (!user) {
      alert('You must be signed in to save activities.');
      return;
    }

    setIsSaving(true);

    const sTime = parseTime(startTime);
    const eTime = parseTime(endTime);

    if (sTime === null || eTime === null) {
      alert('Please select valid start and end times.');
      setIsSaving(false);
      return;
    }

    if (eTime <= sTime) {
      alert('End time must be after start time. (Overnight activities are not supported yet)');
      setIsSaving(false);
      return;
    }

    let duration = eTime - sTime;

    const payload = {
      category: selectedCategory,
      startTime,
      endTime,
      durationHours: duration,
      date: selectedDate.toISOString(),
      timestamp: Date.now()
    };

    // Reset and close immediately so the user can see it cleanly closes
    setAddModalVisible(false);
    setStartTime('');
    setEndTime('');

    try {
      console.log('Saving activity:', payload);
      const saved = await saveActivity(payload); // expects { id, ...payload } from API
      console.log('Saved activity:', saved);
      const updatedActivities = await fetchActivitiesByDate(selectedDate);
      console.log("Activities applied to:", updatedActivities);

      if (saved && saved.id) {
        setActivities(prev => [saved, ...prev]);
      } else {
        // fallback: if API returns something else, still append minimal item
        setActivities(prev => [{ id: `${Date.now()}`, ...payload }, ...prev]);
      }
    } catch (err) {
      console.error('Failed to save activity:', err);
      alert('Failed to save activity.');
    } finally {
      setIsSaving(false);
    }
  };

  // save timer activity with optimistic update
  const saveTimerActivity = async () => {
    if (!user) {
      alert('You must be signed in to save activities.');
      return;
    }

    setIsSaving(true);
    const hours = timerSeconds / 3600;
    const payload = {
      category: selectedCategory,
      durationHours: hours,
      date: new Date().toISOString(),
      timestamp: Date.now()
    };

    setTimerModalVisible(false);

    try {
      const saved = await saveActivity(payload);
      if (saved && saved.id) {
        setActivities(prev => [saved, ...prev]);
      } else {
        setActivities(prev => [{ id: `${Date.now()}`, ...payload }, ...prev]);
      }
      setTimerSeconds(0);
      setTimerRunning(false);
    } catch (err) {
      console.error('Failed to save timer activity:', err);
      alert('Failed to save activity.');
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
          <Ionicons name="happy-outline" size={64} color="#555" />
          <Text style={styles.emptyTitle}>Nothing here yet!</Text>
          <Text style={styles.emptySubtitle}>You haven't added any activities for this day.</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={({ item }) => (
            <View style={styles.activityItem}>
              <View style={styles.activityHeader}>
                <Ionicons
                  name={item.category?.includes('Work') ? 'briefcase' : item.category?.includes('Sleep') ? 'moon' : 'fitness'}
                  size={20}
                  color="#FFF"
                />
                <Text style={styles.activityTitle}>{item.category}</Text>
              </View>
              <Text style={styles.activityDuration}>
                {item.startTime ? `${item.startTime} - ${item.endTime} ` : ''}({item.durationHours ? item.durationHours.toFixed(2) : 0} hrs log)
              </Text>
            </View>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

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

            <Text style={styles.label}>Start Time</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                setTimePickerMode('start');
                if (startTime) {
                  const [h, m] = startTime.split(':');
                  setTempHour(h); setTempMinute(m);
                } else {
                  setTempHour('09'); setTempMinute('00');
                }
                setTimePickerVisible(true);
              }}>
              <Text style={{ color: startTime ? '#FFF' : '#666', fontSize: 16 }}>
                {startTime || "Select Start Time"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>End Time</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                setTimePickerMode('end');
                if (endTime) {
                  const [h, m] = endTime.split(':');
                  setTempHour(h); setTempMinute(m);
                } else {
                  setTempHour('10'); setTempMinute('00');
                }
                setTimePickerVisible(true);
              }}>
              <Text style={{ color: endTime ? '#FFF' : '#666', fontSize: 16 }}>
                {endTime || "Select End Time"}
              </Text>
            </TouchableOpacity>

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

            <TouchableOpacity style={{ alignItems: 'center', marginTop: 16 }} onPress={() => { setTimerModalVisible(false); setTimerRunning(false); setTimerSeconds(0); }}>
              <Text style={styles.modalButtonTextSecondary}>Close Timer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={timePickerVisible} animationType="fade" transparent={true}>
        <View style={styles.timePickerOverlay}>
          <View style={styles.timePickerContent}>
            <Text style={styles.modalTitle}>Select {timePickerMode === 'start' ? 'Start' : 'End'} Time</Text>

            <View style={styles.timePickerGrid}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnTitle}>Hour</Text>
                <FlatList
                  data={HOURS}
                  keyExtractor={item => item}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setTempHour(item)} style={[styles.timeOption, tempHour === item && styles.timeOptionSelected]}>
                      <Text style={[styles.timeOptionText, tempHour === item && styles.timeOptionTextSelected]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnTitle}>Minute</Text>
                <FlatList
                  data={MINUTES}
                  keyExtractor={item => item}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setTempMinute(item)} style={[styles.timeOption, tempMinute === item && styles.timeOptionSelected]}>
                      <Text style={[styles.timeOptionText, tempMinute === item && styles.timeOptionTextSelected]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setTimePickerVisible(false)}>
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonPrimary} onPress={() => {
                const time = `${tempHour}:${tempMinute}`;
                if (timePickerMode === 'start') setStartTime(time);
                else setEndTime(time);
                setTimePickerVisible(false);
              }}>
                <Text style={styles.modalButtonTextPrimary}>Confirm</Text>
              </TouchableOpacity>
            </View>
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
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: '#333',
  },
  timePickerGrid: {
    flexDirection: 'row',
    height: 250,
    marginBottom: 24,
    gap: 16,
  },
  timeColumn: {
    flex: 1,
  },
  timeColumnTitle: {
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 14,
    fontWeight: 'bold',
  },
  timeOption: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  timeOptionSelected: {
    backgroundColor: '#333',
  },
  timeOptionText: {
    color: '#FFF',
    fontSize: 18,
  },
  timeOptionTextSelected: {
    color: '#4DA6FF',
    fontWeight: 'bold',
  },
});