const CLIENT_ID = 'YOUR_GOOGLE_OAUTH_CLIENT_ID';
const API_KEY = 'YOUR_GOOGLE_API_KEY';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.events.readonly';

const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const eventText = document.getElementById('event_text');
const quickAddButton = document.getElementById('quick_add_button');
const quickAddStatus = document.getElementById('quick_add_status');
const authStatus = document.getElementById('auth_status');
const dateInput = document.getElementById('event_date');
const refreshButton = document.getElementById('refresh_button');
const eventsList = document.getElementById('events_list');

let authInstance = null;

function credentialsConfigured() {
  const missingClient = !CLIENT_ID || CLIENT_ID.includes('YOUR_GOOGLE_OAUTH_CLIENT_ID');
  const missingKey = !API_KEY || API_KEY.includes('YOUR_GOOGLE_API_KEY');
  if (missingClient || missingKey) {
    setAuthStatus('Add your Google API credentials to script.js to enable sign-in.', 'warning');
    authorizeButton.disabled = true;
    return false;
  }
  authorizeButton.disabled = false;
  return true;
}

gapi.load('client:auth2', initClient);

authorizeButton.addEventListener('click', () => {
  if (!authInstance) {
    setAuthStatus('Google client not ready yet. Please wait a moment and try again.', 'error');
    return;
  }
  authInstance.signIn();
});

signoutButton.addEventListener('click', () => {
  if (authInstance) {
    authInstance.signOut();
  }
});

quickAddButton.addEventListener('click', handleQuickAdd);
refreshButton.addEventListener('click', fetchEventsForSelectedDay);
eventText.addEventListener('input', () => {
  if (!eventText.disabled) {
    quickAddButton.disabled = eventText.value.trim().length === 0;
  }
});

dateInput.addEventListener('change', () => {
  if (!dateInput.disabled) {
    fetchEventsForSelectedDay();
  }
});

async function initClient() {
  if (!credentialsConfigured()) {
    return;
  }

  try {
    await gapi.client.init({
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      discoveryDocs: [DISCOVERY_DOC],
      scope: SCOPES,
    });
    authInstance = gapi.auth2.getAuthInstance();
    updateSigninStatus(authInstance.isSignedIn.get());
    authInstance.isSignedIn.listen(updateSigninStatus);
    setAuthStatus('Ready to sign in. Click the button above to connect your Google account.', 'info');
  } catch (err) {
    console.error('Error initializing Google API client', err);
    setAuthStatus('Unable to initialize the Google API client. Check the console for details.', 'error');
  }
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.hidden = true;
    signoutButton.hidden = false;
    setAuthStatus('Connected to Google Calendar.', 'success');
    enableAppControls();
    fetchEventsForSelectedDay();
  } else {
    authorizeButton.hidden = false;
    signoutButton.hidden = true;
    setAuthStatus('You are signed out. Sign in to manage your calendar.', 'info');
    disableAppControls();
    clearEventsList();
  }
}

function enableAppControls() {
  eventText.disabled = false;
  dateInput.disabled = false;
  refreshButton.disabled = false;
  if (!dateInput.value) {
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];
  }
  quickAddButton.disabled = eventText.value.trim().length === 0;
}

function disableAppControls() {
  eventText.disabled = true;
  quickAddButton.disabled = true;
  dateInput.disabled = true;
  refreshButton.disabled = true;
  setQuickAddStatus('');
}

async function handleQuickAdd() {
  const text = eventText.value.trim();
  if (!text) {
    return;
  }

  setQuickAddStatus('Adding event…', 'info');
  quickAddButton.disabled = true;

  try {
    const response = await gapi.client.calendar.events.quickAdd({
      calendarId: 'primary',
      text,
      sendUpdates: 'none',
    });

    eventText.value = '';
    setQuickAddStatus(`Added “${response.result.summary}”.`, 'success');
    fetchEventsForSelectedDay();
  } catch (err) {
    console.error('Quick Add failed', err);
    const message = err.result?.error?.message || 'Unable to add the event. Please try again.';
    setQuickAddStatus(message, 'error');
  } finally {
    quickAddButton.disabled = eventText.value.trim().length === 0;
  }
}

async function fetchEventsForSelectedDay() {
  if (dateInput.disabled || !dateInput.value) {
    return;
  }

  setEventsListLoading();

  const start = new Date(`${dateInput.value}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  try {
    const response = await gapi.client.calendar.events.list({
      calendarId: 'primary',
      singleEvents: true,
      orderBy: 'startTime',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      showDeleted: false,
    });

    renderEvents(response.result.items || []);
  } catch (err) {
    console.error('Fetching events failed', err);
    eventsList.innerHTML = '<li class="empty-state">Unable to load events. Check the console for details.</li>';
  }
}

function renderEvents(events) {
  eventsList.innerHTML = '';

  if (!events.length) {
    eventsList.innerHTML = '<li class="empty-state">No events scheduled for this day.</li>';
    return;
  }

  const fragment = document.createDocumentFragment();
  events.forEach((event) => {
    const li = document.createElement('li');

    const title = document.createElement('div');
    title.className = 'event-title';
    title.textContent = event.summary || 'Untitled event';

    const time = document.createElement('div');
    time.className = 'event-time';
    time.textContent = formatEventTime(event);

    const location = document.createElement('div');
    location.className = 'event-location';
    if (event.location) {
      location.textContent = event.location;
    }

    li.append(title, time);

    if (event.location) {
      li.appendChild(location);
    }

    if (event.hangoutLink) {
      const meetingLink = document.createElement('a');
      meetingLink.href = event.hangoutLink;
      meetingLink.target = '_blank';
      meetingLink.rel = 'noopener';
      meetingLink.textContent = 'Join meeting';
      li.appendChild(meetingLink);
    }

    fragment.appendChild(li);
  });

  eventsList.appendChild(fragment);
}

function formatEventTime(event) {
  const { start, end } = event;
  if (!start) {
    return 'Time unavailable';
  }

  const startDate = start.dateTime ? new Date(start.dateTime) : new Date(start.date);
  const endDate = end?.dateTime ? new Date(end.dateTime) : end?.date ? new Date(end.date) : null;

  if (!start.dateTime) {
    return 'All-day event';
  }

  const timeFormatter = new Intl.DateTimeFormat([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const dateFormatter = new Intl.DateTimeFormat([], {
    month: 'short',
    day: 'numeric',
  });

  const startStr = `${dateFormatter.format(startDate)} · ${timeFormatter.format(startDate)}`;

  if (endDate) {
    const endStr = timeFormatter.format(endDate);
    return `${startStr} – ${endStr}`;
  }

  return startStr;
}

function setQuickAddStatus(message, state = 'info') {
  quickAddStatus.textContent = message;
  quickAddStatus.dataset.state = state;
}

function setAuthStatus(message, state = 'info') {
  authStatus.textContent = message;
  authStatus.dataset.state = state;
}

function setEventsListLoading() {
  eventsList.innerHTML = '<li class="empty-state">Loading events…</li>';
}

function clearEventsList() {
  eventsList.innerHTML = '';
}
