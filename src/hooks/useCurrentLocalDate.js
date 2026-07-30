import { useEffect, useState } from "react";

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function millisecondsUntilNextLocalDay(date = new Date()) {
  const nextDay = new Date(date);
  nextDay.setHours(24, 0, 0, 50);
  return Math.max(250, nextDay.getTime() - date.getTime());
}

export function resolveSelectedMenuDate({
  currentDate = "",
  previousCurrentDate = "",
  selectedDate = "",
  requestedDate = "",
  previousRequestedDate = "",
} = {}) {
  if (requestedDate) return requestedDate;
  if (previousRequestedDate) return currentDate || selectedDate;
  if (
    currentDate &&
    previousCurrentDate &&
    currentDate !== previousCurrentDate &&
    selectedDate === previousCurrentDate
  ) {
    return currentDate;
  }
  return selectedDate || currentDate;
}

export function useCurrentLocalDate() {
  const [currentDate, setCurrentDate] = useState(() => localDateKey());

  useEffect(() => {
    let timerId = null;

    function scheduleNextDayCheck() {
      if (timerId !== null) window.clearTimeout(timerId);
      timerId = window.setTimeout(syncCurrentDate, millisecondsUntilNextLocalDay());
    }

    function syncCurrentDate() {
      const nextDate = localDateKey();
      setCurrentDate((current) => current === nextDate ? current : nextDate);
      scheduleNextDayCheck();
    }

    function handleVisibilityChange() {
      if (!document.hidden) syncCurrentDate();
    }

    scheduleNextDayCheck();
    window.addEventListener("focus", syncCurrentDate);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerId !== null) window.clearTimeout(timerId);
      window.removeEventListener("focus", syncCurrentDate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return currentDate;
}
