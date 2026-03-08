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
import { saveActivity, fetchActivitiesByDate, deleteActivity } from '../config/api';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
export const CATEGORY_INFO = {
  'Work': { emoji: '💼', color: '#C9D6ED' },
  'Sleep': { emoji: '🌙', color: '#D0E5C9' },
  'Exercise': { emoji: '💪', color: '#F2C7AD' },
  'Socializing': { emoji: '🗣️', color: '#F2E1A8' },
  'Discretionary': { emoji: '🧘', color: '#D2D6E8' },
};
const CATEGORIES = Object.keys(CATEGORY_INFO);
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
  const [timerStartTime, setTimerStartTime] = useState(null);
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

  // No live timer interval needed anymore

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

    let duration = eTime - sTime;
    if (duration <= 0) {
      duration = (24 - sTime) + eTime; // handle overnight wrap-around
    }

    const checkOverlap = (s1, e1, s2, e2) => {
      const int1 = s1 < e1 ? [[s1, e1]] : [[s1, 24], [0, e1]];
      const int2 = s2 < e2 ? [[s2, e2]] : [[s2, 24], [0, e2]];
      for (const [aStart, aEnd] of int1) {
        for (const [bStart, bEnd] of int2) {
          if (Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) return true;
        }
      }
      return false;
    };

    const hasOverlap = activities.some(act => {
      if (!act.startTime || !act.endTime) return false;
      const actStart = parseTime(act.startTime);
      const actEnd = parseTime(act.endTime);
      if (actStart === null || actEnd === null) return false;
      return checkOverlap(sTime, eTime, actStart, actEnd);
    });

    if (hasOverlap) {
      alert('This limits overlapping. Please select a time that does not overlap with existing activities.');
      setIsSaving(false);
      return;
    }

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

  // save timer activity with optimistic update and record start/end times
  const saveTimerActivity = async () => {
    if (!user) {
      alert('You must be signed in to save activities.');
      return;
    }

    if (!timerStartTime) return;

    setIsSaving(true);
    const endTime = Date.now();
    const durationMs = endTime - timerStartTime;
    const hours = durationMs / (1000 * 60 * 60);
    
    // Calculate start and end time strings
    const startDate = new Date(timerStartTime);
    const endDate = new Date(endTime);
    const startTimeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
    const endTimeStr = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
    
    const payload = {
      category: selectedCategory,
      startTime: startTimeStr,
      endTime: endTimeStr,
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
      setTimerStartTime(null);
      setTimerRunning(false);
    } catch (err) {
      console.error('Failed to save timer activity:', err);
      alert('Failed to save activity.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteActivity = async (activityId) => {
    try {
      await deleteActivity(activityId);
      setActivities(prev => prev.filter(act => act.id !== activityId));
    } catch (err) {
      console.error('Failed to delete activity:', err);
      alert('Failed to delete activity.');
    }
  };

  const calculateDailySummary = () => {
    const summary = {};
    CATEGORIES.forEach(cat => {
      const dataKey = cat === 'Discretionary' ? 'Leisure/Self-Care' : cat;
      summary[cat] = activities
        .filter(act => act.category === cat || act.category === dataKey)
        .reduce((sum, act) => sum + (act.durationHours || 0), 0);
    });
    return summary;
  };

  const dailySummary = calculateDailySummary();

  const [dateOffset, setDateOffset] = useState(0);

  const renderDateSelector = () => {
    const dates = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 3 - i - dateOffset));
    return (
      <View style={styles.dateSelectorContainer}>
        <TouchableOpacity 
          style={styles.arrowButton}
          onPress={() => setDateOffset(dateOffset + 7)}
        >
          <Ionicons name="chevron-back" size={24} color="#555" />
        </TouchableOpacity>
        <View style={styles.dateSelector}>
          <FlatList
            horizontal
            data={dates}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, idx) => idx.toString()}
            renderItem={({ item: date }) => {
              const isSelected = isSameDay(date, selectedDate);
              return (
                <TouchableOpacity
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
            }}
          />
        </View>
        <TouchableOpacity 
          style={styles.arrowButton}
          onPress={() => setDateOffset(Math.max(0, dateOffset - 7))}
          disabled={dateOffset === 0}
        >
          <Ionicons name="chevron-forward" size={24} color={dateOffset === 0 ? '#CCC' : '#555'} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderDateSelector()}

      {loadingTasks ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#C9D6ED" />
        </View>
      ) : (
        <FlatList
          data={activities}
          ListHeaderComponent={() => (
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Today's Summary</Text>
              <View style={styles.summaryList}>
                {CATEGORIES.map((cat, idx) => (
                  <View key={idx} style={styles.summaryRow}>
                    <Text style={styles.summaryRowCategory}>{cat}</Text>
                    <Text style={styles.summaryRowHours}>{dailySummary[cat].toFixed(1)} hrs</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.activitiesTitle}>Activities</Text>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyActivitiesContainer}>
              <Ionicons name="sunny-outline" size={60} color="#D0E5C9" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyActivitiesText}>No activities logged yet</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={[styles.activityItem, { borderLeftColor: CATEGORY_INFO[item.category]?.color || '#EAE6DF' }]}>
              <View style={styles.activityContent}>
                <View style={styles.activityHeader}>
                  <Ionicons
                    name={
                      item.category?.includes('Work') ? 'briefcase' :
                      item.category?.includes('Sleep') ? 'moon' :
                      item.category?.includes('Exercise') ? 'fitness' :
                      item.category?.includes('Socializing') ? 'chatbubbles' : 'leaf'
                    }
                    size={20}
                    color="#555"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.activityTitle}>{item.category}</Text>
                </View>
                <Text style={styles.activityDuration}>
                  {item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : 'No time recorded'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => handleDeleteActivity(item.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#F2C7AD" />
              </TouchableOpacity>
            </View>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {!timerRunning && (
        <View style={styles.fabContainer}>
          <TouchableOpacity style={styles.fabSecondary} onPress={() => setTimerModalVisible(true)}>
            <Ionicons name="time" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabPrimary} onPress={() => setAddModalVisible(true)}>
            <Ionicons name="add" size={32} color="#000" />
          </TouchableOpacity>
        </View>
      )}

      {timerRunning && (
        <TouchableOpacity 
          style={styles.currentSessionButton}
          onPress={() => setTimerModalVisible(true)}
        >
          <Ionicons name="stop-circle-outline" size={20} color="#3E2723" style={{ marginRight: 8 }} />
          <Text style={styles.currentSessionText}>Current session: {selectedCategory}</Text>
        </TouchableOpacity>
      )}

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
                  style={[styles.categoryPill, selectedCategory === cat && { backgroundColor: CATEGORY_INFO[cat].color }]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                    {CATEGORY_INFO[cat].emoji} {cat}
                  </Text>
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
              <Text style={{ color: startTime ? '#333' : '#999', fontSize: 16, fontWeight: '500' }}>
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
              <Text style={{ color: endTime ? '#333' : '#999', fontSize: 16, fontWeight: '500' }}>
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
      <Modal visible={timerModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{timerRunning ? 'Activity In Progress' : 'Start Activity'}</Text>

            <Text style={styles.label}>What are you doing?</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  disabled={timerRunning}
                  style={[
                    styles.categoryPill,
                    selectedCategory === cat && { backgroundColor: CATEGORY_INFO[cat].color },
                    timerRunning && selectedCategory !== cat && { opacity: 0.3 }
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                    {CATEGORY_INFO[cat].emoji} {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionRow}>
              {!timerRunning ? (
                <TouchableOpacity
                  style={[styles.modalButtonPrimary, { backgroundColor: '#D0E5C9', flex: 1, marginRight: 8 }]}
                  onPress={() => {
                    setTimerStartTime(Date.now());
                    setTimerRunning(true);
                    setTimerModalVisible(false);
                  }}
                >
                  <Text style={styles.modalButtonTextPrimary}>Start Now</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.modalButtonSecondary, { flex: 1, marginRight: 8, borderColor: '#F2C7AD' }]}
                    onPress={() => {
                      setTimerStartTime(null);
                      setTimerRunning(false);
                      setTimerModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalButtonTextSecondary}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButtonPrimary, { flex: 1, marginLeft: 8, backgroundColor: '#F2C7AD' }]}
                    onPress={saveTimerActivity}
                    disabled={isSaving}
                  >
                    {isSaving ? <ActivityIndicator color="#3E2723" /> : <Text style={styles.modalButtonTextPrimary}>Stop & Save</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {!timerRunning && (
              <TouchableOpacity style={{ alignItems: 'center', marginTop: 16 }} onPress={() => setTimerModalVisible(false)}>
                <Text style={styles.modalButtonTextSecondary}>Close</Text>
              </TouchableOpacity>
            )}
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
    backgroundColor: '#FDFBF7',
  },
  currentSessionButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    backgroundColor: '#8CBDB1', // Teal color
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#8CBDB1',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  currentSessionText: {
    color: '#3E2723',
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE6DF',
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: 'Lora_700Bold',
    color: '#3E2723',
  },
  dateSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE6DF',
  },
  arrowButton: {
    paddingHorizontal: 12,
  },
  dateSelector: {
    flex: 1,
  },
  dateItem: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  dateItemSelected: {
    backgroundColor: '#C9D6ED',
  },
  dateDay: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    fontFamily: 'Lora_600SemiBold',
  },
  dateNumber: {
    fontSize: 18,
    color: '#555',
    fontFamily: 'Lora_700Bold',
  },
  dateTextSelected: {
    color: '#3E2723',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: 'Lora_700Bold',
    color: '#3E2723',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#777',
    marginTop: 8,
    fontFamily: 'Lora_500Medium',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  summarySection: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  summaryTitle: {
    fontSize: 20,
    fontFamily: 'Lora_700Bold',
    color: '#3E2723',
    marginBottom: 16,
  },
  summaryList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE6DF',
    marginBottom: 24,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  summaryRowCategory: {
    fontSize: 15,
    fontFamily: 'Quicksand_600SemiBold',
    color: '#3E2723',
  },
  summaryRowHours: {
    fontSize: 16,
    fontFamily: 'Lora_700Bold',
    color: '#555',
  },
  activitiesTitle: {
    fontSize: 18,
    fontFamily: 'Lora_700Bold',
    color: '#3E2723',
    marginTop: 8,
    marginBottom: 12,
  },
  emptyActivitiesContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyActivitiesText: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Lora_500Medium',
  },
  activityItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  activityTitle: {
    color: '#3E2723',
    fontSize: 16,
    fontFamily: 'Quicksand_700Bold',
  },
  activityDuration: {
    color: '#777',
    fontSize: 13,
    fontFamily: 'Quicksand_600SemiBold',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
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
    backgroundColor: '#C9D6ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#C9D6ED',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  fabPrimary: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F2C7AD',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F2C7AD',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FDFBF7',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 48,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 26,
    fontFamily: 'Lora_700Bold',
    color: '#3E2723',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#777',
    fontFamily: 'Quicksand_700Bold',
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 10,
  },
  categoryPill: {
    backgroundColor: '#EAE6DF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  categoryPillActive: {
    backgroundColor: '#7b9ed8',
  },
  categoryText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Quicksand_600SemiBold',
  },
  categoryTextActive: {
    color: '#3E2723', // Because pastel backgrounds are light, use dark text when active
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE6DF',
    borderRadius: 16,
    padding: 16,
    color: '#3E2723',
    fontSize: 16,
    fontFamily: 'Quicksand_500Medium',
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
    borderRadius: 16,
    backgroundColor: '#FDFBF7',
    borderWidth: 1,
    borderColor: '#F2C7AD',
  },
  modalButtonPrimary: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    marginLeft: 8,
    borderRadius: 16,
    backgroundColor: '#D0E5C9',
  },
  modalButtonTextSecondary: {
    color: '#F2C7AD',
    fontFamily: 'Lora_700Bold',
    fontSize: 16,
  },
  modalButtonTextPrimary: {
    color: '#3E2723', // Using dark text for light pastel green button
    fontFamily: 'Lora_700Bold',
    fontSize: 16,
  },
  timerDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  timerText: {
    fontSize: 72,
    fontFamily: 'Nunito_400Regular',
    color: '#2A2724',
    fontVariant: ['tabular-nums'],
  },
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerContent: {
    backgroundColor: '#FDFBF7',
    borderRadius: 24,
    padding: 24,
    width: '85%',
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 30,
    elevation: 10,
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
    backgroundColor: '#EAE6DF',
  },
  timeOptionText: {
    color: '#666',
    fontSize: 18,
    fontFamily: 'Nunito_600SemiBold',
  },
  timeOptionTextSelected: {
    color: '#C9D6ED',
    fontFamily: 'Nunito_700Bold',
  },
});