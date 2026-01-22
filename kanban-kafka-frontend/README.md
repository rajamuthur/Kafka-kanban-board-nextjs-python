### 📋 Kafka-Powered Collaborative Kanban Board
A real-time, multi-user Kanban board built with Next.js, FastAPI, and Apache Kafka (KRaft mode). This project demonstrates how to use an event-driven architecture to synchronize state across multiple clients instantly.

## 🚀 Features
Real-time Sync: Actions (Add, Move, Delete) in one browser window are instantly reflected in all others.

## Kafka KRaft Mode:
- Uses modern Kafka without the need for Zookeeper.

## State Persistence: 
- A backend "Sync Layer" ensures that board state is preserved even after a page refresh.

## Connection Monitoring: 
- Live status indicators for both the FastAPI server and the Kafka broker.

## Smooth UX: 
- Uses @hello-pangea/dnd with Portals to ensure cards don't glitch through columns during drag-and-drop.

---

### 📂 Project Structure

kafka-kanban-board/
├── kanban-kafka-backend/     # FastAPI + Confluent Kafka Python
│   ├── venv/                 # Python Virtual Environment
│   └── main.py               # WebSocket & Kafka Consumer/Producer logic
├── kanban-kafka-frontend/    # Next.js + Tailwind CSS
│   ├── app/
│   │   └── components/
│   │       └── KanbanBoard.js # Core Kanban UI and Logic
│   └── package.json
└── docker-compose.yml        # Kafka KRaft Infrastructure

---

## 🛠️ Getting Started
## 1. Infrastructure (Docker)
First, spin up the Kafka broker. This setup uses KRaft mode, so it only requires a single container.
    1. Navigate to the root folder.

    2. Run: docker-compose up -d

    3. Create the required topic:
        docker exec -it kafka kafka-topics --create --topic ordersmanagement --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1

## 2. Backend Setup (FastAPI)
    1. Navigate to the backend directory:
        cd kanban-kafka-backend
    2. Activate your virtual environment and install dependencies:
        # Windows
        .\venv\Scripts\activate
        # Linux/Mac
        source venv/bin/activate

        pip install fastapi uvicorn confluent-kafka

    3. Start the server:
        uvicorn main:app --reload --port 8000

## 3. Frontend Setup (Next.js)
    1. Open a new terminal and navigate to the frontend directory:
        cd kanban-kafka-frontend
    2. Install dependencies:
        npm install
    3. npm run dev
        Open http://localhost:3000 in your browser.

---

### 📡 How it Works
## User Action: 
A user moves a card or adds an order.

## WebSocket Send: 
The frontend sends a JSON payload to the FastAPI server via a WebSocket.

## Kafka Produce: 
FastAPI produces that message into the ordersmanagement Kafka topic.

## Kafka Consume: 
A background worker in FastAPI consumes the message from Kafka.

## Broadcast: 
The worker broadcasts the message back to all connected WebSocket clients.

## UI Update: 
Every browser window receives the message and updates its local state accordingly.


### Demo Sample Pages:
## Container
![alt text](docker-container.png)

## Webpage:
# Default order shown in two window:
![Default order shown in two window](image.png)

# Create new order in window 1
![Create new order in window 1](image-1.png)

# Burger order placed and shown both window
![Burger order placed and shown both window](image-2.png)

# Mover burger order to analytics column in window 2
![Mover burger order to analytics column in window 2](image-3.png)

# Burger order moved to analytics column in both window
![Burger order moved to analytics column in both window](image-4.png)

# Attempt to delete burger in window 2
![Attempt to delete burger in window 2](image-5.png)

# Burger order deleted in both window
![Burger order deleted in both window](image-6.png)