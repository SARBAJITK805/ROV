import asyncio
import websockets
import json
import keyboard

async def handle_client(websocket, path):
    async for message in websocket:
        try:
            # Parse the JSON message
            data = json.loads(message)
            print(f"Received JSON: {data}")

            # Example response back to the client
            response = {"status": "Message Received"}
            await websocket.send(json.dumps(response))

        except json.JSONDecodeError:
            print("Invalid JSON received")

async def send_led_status(websocket):
    while True:
        if keyboard.is_pressed('1'):
            led_status = {"led": 1}  # LED ON
            print("Sending: LED ON")
            await asyncio.sleep(0.2)  # Prevent spamming
        elif keyboard.is_pressed('0'):
            led_status = {"led": 0}  # LED OFF
            print("Sending: LED OFF")
            await websocket.send(json.dumps(led_status))
            await asyncio.sleep(0.2)  # Prevent spamming
        await asyncio.sleep(0.1)  # Main loop delay to avoid busy-waiting

async def handle_client_and_send(websocket, path):
    await asyncio.gather(
        handle_client(websocket, path),
        send_led_status(websocket)
    )

async def main():
    # Start the WebSocket server on port 5000
    async with websockets.serve(handle_client_and_send, "0.0.0.0", 5000):
        print("WebSocket server running on ws://0.0.0.0:5000")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())