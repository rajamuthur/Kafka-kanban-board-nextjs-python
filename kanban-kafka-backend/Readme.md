
python -m venv venv

.\venv\Scripts\activate

pip install fastapi uvicorn confluent_kafka

docker exec -it kafka kafka-topics --create --topic ordersmanagement --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1

uvicorn main:app --reload --port 8000