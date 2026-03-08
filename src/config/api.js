import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from './firebase';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export const saveActivity = async (activityData) => {
  if (!auth.currentUser) throw new Error("User not authenticated");
  
  try {
    const docRef = await addDoc(collection(db, 'activities'), {
      ...activityData,
      userId: auth.currentUser.uid,
    });
    return { id: docRef.id, ...activityData };
  } catch (error) {
    console.error("Error saving activity:", error);
    throw error;
  }
};

export const fetchActivitiesByDate = async (date) => {
  if (!auth.currentUser) return [];

  const start = startOfDay(date).toISOString();
  const end = endOfDay(date).toISOString();

  try {
    const q = query(
      collection(db, 'activities'),
      where('userId', '==', auth.currentUser.uid),
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching activities:", error);
    return [];
  }
};

export const fetchLast7DaysActivities = async () => {
  if (!auth.currentUser) return [];

  const end = endOfDay(new Date()).toISOString();
  const start = startOfDay(subDays(new Date(), 6)).toISOString();

  try {
    const q = query(
      collection(db, 'activities'),
      where('userId', '==', auth.currentUser.uid),
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching 7 days activities:", error);
    return [];
  }
};
