import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from confluent_kafka import Producer, Consumer, KafkaError

app = FastAPI()

# --- Kafka Configuration ---
KAFKA_CONFIG = {'bootstrap.servers': 'localhost:9092'}
TOPIC = 'ordersmanagement'
producer = Producer(KAFKA_CONFIG)

# --- In-Memory State (Persistence) ---
# This survives browser refreshes as long as the Python server stays running.
board_state = {
    "order": [
        {"id": "init-1", "content": "Burger / #ORD-882"},
        {"id": "init-2", "content": "Pizza / #ORD-124"}
    ],
    "invoice": [],
    "analytics": []
}

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        # IMMEDIATELY send current board state to the new user on refresh/join
        await websocket.send_text(json.dumps({"type": "sync_state", "data": board_state}))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                self.active_connections.remove(connection)

manager = ConnectionManager()

def update_internal_state(data):
    """Synchronizes the Python board_state with events coming from Kafka."""
    global board_state
    msg_type = data.get("type")
    
    if msg_type == "new_card":
        board_state["order"].insert(0, {"id": data["card_id"], "content": data["content"]})
    
    elif msg_type == "delete_card":
        for col in board_state:
            board_state[col] = [i for i in board_state[col] if i["id"] != data["card_id"]]
            
    elif "from_col" in data:  # Move event
        card_id = data["card_id"]
        moved_item = None
        # Remove from existing column
        for col in board_state:
            for item in board_state[col]:
                if item["id"] == card_id:
                    moved_item = item
                    board_state[col] = [i for i in board_state[col] if i["id"] != card_id]
                    break
        # Add to new column at the correct index
        if moved_item:
            board_state[data["to_col"]].insert(data["new_index"], moved_item)

async def kafka_consumer_worker():
    consumer_config = {**KAFKA_CONFIG, 'group.id': 'kanban-group', 'auto.offset.reset': 'latest'}
    consumer = Consumer(consumer_config)
    consumer.subscribe([TOPIC])
    try:
        while True:
            msg = consumer.poll(0.1)
            if msg:
                data = json.loads(msg.value().decode('utf-8'))
                # 1. Update the master state in Python
                update_internal_state(data)
                # 2. Broadcast to all connected browsers
                await manager.broadcast(json.dumps(data))
            await asyncio.sleep(0.1)
    finally:
        consumer.close()

async def kafka_health_check():
    while True:
        try:
            producer.list_topics(timeout=1.0)
            status = "healthy"
        except:
            status = "unreachable"
        await manager.broadcast(json.dumps({"type": "health", "status": status}))
        await asyncio.sleep(5)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(kafka_consumer_worker())
    asyncio.create_task(kafka_health_check())

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            producer.produce(TOPIC, value=data.encode('utf-8'))
            producer.flush()
    except WebSocketDisconnect:
        manager.disconnect(websocket)