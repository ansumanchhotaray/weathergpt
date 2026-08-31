# Walkthrough - WeatherGPT Landscape Viewport Overhaul

WeatherGPT has been restructured into a **full-bleed horizontal (landscape) viewport layout** while maintaining strict fidelity to the **exact peach/cream grid visual aesthetic, minimalist sun & cloud artwork, and chat bubble styles** from the reference screenshot.

---

## 🌟 Visual & Architectural Highlights

### 1. 🖼️ Horizontal Full-Bleed Landscape Architecture (`100vw`, `100vh`)
- **Left Panel (46% width)**:
  - **Grid Canvas**: Warm peach/cream background (`#FAF4E8`) with subtle 32px grid lines (`rgba(220, 203, 175, 0.45)`).
  - **Top Row**: Pill badge `"WeatherGPT Atmospheric Link"` and circular action button.
  - **Atmospheric Artwork**: Layered golden-yellow sun (`#FAB319`) with radiating sunbeams, drifting soft cloud (`#CFC7B9`), and ambient gold dust particles.
  - **Pinned Telemetry Bar**: 3-column live metric strip displaying **Humidity**, **Wind Vector**, and **UV Exposure** with divider borders (`#EDE3D0`).
- **Right Panel (54% width)**:
  - **Full-Height Chat Stream**: Smooth vertical scrolling log window.
  - **Strict Bubble Theme Locks**: Soft gray pill bubbles (`#EAEDF2`) for the bot with right-aligned timestamps (`#9CA3AF`), and solid blue pills (`#2563EB`) with crisp white text for user messages.
  - **Suggested Hot-Keys**: Capsule pill track (`#EAEDF2`) with buttons (`Mumbai 🌧️`, `Delhi ☀️`, `Bengaluru ☁️`, `Chennai 🌊`, `Kolkata ⛈️`), highlighting the active city in solid blue.
  - **Chat Input Bar**: Rounded input field with building icon and soft periwinkle `Send ➤` button (`#9CBDFC`).

---

## 🧠 Live Data & AI Activity Reasoning Integration

- **Live Open-Meteo Meteorological Feed**: Real-time temperature, wind speed, wind vector/compass direction, relative humidity, surface barometric pressure, and UV index.
- **AI Activity Reasoning Engine**: Evaluates live conditions for specific activity inquiries:
  - *"Can I fly a kite?"* -> Evaluates live wind speed (8–25 km/h optimal).
  - *"Is it a good time for a walk?"* -> Evaluates temperature, rain risk, and UV index.
  - *"Can I wash my car today?"* -> Evaluates 24-hour upcoming precipitation probability.
  - *"How are fishing conditions?"* -> Evaluates barometric pressure trends (1010–1018 hPa) and wind speeds.
  - *"Can I dry clothes outdoors?"* -> Evaluates humidity and wind airflow.

---

## 📁 Updated File Reference

All files are located in `weathergpt`:

| File | Description |
|---|---|
| [`index.html`] | WeatherGPT homepage with navigation links to Climate Rating and Disaster Portal. |
| [`disaster-portal.html`] | Dedicated Emergency Monitoring System with Leaflet map, NASA EONET events, and NDRRMA Nepal Flood pitch demo. |
| [`climate-rating.html`] | Climate & Air Quality Rater with 1-10 scoring engine and Leaflet map. |
| [`style.css`] | Core stylesheet with landscape layout and nav link styles. |
| [`weatherData.js`] | Live Open-Meteo weather API pipeline + AI Activity Reasoning Engine. |
| [`app.js`] | WeatherGPT homepage controller. |

---

## 🚀 How to Run & View

Open [`index.html`] in your browser, or run:

```powershell
cd weathergpt
python -m http.server 3000
```
Then navigate to `http://localhost:3000`.
