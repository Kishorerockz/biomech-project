# Sports Biomechanics Wearable (SBW)

Full-stack IoT application for real-time sports biomechanics tracking. 
Monitors athlete acceleration, gyroscope data, and detects jumps (height/flight time) via hardware telemetry.

## System Architecture

The project consists of three main parts:
1. **`biomech-backend/`**: Node.js + Express + Socket.io + MongoDB API that provides REST routes, a batched database write buffer, signal processing (moving averages), and a state-machine based jump detection algorithm.
2. **`kinetix/`**: Modern React + Vite frontend (formerly biomech-dashboard) using Tailwind CSS and Canvas rendering for live WebSocket telemetry streams and historical jump analytics.
3. **`simulator/`**: Python hardware mocker that generates synthetic 10Hz MPU-6050 (accel/gyro) physics payloads over Socket.io to test the backend logic.

## Environment Variables
Before running, you need to configure the databases. Rename `.env.example` to `.env` in both places:

**`biomech-backend/.env`**
```
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster_url>/biomech
```

**`kinetix/.env.local`**
```
VITE_BACKEND_URL=http://localhost:5000
```

## Running the Application

### 1. Start the Backend
```bash
cd biomech-backend
npm install
npm run dev
```
*(Runs on port 5000)*

### 2. Start the Frontend Dashboard (Kinetix)
```bash
cd kinetix
npm install
npm run dev
```
*(Runs on port 3000 - open `http://localhost:3000` in your browser)*

### 3. Generate Hardware Data (Simulator)
```bash
cd simulator
pip install -r requirements.txt
python simulate_hardware.py --duration 60
```
*(Watch the live dashboard as the python script fakes athlete jumps!)*


