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
            initCanvasOrbitFallback();
            return;
        }

        // Scene setup with improved lighting
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000510); // Deep space blue
        
        // Add ambient light for better visibility
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambientLight);
        
        // Add directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        sunLight.position.set(5, 3, 5);
        scene.add(sunLight);
        
        // Add stars background
        createStarfield();
        
        // Camera with improved settings
        const container = document.getElementById('three-container');
        camera = new THREE.PerspectiveCamera(
            60,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        camera.position.set(0, 15, 30);
        
        // Improved renderer with better shadows
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);
        
        // Controls with better settings
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.rotateSpeed = 0.7;
        controls.zoomSpeed = 1.2;
        controls.minDistance = 15;
        controls.maxDistance = 50;
        
        // Create Earth with realistic textures
        createEarth();
        
        // Create ISS with better model
        createISS();
        
        // Create orbit line
        createOrbitLine();
        
        // Animation loop
        animate();
        is3DInitialized = true;
        
        // Add help tooltip
        addHelpTooltip();

    } catch (error) {
        console.error('3D initialization error:', error);
        show3DError(`3D Initialization failed: ${error.message}`);
        initCanvasOrbitFallback();
    }
}

function createStarfield() {
    // Create more stars with better distribution
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.7,
        transparent: true,
        opacity: 0.8,
        map: createStarTexture(),
        blending: THREE.AdditiveBlending
    });
    
    const starsVertices = [];
    for (let i = 0; i < 5000; i++) {
        const x = THREE.MathUtils.randFloatSpread(500);
        const y = THREE.MathUtils.randFloatSpread(500);
        const z = THREE.MathUtils.randFloatSpread(500);
        starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

function createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(240,240,255,1)');
    gradient.addColorStop(0.4, 'rgba(220,220,255,0.8)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function createEarth() {
    // Load Earth textures
    const textureLoader = new THREE.TextureLoader();
    
    // Create Earth with realistic textures
    const earthGeometry = new THREE.SphereGeometry(6, 64, 64);
    
    const earthMaterial = new THREE.MeshPhongMaterial({
        map: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg'),
        bumpMap: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg'),
        bumpScale: 0.05,
        specularMap: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_specular_2048.jpg'),
        specular: new THREE.Color(0x333333),
        shininess: 15
    });
    
    earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthMesh.receiveShadow = true;
    scene.add(earthMesh);
    
    // Add clouds layer
    const cloudsGeometry = new THREE.SphereGeometry(6.1, 64, 64);
    const cloudsMaterial = new THREE.MeshPhongMaterial({
        map: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png'),
        transparent: true,
        opacity: 0.4
    });
    
    earthClouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
    scene.add(earthClouds);
    
    // Add atmosphere glow
    const atmosphereGeometry = new THREE.SphereGeometry(6.2, 64, 64);
    const atmosphereMaterial = new THREE.MeshPhongMaterial({
        color: 0x0077ff,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide
    });
    
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);
}

function createISS() {
    // Better ISS representation
    const issGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.3);
    const issMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xdddddd,
        emissive: 0x444444,
        shininess: 100,
        specular: 0x333333
    });
    issMesh = new THREE.Mesh(issGeometry, issMaterial);
    
    // Add solar panels
    const panelGeometry = new THREE.BoxGeometry(1.5, 0.05, 0.5);
    const panelMaterial = new THREE.MeshPhongMaterial({
        color: 0x2299ff,
        shininess: 100,
        specular: 0x3333ff
    });
    
    const leftPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    leftPanel.position.x = -1.2;
    issMesh.add(leftPanel);
    
    const rightPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    rightPanel.position.x = 1.2;
    issMesh.add(rightPanel);
    
    // Add glow effect
    const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff9900,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
    });
    
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    issMesh.add(glow);
    
    scene.add(issMesh);
}

function createOrbitLine() {
    const orbitGeometry = new THREE.BufferGeometry();
    const orbitMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00ffff,
        linewidth: 2,
        opacity: 0.8,
        transparent: true
    });
    orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
    scene.add(orbitLine);
}

function updateOrbitVisualization(lat, lon, alt) {
    if (!is3DInitialized) return;

    // Convert geographic to 3D coordinates
    const radius = 6.371 + (alt / 1000) * 0.05; // Earth radius + scaled altitude
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
    
    // Rotate Earth and clouds
    if (rotateSystem && earthMesh) {
        earthMesh.rotation.y += 0.0005;
        if (earthClouds) earthClouds.rotation.y += 0.0007;
    }
    
    // Update controls
    if (controls) controls.update();
    
    // Render scene
    renderer.render(scene, camera);
}

function toggleRotation() {
    rotateSystem = !rotateSystem;
}

function resetCamera() {
    if (!camera) return;
    camera.position.set(0, 15, 30);
    camera.lookAt(0, 0, 0);
    if (controls) controls.reset();
}

function addHelpTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'orbit-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-content">
            <p>🖱️ Drag to rotate view</p>
            <p>🖱️ Scroll to zoom in/out</p>
            <p>⏯️ Toggle button pauses Earth rotation</p>
        </div>
    `;
    document.getElementById('three-container').appendChild(tooltip);
    
    // Hide tooltip after 5 seconds
    setTimeout(() => {
        tooltip.style.opacity = '0';
        setTimeout(() => tooltip.remove(), 1000);
    }, 5000);
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

// 2D Canvas Fallback for browsers without WebGL
function initCanvasOrbitFallback() {
    const container = document.getElementById('three-container');
    container.innerHTML = '';
    
    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Earth properties
    const earthRadius = 100;
    let issAngle = 0;
    const issDistance = earthRadius * 1.2;
    const issSize = 5;
    const orbitHistory = [];
    const maxOrbitPoints = 100;
    
    // Animation function
    function animateCanvas() {
        // Clear canvas
        ctx.fillStyle = '#0a1a2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw stars
        for (let i = 0; i < 200; i++) {
            ctx.fillStyle = 'rgba(255, 255, 255, ' + Math.random() + ')';
            ctx.beginPath();
            ctx.arc(
                Math.random() * canvas.width,
                Math.random() * canvas.height,
                Math.random() * 1.5,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        
        // Draw Earth
        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, earthRadius
        );
        gradient.addColorStop(0, '#1E90FF');
        gradient.addColorStop(1, '#0000CD');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw orbit path
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, issDistance, 0, Math.PI * 2);
        ctx.stroke();
        
        // Calculate ISS position
        const issX = centerX + Math.cos(issAngle) * issDistance;
        const issY = centerY + Math.sin(issAngle) * issDistance;
        
        // Store orbit history
        orbitHistory.push({x: issX, y: issY});
        if (orbitHistory.length > maxOrbitPoints) {
            orbitHistory.shift();
        }
        
        // Draw orbit history
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
        ctx.beginPath();
        if (orbitHistory.length > 0) {
            ctx.moveTo(orbitHistory[0].x, orbitHistory[0].y);
            for (let i = 1; i < orbitHistory.length; i++) {
                ctx.lineTo(orbitHistory[i].x, orbitHistory[i].y);
            }
        }
        ctx.stroke();
        
        // Draw ISS
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.arc(issX, issY, issSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Add glow effect
        const glowGradient = ctx.createRadialGradient(
            issX, issY, 0,
            issX, issY, issSize * 3
        );
        glowGradient.addColorStop(0, 'rgba(255, 69, 0, 0.8)');
        glowGradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(issX, issY, issSize * 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Update ISS position for next frame
        issAngle += 0.01;
        
        requestAnimationFrame(animateCanvas);
    }
    
    // Start animation
    animateCanvas();
    
    // Add message about fallback mode
    const fallbackMsg = document.createElement('div');
    fallbackMsg.className = 'fallback-message';
    fallbackMsg.textContent = '⚠️ Using 2D canvas fallback mode (WebGL not available)';
    container.appendChild(fallbackMsg);
}
