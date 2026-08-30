/**
 * WeatherGPT - Core Application Controller (Landscape Viewport Architecture)
 * Synchronizes live Open-Meteo atmospheric telemetry with the left panel
 * and orchestrates AI Activity Reasoning within the right chat stream.
 */

// Application State
const appState = {
  currentCity: 'Delhi',
  activeWeatherData: null,
  soundEnabled: true,
  isProcessing: false
};

// DOM References
let leftPanel;
let heroActionBtn;
let illustrationArea;
let artSunEl;
let artCloudEl;
let precipLayerEl;

let telemetryHumidity;
let telemetryWind;
let telemetryUv;

let chatMessagesContainer;
let hotkeysBar;
let chatForm;
let chatInput;
let sendBtn;

document.addEventListener('DOMContentLoaded', () => {
  initDOM();
  initAudio();
  initEvents();
  loadInitialConversation();
});

function initDOM() {
  leftPanel = document.getElementById('left-panel');
  heroActionBtn = document.getElementById('hero-action-btn');
  illustrationArea = document.getElementById('illustration-area');
  artSunEl = document.getElementById('art-sun');
  artCloudEl = document.getElementById('art-cloud');
  precipLayerEl = document.getElementById('precip-layer');

  telemetryHumidity = document.getElementById('telemetry-humidity');
  telemetryWind = document.getElementById('telemetry-wind');
  telemetryUv = document.getElementById('telemetry-uv');

  chatMessagesContainer = document.getElementById('chat-messages');
  hotkeysBar = document.getElementById('hotkeys-bar');
  chatForm = document.getElementById('chat-form');
  chatInput = document.getElementById('chat-input');
  sendBtn = document.getElementById('send-btn');
}

function initEvents() {
  // Input form submission
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleUserSubmit();
    });
  }

  // Hotkey pill clicks
  if (hotkeysBar) {
    hotkeysBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.hotkey-pill');
      if (!btn) return;
      const city = btn.getAttribute('data-city');
      if (city) {
        handleUserQuery(`Weather in ${city}`);
      }
    });
  }

  // Top action button toggle
  if (heroActionBtn) {
    heroActionBtn.addEventListener('click', () => {
      appState.soundEnabled = !appState.soundEnabled;
      playAudio('receive');
      heroActionBtn.style.transform = 'scale(0.9)';
      setTimeout(() => { heroActionBtn.style.transform = ''; }, 150);
    });
  }
}

// -------------------------------------------------------------
// Audio Synthesis (Web Audio API)
// -------------------------------------------------------------
let audioCtx;
function initAudio() {
  try {
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (AudioClass) audioCtx = new AudioClass();
  } catch (err) {
    console.warn('Audio context skipped');
  }
}

function playAudio(type) {
  if (!appState.soundEnabled || !audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'send') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(860, now + 0.07);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.07);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch (e) {
    // Ignore audio glitches
  }
}

// -------------------------------------------------------------
// Message Stream & Bubble Rendering
// -------------------------------------------------------------
function getFormattedTime() {
  const date = new Date();
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutes} ${ampm}`;
}

function scrollToBottom() {
  if (chatMessagesContainer) {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }
}

function appendBotBubble(text, customTime = null, verdictCard = null) {
  const row = document.createElement('div');
  row.className = 'chat-message-row bot';
  const time = customTime || getFormattedTime();

  let verdictHTML = '';
  if (verdictCard) {
    const cardClass = verdictCard.status === 'success' 
      ? 'verdict-success' 
      : (verdictCard.status === 'warning' ? 'verdict-warning' : (verdictCard.status === 'danger' ? 'verdict-danger' : ''));

    verdictHTML = `
      <div class="verdict-card ${cardClass}">
        <div class="verdict-header">${verdictCard.verdict}</div>
        <div>${formatMarkdown(verdictCard.reasoning)}</div>
        <div class="verdict-metrics-bar">${formatMarkdown(verdictCard.metrics)}</div>
      </div>
    `;
  }

  row.innerHTML = `
    <div class="chat-bubble">
      ${formatMarkdown(text)}
      ${verdictHTML}
      <span class="bubble-timestamp">${time}</span>
    </div>
  `;

  chatMessagesContainer.appendChild(row);
  scrollToBottom();
}

function appendUserBubble(text, customTime = null) {
  const row = document.createElement('div');
  row.className = 'chat-message-row user';
  const time = customTime || getFormattedTime();

  row.innerHTML = `
    <div class="chat-bubble">
      ${escapeHTML(text)}
      <span class="bubble-timestamp">${time}</span>
    </div>
  `;

  chatMessagesContainer.appendChild(row);
  playAudio('send');
  scrollToBottom();
}

function showTypingIndicator() {
  if (document.getElementById('typing-row')) return;
  const row = document.createElement('div');
  row.className = 'chat-message-row bot';
  row.id = 'typing-row';
  row.innerHTML = `
    <div class="typing-bubble">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  chatMessagesContainer.appendChild(row);
  scrollToBottom();
}

function hideTypingIndicator() {
  const row = document.getElementById('typing-row');
  if (row) row.remove();
}

// -------------------------------------------------------------
// Left Panel Telemetry & Dynamic Artwork Synchronization
// -------------------------------------------------------------
function syncLeftTelemetry(data) {
  if (!data) return;
  const c = data.current;
  const loc = data.location;

  // 1. Update 3-Column Telemetry Bar
  if (telemetryHumidity) telemetryHumidity.textContent = `${c.humidity}%`;
  if (telemetryWind) telemetryWind.textContent = `${c.windKmh} km/h`;
  if (telemetryUv) telemetryUv.textContent = `${c.uvCategory}`;

  // 2. Update Active Hot-Key Pill
  document.querySelectorAll('.hotkey-pill').forEach(pill => {
    const pCity = (pill.getAttribute('data-city') || '').toLowerCase();
    const cName = (loc.name || '').toLowerCase();
    if (pCity === cName || cName.includes(pCity)) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  // 3. Update Left Panel Theme & Atmospheric Artwork
  updateLeftAtmosphere(c.theme, c.windKmh, c.precipitationMm);
}

function updateLeftAtmosphere(theme, windKmh, precipMm) {
  if (!leftPanel) return;

  // Set theme class on left panel
  leftPanel.className = 'left-atmospheric-panel';
  leftPanel.classList.add(`theme-${theme}`);

  // Clear precipitation
  if (precipLayerEl) precipLayerEl.innerHTML = '';

  if (theme === 'rainy' || precipMm > 0.4) {
    for (let i = 0; i < 24; i++) {
      const drop = document.createElement('div');
      drop.className = 'raindrop';
      drop.style.left = `${Math.random() * 100}%`;
      drop.style.animationDelay = `${Math.random() * 0.65}s`;
      drop.style.animationDuration = `${0.5 + Math.random() * 0.3}s`;
      precipLayerEl.appendChild(drop);
    }
    if (artSunEl) artSunEl.style.opacity = '0.35';
    if (artCloudEl) {
      artCloudEl.style.opacity = '1';
      artCloudEl.style.transform = 'translateX(-30px) scale(1.15)';
    }
  } else if (theme === 'cold') {
    if (artSunEl) artSunEl.style.opacity = '0.7';
    if (artCloudEl) artCloudEl.style.opacity = '0.9';
  } else if (theme === 'cloudy') {
    if (artSunEl) artSunEl.style.opacity = '0.6';
    if (artCloudEl) {
      artCloudEl.style.opacity = '0.95';
      artCloudEl.style.transform = 'translateX(-20px) scale(1.1)';
    }
  } else {
    // Sunny default
    if (artSunEl) {
      artSunEl.style.opacity = '1';
      artSunEl.style.transform = 'scale(1)';
    }
    if (artCloudEl) {
      artCloudEl.style.opacity = '0.85';
      artCloudEl.style.transform = 'translateX(0) scale(1)';
    }
  }
}

// -------------------------------------------------------------
// Query Handler with Live Open-Meteo API & Activity Reasoning
// -------------------------------------------------------------
function handleUserSubmit() {
  if (!chatInput) return;
  const query = chatInput.value.trim();
  if (!query) return;
  chatInput.value = '';
  handleUserQuery(query);
}

async function handleUserQuery(query) {
  if (appState.isProcessing) return;
  appState.isProcessing = true;

  appendUserBubble(query);
  showTypingIndicator();

  try {
    // 1. Check if a city is explicitly mentioned
    const extractedCity = extractCityName(query);
    let targetCity = extractedCity || appState.currentCity;

    // Fetch live weather data from Open-Meteo
    let weatherData = await window.getCompleteLiveWeatherData(targetCity);
    
    // If not found, fallback to active city
    if (!weatherData && appState.activeWeatherData) {
      weatherData = appState.activeWeatherData;
    }

    if (weatherData) {
      appState.activeWeatherData = weatherData;
      appState.currentCity = weatherData.location.name;
      syncLeftTelemetry(weatherData);
    }

    // 2. Identify Intent & Perform AI Activity Reasoning
    const intent = window.ActivityReasoningEngine.detectIntent(query);
    let reasoning = null;
    let mainResponse = "";

    if (weatherData) {
      reasoning = window.ActivityReasoningEngine.evaluateActivity(intent, weatherData);
      if (intent === 'general') {
        mainResponse = `${weatherData.location.name} is currently ${weatherData.current.tempC}°C and ${weatherData.current.condition.toLowerCase()}. ${reasoning.reasoning}`;
        reasoning = null; // Clean text output for general queries
      } else {
        mainResponse = `Here is my atmospheric analysis for **${weatherData.location.name}**:`;
      }
    } else {
      mainResponse = `Scanning orbital satellite radar for "${targetCity}"... Radar is synchronizing regional atmospheric telemetry! Try querying Mumbai, Delhi, Bengaluru, Chennai, or Kolkata.`;
    }

    // Artificial realistic delay
    setTimeout(() => {
      hideTypingIndicator();
      appendBotBubble(mainResponse, null, reasoning);
      playAudio('receive');
      appState.isProcessing = false;
    }, 450);

  } catch (err) {
    console.error("Query processing error:", err);
    hideTypingIndicator();
    appendBotBubble(`Encountered a momentary satellite sync delay. Please try querying a major city name.`);
    appState.isProcessing = false;
  }
}

function extractCityName(query) {
  const clean = query.trim();

  // Pattern: "in [City]", "for [City]"
  const matchIn = clean.match(/\b(?:in|for|at|around|of)\s+([A-Za-z\s]+?)(?:\?|\!|\.|\b(?:today|tomorrow|now|tonight|right now)\b|$)/i);
  if (matchIn && matchIn[1]) {
    const candidate = matchIn[1].trim();
    if (candidate.length > 2 && !isStopWord(candidate)) {
      return candidate;
    }
  }

  // Check if entire query is a city
  const words = clean.split(/\s+/);
  if (words.length <= 3 && !query.includes('?') && !isActivityWord(clean)) {
    return clean;
  }

  return null;
}

function isStopWord(w) {
  const stops = ['a walk', 'a kite', 'fishing', 'my car', 'the car', 'laundry', 'cycling', 'a run', 'clothes', 'today', 'now'];
  return stops.some(s => w.toLowerCase() === s);
}

function isActivityWord(t) {
  const q = t.toLowerCase();
  return q.includes('kite') || q.includes('walk') || q.includes('fish') || q.includes('wash') || q.includes('laundry') || q.includes('run') || q.includes('cycle');
}

// -------------------------------------------------------------
// Initial Screenshot Conversation Setup
// -------------------------------------------------------------
function loadInitialConversation() {
  // Set default telemetry for Delhi
  if (telemetryHumidity) telemetryHumidity.textContent = '25%';
  if (telemetryWind) telemetryWind.textContent = '15 km/h';
  if (telemetryUv) telemetryUv.textContent = 'Extreme';

  // Single introductory welcoming greeting
  appendBotBubble(
    "Namaste! Welcome to WeatherGPT India. Type any major Indian city name (e.g. Mumbai, Delhi, Bengaluru, Chennai, Kolkata) to query regional climate conditions and smart recommendations!",
    "11:11 AM"
  );

  // Fetch live background data for Delhi so subsequent activity questions use live data immediately
  window.getCompleteLiveWeatherData('Delhi').then(data => {
    if (data) {
      appState.activeWeatherData = data;
      appState.currentCity = data.location.name;
    }
  }).catch(() => {});
}

function formatMarkdown(str) {
  if (!str) return '';
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
