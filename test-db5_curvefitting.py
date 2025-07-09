from flask import Flask, render_template, request
import mysql.connector
import asyncio
import websockets
import json
import keyboard
import threading
from datetime import datetime

app = Flask(__name__)

def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="water_quality"
    )

@app.route('/')
def display_data():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    start = request.args.get('start')
    end = request.args.get('end')

    query = "SELECT * FROM sensor_data"
    params = []

    if start and end:
        try:
            # Parse to datetime for validation
            start_dt = datetime.strptime(start, "%Y-%m-%dT%H:%M")
            end_dt = datetime.strptime(end, "%Y-%m-%dT%H:%M")
            query += " WHERE timestamp BETWEEN %s AND %s"
            params.extend([start_dt, end_dt])
        except ValueError:
            # Invalid date format fallback
            print("Invalid date format received, ignoring filter.")

    query += " ORDER BY timestamp DESC"

    cursor.execute(query, params)
    data = cursor.fetchall()

    cursor.close()
    conn.close()

    return render_template(
        "index_new_gp_3_curvefitting.html",
        data=data,
        start=start,
        end=end
    )

async def handle_client(websocket, path):
    while True:
        try:
            message = await websocket.recv()
            data = json.loads(message)
            print(f"Received JSON: {data}")

            tds_value = data.get("tdsvalue")
            turbidity_value = data.get("turbidityvalue")
            ph_value = data.get("phvalue")

            conn = get_db_connection()
            cursor = conn.cursor()
            sql = "INSERT INTO sensor_data (tdsvalue, turbidityvalue, phvalue) VALUES (%s, %s, %s)"
            values = (tds_value, turbidity_value, ph_value)
            cursor.execute(sql, values)
            conn.commit()
            cursor.close()
            conn.close()

            response = {"status": "Message Received"}
            await websocket.send(json.dumps(response))

        except websockets.exceptions.ConnectionClosed as e:
            print(f"Connection closed: {e}")
            break
        except json.JSONDecodeError:
            print("Invalid JSON received")
        except Exception as e:
            print(f"Error: {e}")
            break

async def send_led_status(websocket):
    while True:
        try:
            if keyboard.is_pressed('1'):
                led_status = {"led": 1}
                print("Sending: LED ON")
                await websocket.send(json.dumps(led_status))
                await asyncio.sleep(0.2)
            elif keyboard.is_pressed('0'):
                led_status = {"led": 0}
                print("Sending: LED OFF")
                await websocket.send(json.dumps(led_status))
                await asyncio.sleep(0.2)
            await asyncio.sleep(0.1)
        except websockets.exceptions.ConnectionClosed as e:
            print(f"Connection closed during send: {e}")
            break
        except Exception as e:
            print(f"Error in send_led_status: {e}")
            break

async def handle_client_and_send(websocket, path):
    await asyncio.gather(
        handle_client(websocket, path),
        send_led_status(websocket)
    )

def run_flask():
    app.run(debug=True, use_reloader=False)

async def main():
    # Start Flask app in another thread
    threading.Thread(target=run_flask).start()

    # Start the WebSocket server
    async with websockets.serve(handle_client_and_send, "0.0.0.0", 5000):
        print("WebSocket server running on ws://0.0.0.0:5000")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())
