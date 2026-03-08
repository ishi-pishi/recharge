// api.js
import { collection, addDoc, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

/**
 * Save activity.
 * Adds:
 *  - userId
 *  - date (ISO string)
 *  - dateTs (Firestore Timestamp)
 *  - dayKey (yyyy-MM-dd)
 *  - timestamp (ms since epoch) for cheap sorting
 *
 * Returns the saved doc object: { id, ...payload }
 */
export const saveActivity = async (activityData) => {
  if (!auth.currentUser) throw new Error('User not authenticated');

  try {
    // normalize date
    const dateObj = activityData.date ? new Date(activityData.date) : new Date();
    const dateIso = dateObj.toISOString();
    const dateTs = Timestamp.fromDate(dateObj);
    const dayKey = format(dateObj, 'yyyy-MM-dd');
    const nowMs = Date.now();

    const payload = {
      ...activityData,
      userId: auth.currentUser.uid,
      date: dateIso,
      dateTs,
      dayKey,
      timestamp: nowMs,
    };

    const docRef = await addDoc(collection(db, 'activities'), payload);

    return { id: docRef.id, ...payload };
  } catch (error) {
    console.error('Error saving activity:', error);
    throw error;
  }
};

export const fetchActivitiesByDate = async (date) => {
  if (!auth.currentUser) return [];

  const uid = auth.currentUser.uid;
  const dayKey = format(date, 'yyyy-MM-dd');

  try {
    const q = query(
      collection(db, 'activities'),
      where('userId', '==', uid),
      where('dayKey', '==', dayKey)
    );

    const querySnapshot = await getDocs(q);
    const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return docs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching activities by date:', error);
    return [];
  }
};

export const fetchLast7DaysActivities = async () => {
  if (!auth.currentUser) return [];

  const uid = auth.currentUser.uid;
  // Use dayKey exact matches for last 7 days to avoid index requirements
  const days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'));

  try {
    const q = query(
      collection(db, 'activities'),
      where('userId', '==', uid),
      where('dayKey', 'in', days)
    );

    const querySnapshot = await getDocs(q);
    const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return docs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching 7 days activities:', error);
    return [];
  }
};