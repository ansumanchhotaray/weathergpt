/**
 * WeatherGPT 2.0 - Live Weather & AI Activity Reasoning Engine
 * Connects to Open-Meteo Global Meteorological API (No API keys required)
 * and performs advanced multi-variable activity viability reasoning.
 */

// WMO Weather Interpretation Codes (WW)
const WMO_CODE_MAP = {
  0: { description: "Clear Sky", icon: "sun", theme: "sunny" },
  1: { description: "Mainly Clear", icon: "sun", theme: "sunny" },
  2: { description: "Partly Cloudy", icon: "cloud-sun", theme: "cloudy" },
  3: { description: "Overcast", icon: "cloud", theme: "cloudy" },
  45: { description: "Foggy & Misty", icon: "cloud-fog", theme: "cloudy" },
  48: { description: "Depositing Rime Fog", icon: "cloud-fog", theme: "cloudy" },
  51: { description: "Light Drizzle", icon: "cloud-drizzle", theme: "rainy" },
  53: { description: "Moderate Drizzle", icon: "cloud-drizzle", theme: "rainy" },
  55: { description: "Dense Drizzle", icon: "cloud-rain", theme: "rainy" },
  56: { description: "Freezing Drizzle", icon: "snowflake", theme: "cold" },
  57: { description: "Dense Freezing Drizzle", icon: "snowflake", theme: "cold" },
  61: { description: "Slight Rain", icon: "cloud-rain", theme: "rainy" },
  63: { description: "Moderate Rain", icon: "cloud-rain", theme: "rainy" },
  65: { description: "Heavy Rain Showers", icon: "cloud-rain", theme: "rainy" },
  66: { description: "Freezing Rain", icon: "snowflake", theme: "cold" },
  67: { description: "Heavy Freezing Rain", icon: "snowflake", theme: "cold" },
  71: { description: "Slight Snow Fall", icon: "snowflake", theme: "cold" },
  73: { description: "Moderate Snow Fall", icon: "snowflake", theme: "cold" },
  75: { description: "Heavy Snow Fall", icon: "snowflake", theme: "cold" },
  77: { description: "Snow Grains", icon: "snowflake", theme: "cold" },
  80: { description: "Slight Rain Showers", icon: "cloud-rain", theme: "rainy" },
  81: { description: "Moderate Rain Showers", icon: "cloud-rain", theme: "rainy" },
  82: { description: "Violent Rain Showers", icon: "cloud-lightning", theme: "rainy" },
  85: { description: "Slight Snow Showers", icon: "snowflake", theme: "cold" },
  86: { description: "Heavy Snow Showers", icon: "snowflake", theme: "cold" },
  95: { description: "Thunderstorm", icon: "cloud-lightning", theme: "rainy" },
  96: { description: "Thunderstorm with Slight Hail", icon: "cloud-lightning", theme: "rainy" },
  99: { description: "Thunderstorm with Heavy Hail", icon: "cloud-lightning", theme: "rainy" }
};

/**
 * Converts wind degrees (0-360) to compass direction
 */
function getWindCompass(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((degrees % 360) / 22.5) % 16;
  return directions[index];
}

/**
 * Categorizes UV index rating
 */
function getUVCategory(uv) {
  if (uv <= 2.9) return { label: "Low", class: "uv-low" };
  if (uv <= 5.9) return { label: "Moderate", class: "uv-mod" };
  if (uv <= 7.9) return { label: "High", class: "uv-high" };
  if (uv <= 10.9) return { label: "Very High", class: "uv-vhigh" };
  return { label: "Extreme", class: "uv-extreme" };
}

/**
 * Live Geocoding API from Open-Meteo
 */
async function geocodeCity(cityName) {
  if (!cityName || cityName.trim().length === 0) return null;
  const cleanName = cityName.trim();
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanName)}&count=1&language=en&format=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geocoding failed: ${res.statusText}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const loc = data.results[0];
      return {
        name: loc.name,
        country: loc.country || '',
        admin1: loc.admin1 || '',
        lat: loc.latitude,
        lon: loc.longitude,
        timezone: loc.timezone || 'auto'
      };
    }
  } catch (err) {
    console.error("Geocoding error:", err);
  }
  return null;
}

/**
 * Live Weather API from Open-Meteo
 */
async function fetchLiveWeather(lat, lon, timezone = 'auto') {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,uv_index&hourly=temperature_2m,precipitation_probability,rain,surface_pressure,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=${encodeURIComponent(timezone)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error("Weather fetch error:", err);
    return null;
  }
}

/**
 * Combined pipeline: Geocodes city and returns structured live atmospheric telemetry
 */
async function getCompleteLiveWeatherData(cityName) {
  const geo = await geocodeCity(cityName);
  if (!geo) return null;

  const raw = await fetchLiveWeather(geo.lat, geo.lon, geo.timezone);
  if (!raw || !raw.current) return null;

  const current = raw.current;
  const wCode = current.weather_code || 0;
  const wmoInfo = WMO_CODE_MAP[wCode] || { description: "Clear Sky", icon: "sun", theme: "sunny" };
  const uvCat = getUVCategory(current.uv_index || 0);
  const windDir = getWindCompass(current.wind_direction_10m || 0);

  // Parse upcoming 24h precipitation probability
  let maxRainProbNext24h = 0;
  if (raw.hourly && raw.hourly.precipitation_probability) {
    const next24 = raw.hourly.precipitation_probability.slice(0, 24);
    maxRainProbNext24h = Math.max(...next24);
  } else if (raw.daily && raw.daily.precipitation_probability_max) {
    maxRainProbNext24h = raw.daily.precipitation_probability_max[0] || 0;
  }

  // Parse 3-day daily forecast
  const forecast = [];
  if (raw.daily && raw.daily.time) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let i = 1; i <= 3 && i < raw.daily.time.length; i++) {
      const dateObj = new Date(raw.daily.time[i]);
      const dayName = i === 1 ? 'Tomorrow' : days[dateObj.getDay()];
      const dCode = raw.daily.weather_code[i] || 0;
      const dWmo = WMO_CODE_MAP[dCode] || { description: "Clear", icon: "sun" };
      forecast.push({
        day: dayName,
        tempMax: Math.round(raw.daily.temperature_2m_max[i]),
        tempMin: Math.round(raw.daily.temperature_2m_min[i]),
        condition: dWmo.description,
        icon: dWmo.icon,
        rainProb: raw.daily.precipitation_probability_max ? raw.daily.precipitation_probability_max[i] : 0
      });
    }
  }

  return {
    location: {
      name: geo.name,
      country: geo.country,
      admin1: geo.admin1,
      lat: geo.lat,
      lon: geo.lon
    },
    current: {
      tempC: Math.round(current.temperature_2m),
      feelsLikeC: Math.round(current.apparent_temperature),
      condition: wmoInfo.description,
      theme: wmoInfo.theme,
      icon: wmoInfo.icon,
      humidity: Math.round(current.relative_humidity_2m),
      windKmh: Math.round(current.wind_speed_10m),
      windDirection: `${windDir} (${current.wind_direction_10m}°)`,
      windCompass: windDir,
      surfacePressureHpa: Math.round(current.surface_pressure),
      uvIndex: Number((current.uv_index || 0).toFixed(1)),
      uvCategory: uvCat.label,
      isDay: current.is_day === 1,
      precipitationMm: current.precipitation || 0
    },
    upcoming24h: {
      maxRainProbability: maxRainProbNext24h,
      rainExpected: maxRainProbNext24h >= 40 || current.precipitation > 0.5
    },
    forecast: forecast
  };
}

// -------------------------------------------------------------
// Advanced AI Activity Reasoning Engine
// -------------------------------------------------------------

const ActivityReasoningEngine = {
  /**
   * Identifies specific activity intents in user queries
   */
  detectIntent(query) {
    const q = query.toLowerCase();

    if (q.includes('kite') || q.includes('fly a kite') || q.includes('flying kite')) return 'kite';
    if (q.includes('walk') || q.includes('jog') || q.includes('run') || q.includes('stroll') || q.includes('hiking') || q.includes('trek')) return 'walk';
    if (q.includes('fish') || q.includes('fishing') || q.includes('boat') || q.includes('boating') || q.includes('sailing')) return 'fishing';
    if (q.includes('wash my car') || q.includes('car wash') || q.includes('wash the car') || q.includes('cleaning car')) return 'car_wash';
    if (q.includes('laundry') || q.includes('dry clothes') || q.includes('hang clothes') || q.includes('drying clothes')) return 'laundry';
    if (q.includes('cycle') || q.includes('cycling') || q.includes('bike') || q.includes('biking') || q.includes('bicycle')) return 'cycling';
    if (q.includes('stargaz') || q.includes('telescope') || q.includes('night sky') || q.includes('astronomy') || q.includes('stars')) return 'stargazing';
    if (q.includes('swim') || q.includes('beach') || q.includes('pool') || q.includes('sunbath')) return 'beach';
    if (q.includes('wear') || q.includes('clothing') || q.includes('outfit') || q.includes('dress') || q.includes('jacket')) return 'clothing';

    return 'general';
  },

  /**
   * Synthesizes reasoning based on real atmospheric variables
   */
  evaluateActivity(intent, weatherData) {
    const c = weatherData.current;
    const loc = weatherData.location;
    const up24 = weatherData.upcoming24h;

    switch (intent) {
      case 'kite': {
        // Kite Flying evaluation: Wind between 8 - 25 km/h is ideal. Rain or storms fail.
        const wind = c.windKmh;
        const isRaining = c.precipitationMm > 0.1 || c.condition.toLowerCase().includes('rain') || c.condition.toLowerCase().includes('thunderstorm');

        if (isRaining) {
          return {
            verdict: "🔴 Not Recommended (Rain / Storms)",
            status: "danger",
            title: "Dangerous for Kite Flying",
            reasoning: `Active precipitation (${c.condition}) in **${loc.name}** makes flying unsafe and ruins kite materials. Wait for clear skies!`,
            metrics: `Wind: **${wind} km/h** | Rain: **${c.precipitationMm} mm**`
          };
        }
        if (wind < 7) {
          return {
            verdict: "🟡 Too Calm (< 7 km/h)",
            status: "warning",
            title: "Insufficient Wind for Kites",
            reasoning: `Wind speed in **${loc.name}** is only **${wind} km/h** (${c.windCompass}). Standard dual-line and diamond kites need at least 8-10 km/h to sustain lift. You would need an ultra-light indoor/zero-wind kite.`,
            metrics: `Wind Speed: **${wind} km/h** (Needs > 8 km/h)`
          };
        }
        if (wind > 28) {
          return {
            verdict: "🔴 Dangerously Gusty (> 28 km/h)",
            status: "danger",
            title: "Excessive Wind Speeds",
            reasoning: `Wind in **${loc.name}** is gusting at **${wind} km/h** (${c.windCompass}). Strong turbulence can snap lines, damage kites, and create hazard hazards in open parks.`,
            metrics: `Wind Speed: **${wind} km/h** (Safe Max: 25 km/h)`
          };
        }
        return {
          verdict: "🟢 Ideal Conditions (8 - 25 km/h)",
          status: "success",
          title: "Perfect Time for Kite Flying!",
          reasoning: `Wind is blowing steadily at **${wind} km/h** from the **${c.windCompass}** under **${c.condition}** skies. This provides steady, smooth aerodynamic lift without turbulence!`,
          metrics: `Wind Speed: **${wind} km/h** • Direction: **${c.windCompass}** • Rain Risk: **${up24.maxRainProbability}%**`
        };
      }

      case 'walk': {
        // Walking evaluation: 14°C - 28°C ideal, rain risk, heat index, UV
        const temp = c.tempC;
        const rainProb = up24.maxRainProbability;
        const uv = c.uvIndex;

        if (rainProb >= 50 || c.precipitationMm > 0.5) {
          return {
            verdict: "🔴 High Rain Risk",
            status: "danger",
            title: "Carry Rain Gear or Stay Indoors",
            reasoning: `Currently **${c.condition}** in **${loc.name}** with a **${rainProb}%** chance of rain in the coming hours. Wet sidewalks and showers are expected.`,
            metrics: `Temp: **${temp}°C** | Rain Probability: **${rainProb}%** | UV: **${uv}**`
          };
        }
        if (temp > 35) {
          return {
            verdict: "🟡 Intense Heat Warning",
            status: "warning",
            title: "High Heat Advisory for Walks",
            reasoning: `Temperature is scorching at **${temp}°C** (Feels like **${c.feelsLikeC}°C**) with **${c.uvCategory} UV (${uv})**. If heading out, carry water, wear a sunhat, and prefer shaded parks.`,
            metrics: `Temp: **${temp}°C** • UV Index: **${uv} (${c.uvCategory})**`
          };
        }
        if (temp < 2) {
          return {
            verdict: "🟡 Freezing Chill",
            status: "warning",
            title: "Bundle Up Warmly",
            reasoning: `Chilly conditions at **${temp}°C** (Feels like **${c.feelsLikeC}°C**). Layer up in thermal wear, gloves, and a windbreaker before going for a stroll.`,
            metrics: `Temp: **${temp}°C** • Wind Chill: **${c.feelsLikeC}°C**`
          };
        }
        return {
          verdict: "🟢 Wonderful for a Walk!",
          status: "success",
          title: "Great Outdoor Walking Weather",
          reasoning: `Temperature in **${loc.name}** is a comfortable **${temp}°C** with **${c.humidity}% humidity** and mild **${c.windKmh} km/h** breeze. Excellent conditions for a fresh air stroll!`,
          metrics: `Temp: **${temp}°C** (Feels like **${c.feelsLikeC}°C**) • UV: **${uv}** • Wind: **${c.windKmh} km/h**`
        };
      }

      case 'car_wash': {
        // Car Wash evaluation: Check rain in next 24h
        const rainProb = up24.maxRainProbability;
        if (rainProb >= 35 || up24.rainExpected) {
          return {
            verdict: "🔴 Delay Car Wash",
            status: "danger",
            title: "Rain Predicted in Next 24 Hours",
            reasoning: `There is a **${rainProb}% chance of rain** expected over **${loc.name}** in the next 24 hours. A fresh wash will likely get water-spotted by upcoming showers!`,
            metrics: `24h Max Rain Risk: **${rainProb}%** • Current: **${c.condition}**`
          };
        }
        return {
          verdict: "🟢 Great Day to Wash Your Car!",
          status: "success",
          title: "Clear Skies Ahead",
          reasoning: `Only a **${rainProb}% rain probability** for **${loc.name}** over the next 24 hours with **${c.condition}** skies. Your clean car finish should stay pristine!`,
          metrics: `24h Rain Risk: **${rainProb}%** • Humidity: **${c.humidity}%** • Temp: **${c.tempC}°C**`
        };
      }

      case 'fishing': {
        // Fishing evaluation: Barometric pressure (1010-1018 ideal), wind, rain
        const pressure = c.surfacePressureHpa;
        const wind = c.windKmh;

        let pressureVerdict = "Steady (Good)";
        if (pressure < 1005) pressureVerdict = "Low Pressure (Storm Front Approaching)";
        else if (pressure > 1022) pressureVerdict = "High Pressure (Fish Inactive)";

        if (wind > 24) {
          return {
            verdict: "🟡 Choppy Water / Strong Winds",
            status: "warning",
            title: "High Wind Alert for Boating/Fishing",
            reasoning: `Wind speed is **${wind} km/h** (${c.windCompass}) creating choppy water surfaces. Exercise caution if taking small watercraft out.`,
            metrics: `Pressure: **${pressure} hPa** (${pressureVerdict}) • Wind: **${wind} km/h**`
          };
        }
        return {
          verdict: "🟢 Favorable Fishing Conditions",
          status: "success",
          title: "Optimal Barometric Pressure & Water Activity",
          reasoning: `Barometric pressure is stable at **${pressure} hPa** with manageable wind at **${wind} km/h**. Fish feeding activity is typically active under these conditions!`,
          metrics: `Surface Pressure: **${pressure} hPa** • Wind Vector: **${c.windDirection}** • Temp: **${c.tempC}°C**`
        };
      }

      case 'laundry': {
        // Laundry drying evaluation: Humidity, wind, rain
        const humidity = c.humidity;
        const rainProb = up24.maxRainProbability;

        if (rainProb > 30 || humidity > 78) {
          return {
            verdict: "🔴 High Humidity / Rain Risk",
            status: "danger",
            title: "Slow Outdoor Drying Expected",
            reasoning: `Humidity is high at **${humidity}%** with a **${rainProb}% rain chance** in **${loc.name}**. Clothes will take a long time to dry outdoors or may get caught in damp showers.`,
            metrics: `Humidity: **${humidity}%** • 24h Rain Prob: **${rainProb}%**`
          };
        }
        return {
          verdict: "🟢 Fast Outdoor Drying",
          status: "success",
          title: "Crisp Air for Laundry",
          reasoning: `Humidity is at a crisp **${humidity}%** with a breezy **${c.windKmh} km/h** airflow. Your laundry will dry quickly in the fresh air!`,
          metrics: `Humidity: **${humidity}%** • Wind Speed: **${c.windKmh} km/h** • Rain Risk: **${rainProb}%**`
        };
      }

      case 'cycling': {
        const wind = c.windKmh;
        if (wind > 26 || up24.rainExpected) {
          return {
            verdict: "🟡 Challenging Wind / Road Slicks",
            status: "warning",
            title: "High Headwinds or Wet Pavements",
            reasoning: `Wind resistance is high at **${wind} km/h** (${c.windCompass}) with possible wet patches. Stay alert on turns and downhills.`,
            metrics: `Wind Vector: **${c.windDirection}** • Conditions: **${c.condition}**`
          };
        }
        return {
          verdict: "🟢 Smooth Cycling Weather",
          status: "success",
          title: "Great Visibility & Traction",
          reasoning: `Moderate **${wind} km/h** wind and dry **${c.tempC}°C** asphalt provide great traction and comfortable pacing for road or trail biking!`,
          metrics: `Temp: **${c.tempC}°C** • Wind: **${wind} km/h** • Humidity: **${c.humidity}%**`
        };
      }

      case 'stargazing': {
        const isCloudy = c.condition.toLowerCase().includes('cloud') || c.condition.toLowerCase().includes('overcast') || c.condition.toLowerCase().includes('fog');
        if (isCloudy || up24.rainExpected) {
          return {
            verdict: "🔴 Cloud Cover Alert",
            status: "danger",
            title: "Obscured Night Skies",
            reasoning: `Sky conditions over **${loc.name}** are currently **${c.condition}**. Celestial viewing and telescope observation will be heavily obscured by cloud layers.`,
            metrics: `Conditions: **${c.condition}** • Humidity: **${c.humidity}%**`
          };
        }
        return {
          verdict: "🟢 Clear Night Skies",
          status: "success",
          title: "Excellent Astronomical Visibility",
          reasoning: `Clear atmospheric visibility over **${loc.name}** with minimal cloud obstruction. Great opportunity for stargazing, satellite spotting, or lunar observation!`,
          metrics: `Sky: **${c.condition}** • Pressure: **${c.surfacePressureHpa} hPa**`
        };
      }

      case 'clothing':
      default: {
        // General condition breakdown
        const temp = c.tempC;
        let outfitAdvice = "Comfortable everyday wear.";
        if (temp > 30) outfitAdvice = "Light breathable cottons, sunglasses, and sun protection.";
        else if (temp >= 20) outfitAdvice = "A light t-shirt with jeans, chinos, or casual sneakers.";
        else if (temp >= 12) outfitAdvice = "A light jacket, cardigan, or cozy hoodie.";
        else outfitAdvice = "Insulated winter jacket, warm woolen layers, and boots.";

        return {
          verdict: `🟢 Live Weather: ${c.tempC}°C • ${c.condition}`,
          status: "info",
          title: `Current Climate in ${loc.name}`,
          reasoning: `It is currently **${c.tempC}°C** (Feels like **${c.feelsLikeC}°C**) with **${c.humidity}% humidity** and **${c.windKmh} km/h** winds from the **${c.windCompass}**. ${outfitAdvice}`,
          metrics: `Pressure: **${c.surfacePressureHpa} hPa** • UV: **${c.uvIndex} (${c.uvCategory})** • Rain Risk: **${up24.maxRainProbability}%**`
        };
      }
    }
  }
};

// Export to window
if (typeof window !== 'undefined') {
  window.WMO_CODE_MAP = WMO_CODE_MAP;
  window.geocodeCity = geocodeCity;
  window.fetchLiveWeather = fetchLiveWeather;
  window.getCompleteLiveWeatherData = getCompleteLiveWeatherData;
  window.ActivityReasoningEngine = ActivityReasoningEngine;
}
