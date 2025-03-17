const API_KEY = '04kavYa0frT6y1VaMIQxdv8KEKrL4b3GWnb2TrzN'; // Replace with your NASA API key
let map, issMarker;
let scene, camera, renderer, controls, earthMesh, issMesh, orbitLine;
let rotateSystem = true;
let is3DInitialized = false;
let stats;

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
    
    issMarker = L.marker([0, 0], {
        icon: L.icon({
            iconUrl: 'https://img.icons8.com/color/48/iss.png',
            iconSize: [40, 40]
        })
    }).addTo(map);
    
    updateISS();
    setInterval(updateISS, 2000);
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
        scene.background = new THREE.Color(0x000000);

        // Camera setup
        const container = document.getElementById('three-container');
        camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        camera.position.z = 45;

        // Renderer setup
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        // Stats.js
        stats = new Stats();
        stats.showPanel(0);
        container.appendChild(stats.dom);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 3, 5);
        scene.add(directionalLight);

        // Earth
        const earthGeometry = new THREE.SphereGeometry(6.371, 64, 64);
        const textureLoader = new THREE.TextureLoader();
        
        textureLoader.load(
            'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
            (texture) => {
                const earthMaterial = new THREE.MeshPhongMaterial({
                    map: texture,
                    specular: 0x222222,
                    shininess: 3
                });
                earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
                scene.add(earthMesh);
            },
            undefined,
            (err) => {
                console.error('Earth texture error:', err);
                const earthMaterial = new THREE.MeshPhongMaterial({ color: 0x0000ff });
                earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
                scene.add(earthMesh);
            }
        );

        // ISS Model
        const issGeometry = new THREE.BoxGeometry(0.5, 0.5, 1);
        const issMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        issMesh = new THREE.Mesh(issGeometry, issMaterial);
        scene.add(issMesh);

        // Orbit Path
        const orbitGeometry = new THREE.BufferGeometry();
        orbitGeometry.setAttribute(
            'position',
            new THREE.BufferAttribute(new Float32Array(), 3)
        );
        orbitLine = new THREE.Line(
            orbitGeometry,
            new THREE.LineBasicMaterial({ color: 0x00ff00 })
        );
        scene.add(orbitLine);

        // Controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        // Animation loop
        animate();
        is3DInitialized = true;

    } catch (error) {
        show3DError(`3D Initialization failed: ${error.message}`);
    }
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
    issMesh.lookAt(0, 0, 0); // Orient ISS towards Earth center

    // Update orbit path
    const positions = orbitLine.geometry.attributes.position.array;
    const newPositions = new Float32Array([...positions, x, y, z].slice(-3000));
    orbitLine.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(newPositions, 3)
    );
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
    
    if (rotateSystem && earthMesh) {
        earthMesh.rotation.y += 0.0005;
    }
    
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
async function updateISS() {
    try {
        const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
        const data = await response.json();
        
        // Update 2D Map
        issMarker.setLatLng([data.latitude, data.longitude]);
        map.setView([data.latitude, data.longitude]);
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