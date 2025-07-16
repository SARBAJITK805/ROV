import { WebSocketServer } from 'ws';
import { prisma } from '../../backend/src/db.js';


const wss = new WebSocketServer({
    host: '0.0.0.0',
    port: 8000
});

const connectedClients = new Set();
const clientTypes = new Map(); // Track client types (rover/app)

wss.on('connection', (ws) => {
    console.log('Client connected');
    connectedClients.add(ws);

    ws.on('message', async (message) => {
        let parsedMsg;

        try {
            // Handle both JSON and binary data
            if (message instanceof Buffer) {
                // Check if it's a binary message (video data)
                const firstByte = message[0];
                if (firstByte === 0xFF && message[1] === 0xD8) { // JPEG header
                    // This is likely image data, broadcast to apps
                    broadcastToClients('app', {
                        type: 'camera_frame',
                        data: message.toString('base64'),
                        timestamp: Date.now()
                    });
                    return;
                }

                // Try to parse as JSON
                parsedMsg = JSON.parse(message.toString());
            } else {
                parsedMsg = JSON.parse(message.toString());
            }
        } catch (err) {
            console.error('Error parsing message:', err.message);
            return ws.send(JSON.stringify({
                status: 'Error',
                message: 'Invalid message format'
            }));
        }

        // Store client type for routing
        if (parsedMsg.client) {
            clientTypes.set(ws, parsedMsg.client);
        }

        // Handle sensor data from rover
        if (parsedMsg.type === 'data' && parsedMsg.client === "rover") {
            try {
                const { tdsvalue, turbidityvalue, phvalue } = parsedMsg;

                if (
                    typeof tdsvalue === 'number' &&
                    typeof turbidityvalue === 'number' &&
                    typeof phvalue === 'number'
                ) {
                    try {
                        const newEntry = await prisma.sensorData.create({
                            data: { tdsvalue, turbidityvalue, phvalue },
                        });

                        ws.send(
                            JSON.stringify({
                                status: 'Success',
                                message: 'Data inserted successfully',
                                data: newEntry,
                            })
                        );

                        // Broadcast sensor data to all app clients
                        broadcastToClients('app', {
                            type: 'sensor_data',
                            data: newEntry
                        });
                    }
                    catch (error) {
                        console.log(error);
                    }
                } else {
                    ws.send(
                        JSON.stringify({
                            status: 'Error',
                            message: 'Invalid data format',
                        })
                    );
                }
            } catch (err) {
                console.error('Error handling sensor data:', err.message);
                ws.send(
                    JSON.stringify({
                        status: 'Error',
                        message: 'Server error: ' + err.message,
                    })
                );
            }
        }

        // Handle movement command from app
        if (parsedMsg.type === 'movement' && parsedMsg.client === "app") {
            const { direction } = parsedMsg;

            const validDir = ["forward", "backward", "right", "left", "up", "down", "clockwise", "anticlockwise"];

            if (!validDir.includes(direction)) {
                return ws.send(
                    JSON.stringify({
                        status: 'Error',
                        message: 'Invalid direction',
                    })
                );
            }

            //<---------------------------------------------------------->
            if (direction == "up") {
                broadcastToAll(JSON.stringify({ "led": 1 }))
                return ws.send(JSON.stringify({ "led": 1 }))
            } else if (direction == "down") {
                broadcastToAll(JSON.stringify({ "led": 0 }))
                return ws.send(JSON.stringify({ "led": 0 }))
            }
            //<---------------------------------------------------------->

            // Send movement command to rovers only
            broadcastToClients('rover', {
                type: 'movement',
                direction,
            });

            ws.send(
                JSON.stringify({
                    status: 'Success',
                    message: `Direction command '${direction}' sent to rovers.`,
                })
            );
        }

        // Handle camera operations
        if (parsedMsg.type === "camera") {
            if (parsedMsg.client === "rover") {
                // Rover is providing camera capabilities or sending frame
                if (parsedMsg.action === "init") {
                    // Rover initializing camera
                    ws.send(JSON.stringify({
                        status: 'Success',
                        message: 'Camera initialized',
                    }));

                    // Notify apps that camera is available
                    broadcastToClients('app', {
                        type: 'camera_status',
                        status: 'available'
                    });
                } else if (parsedMsg.action === "frame") {
                    // Rover sending a frame (base64 encoded)
                    broadcastToClients('app', {
                        type: 'camera_frame',
                        data: parsedMsg.data,
                        timestamp: parsedMsg.timestamp || Date.now()
                    });
                } else if (parsedMsg.action === "error") {
                    // Camera error from rover
                    broadcastToClients('app', {
                        type: 'camera_error',
                        message: parsedMsg.message || 'Camera error'
                    });
                }
            }

            if (parsedMsg.client === "app") {
                // App requesting camera operations
                if (parsedMsg.action === "start") {
                    // App wants to start camera stream
                    broadcastToClients('rover', {
                        type: 'camera_command',
                        action: 'start',
                        quality: parsedMsg.quality || 'medium',
                        fps: parsedMsg.fps || 10
                    });

                    ws.send(JSON.stringify({
                        status: 'Success',
                        message: 'Camera start command sent to rover',
                    }));
                } else if (parsedMsg.action === "stop") {
                    // App wants to stop camera stream
                    broadcastToClients('rover', {
                        type: 'camera_command',
                        action: 'stop'
                    });

                    ws.send(JSON.stringify({
                        status: 'Success',
                        message: 'Camera stop command sent to rover',
                    }));
                } else if (parsedMsg.action === "capture") {
                    // App wants to capture a single frame
                    broadcastToClients('rover', {
                        type: 'camera_command',
                        action: 'capture',
                        requestId: parsedMsg.requestId || Date.now()
                    });

                    ws.send(JSON.stringify({
                        status: 'Success',
                        message: 'Capture command sent to rover',
                    }));
                }
            }
        }

        // Handle client registration
        if (parsedMsg.type === 'register') {
            clientTypes.set(ws, parsedMsg.client);
            ws.send(JSON.stringify({
                status: 'Success',
                message: `Registered as ${parsedMsg.client}`,
            }));

            console.log(`Client registered as: ${parsedMsg.client}`);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        connectedClients.delete(ws);
        clientTypes.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        connectedClients.delete(ws);
        clientTypes.delete(ws);
    });
});

// Helper function to broadcast messages to specific client types
function broadcastToClients(clientType, message) {
    const messageStr = JSON.stringify(message);
    console.log(messageStr);

    connectedClients.forEach((client) => {
        if (client.readyState === client.OPEN && clientTypes.get(client) === clientType) {
            //console.log(messageStr);
            client.send(messageStr);
        }
    });
}

// Helper function to broadcast messages to all client types
function broadcastToAll(message) {
    const messageStr = message;
    connectedClients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(messageStr);
        }
    });
}


// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');

    // Close all WebSocket connections
    connectedClients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.close();
        }
    });

    // Close Prisma connection
    await prisma.$disconnect();
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down...');

    // Close all WebSocket connections
    connectedClients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.close();
        }
    });

    // Close Prisma connection
    await prisma.$disconnect();
});