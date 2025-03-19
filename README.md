# NASA Space Tracker 🚀

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?style=for-the-badge)](https://mohammad-ali-soomro.github.io/nasa-space-tracker/)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

A real-time space tracking web application using NASA APIs with 3D visualization capabilities.

![Screenshot](https://via.placeholder.com/800x400.png?text=NASA+Space+Tracker+Screenshot) <!-- Add actual screenshot later -->

## Features ✨

- 🌍 Real-time ISS Tracking
  - 2D Map View with Leaflet.js
  - 3D Orbital Visualization with Three.js
- ☄️ Near-Earth Asteroid Monitoring
  - Hazard Classification System
  - Size and Velocity Statistics
- 🛰️ Interactive Space Visualization
  - Rotatable 3D Earth Model
  - Historical Orbit Path Tracing
- 📱 Responsive Design
  - Works on Desktop and Mobile
  - Modern UI with Space Theme

## Technologies Used 🛠️

![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat&logo=threedotjs&logoColor=white)
![Leaflet.js](https://img.shields.io/badge/Leaflet.js-199900?style=flat&logo=leaflet&logoColor=white)
![NASA APIs](https://img.shields.io/badge/NASA%20APIs-0B3D91?style=flat&logo=nasa&logoColor=white)

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **3D Engine**: Three.js
- **Mapping**: Leaflet.js + OpenStreetMap
- **Data Sources**:
  - [NASA NeoWs API](https://api.nasa.gov/)
  - [Where is ISS API](https://wheretheiss.at/)

## Live Demo 🌐

Experience the tracker live:  
[https://mohammad-ali-soomro.github.io/nasa-space-tracker/](https://mohammad-ali-soomro.github.io/nasa-space-tracker/)

## Installation 💻

1. Clone the repository:
```bash
git clone https://github.com/Mohammad-Ali-Soomro/nasa-space-tracker.git
```

## Setup & API Key 🔑

This project uses NASA's APIs which require an API key. To run the project:

1. Get a free API key from [NASA's API portal](https://api.nasa.gov/)
2. When you first open the application, you'll be prompted to enter your API key
3. The key will be stored locally in your browser and not shared

Alternatively, you can add your API key as a URL parameter when first loading the page:
```
https://your-github-pages-url.com/?api_key=YOUR_NASA_API_KEY
```

The key will be stored locally and removed from the URL immediately.

**Note:** If you don't provide an API key, the application will use NASA's DEMO_KEY which has strict rate limits.
