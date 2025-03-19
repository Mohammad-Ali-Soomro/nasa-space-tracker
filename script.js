const WEBGL = {
    isWebGLAvailable: function() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    },
    isWebGL2Available: function() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
        } catch (e) {
            return false;
        }
    },
    getWebGLErrorMessage: function() {
        return 'Your browser does not support WebGL';
    }
};

const API_KEY = '04kavYa0frT6y1VaMIQxdv8KEKrL4b3GWnb2TrzN'; // Replace with your NASA API key
let map, issMarker;
let scene, camera, renderer, controls, earthMesh, issMesh, orbitLine;
let rotateSystem = true;
let is3DInitialized = false;
let stats;
let earthClouds, stars;
const orbitPoints = [];
const MAX_ORBIT_POINTS = 500;

// Tab Management
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
    
    if(tabName === 'iss' && !map) initISSMap();
    if(tabName === 'orbit' && !is3DInitialized) initThreeJS();
    
    if(tabName === 'orbit') {
        window.addEventListener('resize', handle3DResize);
        handle3DResize();
    } else {
        window.removeEventListener('resize', handle3DResize);
    }
}

// Asteroid Tracker
async function fetchAsteroids() {
    try {
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const response = await fetch(
            `https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}&api_key=${API_KEY}`
        );
        const data = await response.json();
        displayAsteroids(data.near_earth_objects);
    } catch (error) {
        document.querySelector('.asteroids-grid').innerHTML = 
            '<div class="error">⚠️ Failed to load asteroid data. Try refreshing the page.</div>';
    }
}

function displayAsteroids(asteroidData) {
    const container = document.querySelector('.asteroids-grid');
    container.innerHTML = '';
    
    Object.values(asteroidData).flat().forEach(asteroid => {
        const approachData = asteroid.close_approach_data[0];
        const card = document.createElement('div');
        card.className = 'asteroid-card';
        card.innerHTML = `
            <h3>${asteroid.name.replace(/[()]/g, '')}</h3>
            <p>📏 Size: ${Math.round(asteroid.estimated_diameter.meters.estimated_diameter_max)}m</p>
            <p>💨 Speed: ${Math.round(approachData.relative_velocity.kilometers_per_hour)} km/h</p>
            <p>📅 Closest approach: ${new Date(approachData.close_approach_date_full).toLocaleDateString()}</p>
            <p class="${asteroid.is_potentially_hazardous ? 'danger' : 'safe'}">
                ${asteroid.is_potentially_hazardous ? '⚠️ Hazardous' : '🛡️ Safe'}
            </p>
        `;
        container.appendChild(card);
    });
}

// ISS Tracker (2D Map)
function initISSMap() {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    // Enhanced ISS marker with custom icon and pulsing effect
    const issIcon = L.icon({
        iconUrl: 'https://img.icons8.com/color/48/iss.png',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        className: 'iss-icon-pulse'
    });
    
    issMarker = L.marker([0, 0], { icon: issIcon }).addTo(map);
    
    // Add a circular highlight under the ISS
    const issCircle = L.circle([0, 0], {
        color: '#ff4500',
        fillColor: '#ff4500',
        fillOpacity: 0.2,
        radius: 300000, // 300km radius
        className: 'iss-highlight-pulse'
    }).addTo(map);
    
    // Update both the marker and circle
    const updateISSPosition = (lat, lon) => {
        issMarker.setLatLng([lat, lon]);
        issCircle.setLatLng([lat, lon]);
    };
    
    updateISS(updateISSPosition);
    setInterval(() => updateISS(updateISSPosition), 2000);
}


// 3D Visualization System
function initThreeJS() {
    if (is3DInitialized) return;
    
    try {
        // Check WebGL support
        if (!WEBGL.isWebGLAvailable()) {
            show3DError('WebGL is not supported in your browser');
            return;
        }

        // Scene setup
        scene = new THREE.Scene();
        
        // Add stars background
        createStarfield();
        
        // Camera with improved settings
        const container = document.getElementById('three-container');
        camera = new THREE.PerspectiveCamera(
            60, // Wider FOV
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        camera.position.z = 30;

        // Improved renderer
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        // Stats.js - with error handling
        try {
            if (typeof Stats !== 'undefined') {
                stats = new Stats();
                stats.showPanel(0);
                container.appendChild(stats.dom);
            }
        } catch (statsError) {
            console.warn('Stats.js not available:', statsError);
            // Create a dummy stats object to prevent errors
            stats = {
                update: function() {} // Empty function
            };
        }

        // Enhanced lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(5, 3, 5);
        scene.add(directionalLight);

        // Create Earth with clouds
        createEarth();

        // ISS Model - improved
        createISS();

        // Orbit Path with better material
        createOrbitLine();

        // Controls with better settings
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.rotateSpeed = 0.7;
        controls.zoomSpeed = 1.2;

        // Animation loop
        animate();
        is3DInitialized = true;

    } catch (error) {
        show3DError(`3D Initialization failed: ${error.message}`);
    }
}

function createStarfield() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.7,
        transparent: true
    });
    
    const starsVertices = [];
    for (let i = 0; i < 5000; i++) {
        const x = THREE.MathUtils.randFloatSpread(2000);
        const y = THREE.MathUtils.randFloatSpread(2000);
        const z = THREE.MathUtils.randFloatSpread(2000);
        starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

function createEarth() {
    const earthGeometry = new THREE.SphereGeometry(6.371, 64, 64);
    const textureLoader = new THREE.TextureLoader();
    
    // Earth texture with normal map for better detail
    Promise.all([
        textureLoader.loadAsync('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
        textureLoader.loadAsync('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg'),
        textureLoader.loadAsync('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
        textureLoader.loadAsync('https://threejs.org/examples/textures/planets/earth_clouds_1024.png')
    ]).then(([earthMap, normalMap, specularMap, cloudsMap]) => {
        // Earth material with normal mapping
        const earthMaterial = new THREE.MeshPhongMaterial({
            map: earthMap,
            normalMap: normalMap,
            specularMap: specularMap,
            specular: 0x333333,
            shininess: 15
        });
        earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
        scene.add(earthMesh);
        
        // Add cloud layer
        const cloudsGeometry = new THREE.SphereGeometry(6.471, 64, 64);
        const cloudsMaterial = new THREE.MeshPhongMaterial({
            map: cloudsMap,
            transparent: true,
            opacity: 0.4
        });
        earthClouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
        scene.add(earthClouds);
    }).catch(err => {
        console.error('Earth texture error:', err);
        const earthMaterial = new THREE.MeshPhongMaterial({ color: 0x0000ff });
        earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
        scene.add(earthMesh);
    });
}

function createISS() {
    // Better ISS representation
    const issGeometry = new THREE.ConeGeometry(0.3, 1, 4);
    const issMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xff0000,
        emissive: 0x440000
    });
    issMesh = new THREE.Mesh(issGeometry, issMaterial);
    scene.add(issMesh);
}

function createOrbitLine() {
    const orbitGeometry = new THREE.BufferGeometry();
    const orbitMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00ffff,
        linewidth: 2,
        opacity: 0.7,
        transparent: true
    });
    orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
    scene.add(orbitLine);
}

function updateOrbitVisualization(lat, lon, alt) {
    if (!is3DInitialized) return;

    // Convert geographic to 3D coordinates
    const radius = 6.371 + (alt / 1000); // Earth radius + scaled altitude
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon + 180);

    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    // Update ISS position
    issMesh.position.set(x, y, z);
    issMesh.lookAt(0, 0, 0);
    
    // Store orbit points with limit
    orbitPoints.push(new THREE.Vector3(x, y, z));
    if (orbitPoints.length > MAX_ORBIT_POINTS) {
        orbitPoints.shift();
    }
    
    // Update orbit line
    const positions = new Float32Array(orbitPoints.length * 3);
    for (let i = 0; i < orbitPoints.length; i++) {
        positions[i * 3] = orbitPoints[i].x;
        positions[i * 3 + 1] = orbitPoints[i].y;
        positions[i * 3 + 2] = orbitPoints[i].z;
    }
    
    orbitLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    orbitLine.geometry.attributes.position.needsUpdate = true;
}

function handle3DResize() {
    if (!is3DInitialized) return;
    
    const container = document.getElementById('three-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (rotateSystem) {
        if (earthMesh) earthMesh.rotation.y += 0.0005;
        if (earthClouds) earthClouds.rotation.y += 0.0007; // Clouds rotate slightly faster
    }
    
    if (stars) stars.rotation.y += 0.0001;
    
    if (controls) controls.update();
    if (renderer) renderer.render(scene, camera);
    if (stats) stats.update();
}

function toggleRotation() {
    rotateSystem = !rotateSystem;
}

function resetCamera() {
    if (!is3DInitialized) return;
    camera.position.set(0, 0, 45);
    controls.target.set(0, 0, 0);
    controls.update();
}

// ISS Position Updater
async function updateISS(positionCallback) {
    try {
        const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
        const data = await response.json();
        
        // Update 2D Map
        if (positionCallback) {
            positionCallback(data.latitude, data.longitude);
        } else if (issMarker) {
            issMarker.setLatLng([data.latitude, data.longitude]);
        }
        
        if (map) map.setView([data.latitude, data.longitude]);
        document.getElementById('lat').textContent = data.latitude.toFixed(4);
        document.getElementById('lon').textContent = data.longitude.toFixed(4);
        document.getElementById('alt').textContent = data.altitude.toFixed(2);
        document.getElementById('vel').textContent = data.velocity.toFixed(2);

        // Update 3D Visualization
        updateOrbitVisualization(data.latitude, data.longitude, data.altitude);
    } catch (error) {
        console.error('ISS update error:', error);
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchAsteroids();
    if(window.location.hash) showTab(window.location.hash.substring(1));
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if(is3DInitialized) handle3DResize();
    });
});

// Error handling
function show3DError(message) {
    const container = document.getElementById('three-container');
    container.innerHTML = `
        <div class="error-box">
            <h3>🚨 3D Visualization Error</h3>
            <p>${message}</p>
            <p>Possible solutions:</p>
            <ul>
                <li>Update graphics drivers</li>
                <li>Enable WebGL in browser settings</li>
                <li>Try Chrome/Firefox</li>
                <li>Disable browser extensions</li>
            </ul>
            <button onclick="location.reload()">🔄 Reload Page</button>
        </div>
    `;
}
