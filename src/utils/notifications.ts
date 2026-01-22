import * as Notifications from "expo-notifications";
import {
  getFollowUpsDue,
  getPeopleForCity,
  getTripReachouts,
  getUpcomingTrips,
} from "../db/database";

export async function requestNotifPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === "granted";
}

export async function cancelAllScheduledNotifs() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

async function getPendingReachoutsForSoonestTrip() {
  const nowIso = new Date().toISOString();
  const upcoming = await getUpcomingTrips(nowIso);
  if (upcoming.length === 0) {
    return { trip: null as null | { id: string; city: string; startDate: string }, pending: 0 };
  }
  const trip = upcoming[0];
  const people = await getPeopleForCity(trip.city);
  const reachouts = await getTripReachouts(trip.id);
  const doneSet = new Set(
    reachouts.filter((r) => r.status === "done").map((r) => r.personId)
  );
  const pending = people.filter((p) => !doneSet.has(p.id)).length;
  return { trip: { id: trip.id, city: trip.city, startDate: trip.startDate }, pending };
}

export async function scheduleDailySummary(hour: number, minute: number) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const due = await getFollowUpsDue(endOfDay.toISOString());
  const dueToday = due.filter((item) => {
    if (!item.note.followUpAt) {
      return false;
    }
    const when = new Date(item.note.followUpAt).getTime();
    return when >= startOfDay.getTime() && when <= endOfDay.getTime();
  }).length;

  const { trip, pending } = await getPendingReachoutsForSoonestTrip();
  const body = trip
    ? `Follow-ups today: ${dueToday}. Trip reach-outs: ${pending}.`
    : `Follow-ups today: ${dueToday}.`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Daily summary",
      body,
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function scheduleTripReminders() {
  const { trip, pending } = await getPendingReachoutsForSoonestTrip();
  if (!trip) {
    return;
  }

  const startDate = new Date(trip.startDate);
  const offsets = [7, 3, 1];
  for (const daysBefore of offsets) {
    const target = new Date(startDate);
    target.setDate(target.getDate() - daysBefore);
    target.setHours(10, 0, 0, 0);
    if (target.getTime() <= Date.now()) {
      continue;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Trip reminder",
        body: `${trip.city} in ${daysBefore} days — reach out to ${pending} people`,
      },
      trigger: target,
    });
  }
}
