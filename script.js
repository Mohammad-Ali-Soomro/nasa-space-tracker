const API_KEY = '04kavYa0frT6y1VaMIQxdv8KEKrL4b3GWnb2TrzN';
let map, issMarker;
let scene, camera, renderer, controls, issMesh;
let rotateSystem = true;

// Tab Management
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
    
    if(tabName === 'iss' && !map) initISSMap();
    if(tabName === 'orbit' && !renderer) initThreeJS();
    
    // Resize Three.js canvas on tab switch
    if(tabName === 'orbit' && renderer) {
        camera.aspect = document.getElementById('three-container').clientWidth / 600;
        camera.updateProjectionMatrix();
        renderer.setSize(document.getElementById('three-container').clientWidth, 600);
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

// 3D Visualization System with Debugging
function initThreeJS() {
    try {
        // Check WebGL support
        if (!WEBGL.isWebGLAvailable()) {
            throw new Error('WebGL not supported');
        }

        // Scene setup
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(
            75,
            document.getElementById('three-container').clientWidth / 600,
            0.1,
            1000
        );
        
        // Initialize renderer with error handling
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                powerPreference: "high-performance"
            });
        } catch (error) {
            console.error("WebGL initialization failed:", error);
            show3DError();
            return;
        }

        renderer.setSize(document.getElementById('three-container').clientWidth, 600);
        document.getElementById('three-container').appendChild(renderer.domElement);

        // Add debug stats
        const stats = new Stats();
        stats.showPanel(0);
        document.getElementById('three-container').appendChild(stats.dom);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 3, 5);
        scene.add(directionalLight);

        // Earth with fallback texture
        const earthGeometry = new THREE.SphereGeometry(6.3, 64, 64);
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
            texture => {
                const earthMaterial = new THREE.MeshPhongMaterial({
                    map: texture,
                    specular: 0x222222,
                    shininess: 3
                });
                const earth = new THREE.Mesh(earthGeometry, earthMaterial);
                scene.add(earth);
            },
            undefined,
            err => {
                console.error("Error loading Earth texture:", err);
                const earthMaterial = new THREE.MeshPhongMaterial({ color: 0x0000ff });
                const earth = new THREE.Mesh(earthGeometry, earthMaterial);
                scene.add(earth);
            }
        );

        // Simple ISS model
        const issGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.6);
        const issMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        issMesh = new THREE.Mesh(issGeometry, issMaterial);
        scene.add(issMesh);

        // Camera controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        camera.position.z = 45;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        // Start animation
        animate();

        // Add debug helper
        const axesHelper = new THREE.AxesHelper(10);
        scene.add(axesHelper);

    } catch (error) {
        console.error("3D initialization failed:", error);
        show3DError();
    }
}

function show3DError() {
    const container = document.getElementById('three-container');
    container.innerHTML = `
        <div class="error-box">
            <h3>🚨 3D Visualization Error</h3>
            <p>Possible causes:</p>
            <ul>
                <li>WebGL not supported in your browser</li>
                <li>Graphics card/driver issues</li>
                <li>Resource loading blocked</li>
            </ul>
            <p>Check console for details and try:</p>
            <button onclick="location.reload()">🔄 Reload Page</button>
            <button onclick="toggleWebGL()">🎮 Toggle WebGL Mode</button>
        </div>
    `;
}

function toggleWebGL() {
    if (renderer) {
        renderer.dispose();
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: renderer.getContext().getExtension('WEBGL_lose_context') 
                ? "low-power" 
                : "high-performance"
        });
    }
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
    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, document.getElementById('three-container').clientWidth / 600, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(document.getElementById('three-container').clientWidth, 600);
    document.getElementById('three-container').appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    // Earth
    const earthGeometry = new THREE.SphereGeometry(6.3, 64, 64);
    const earthTexture = new THREE.TextureLoader().load(
        'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg'
    );
    const earthMaterial = new THREE.MeshPhongMaterial({ 
        map: earthTexture,
        specular: 0x222222,
        shininess: 3
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    // ISS Model
    const issGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.6);
    const issMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    issMesh = new THREE.Mesh(issGeometry, issMaterial);
    scene.add(issMesh);

    // Orbit Path
    const orbitGeometry = new THREE.BufferGeometry();
    const orbitLine = new THREE.Line(
        orbitGeometry,
        new THREE.LineBasicMaterial({ color: 0x00ff00 })
    );
    scene.add(orbitLine);

    // Camera Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    camera.position.z = 45;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Animation Loop
    animate();
}

function updateOrbitVisualization(lat, lon, alt) {
    // Convert geographic coordinates to 3D position
    const radius = 6.3 + (alt / 1000); // Scale altitude for visualization
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 90) * (Math.PI / 180);
    
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    // Update ISS position and orientation
    issMesh.position.set(x, y, z);
    issMesh.lookAt(0, 0, 0);

    // Update orbit path
    const orbitLine = scene.getObjectByProperty('type', 'Line');
    const positions = orbitLine.geometry.attributes.position?.array || [];
    const newPositions = new Float32Array([...positions, x, y, z].slice(-3000));
    orbitLine.geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    orbitLine.geometry.attributes.position.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);
    if (rotateSystem) scene.getObjectByProperty('type', 'Mesh').rotation.y += 0.0005;
    controls.update();
    renderer.render(scene, camera);
}

function toggleRotation() {
    rotateSystem = !rotateSystem;
}

function resetCamera() {
    camera.position.set(0, 0, 45);
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
        if(renderer) updateOrbitVisualization(data.latitude, data.longitude, data.altitude);
    } catch (error) {
        console.error('Error updating ISS position:', error);
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchAsteroids();
    if(window.location.hash) showTab(window.location.hash.substring(1));
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if(renderer) {
            camera.aspect = document.getElementById('three-container').clientWidth / 600;
            camera.updateProjectionMatrix();
            renderer.setSize(document.getElementById('three-container').clientWidth, 600);
        }
    });
});