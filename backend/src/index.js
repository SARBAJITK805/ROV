import express from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient()

// GET route to fetch sensor data, optionally within a date range
app.get('/data', async (req, res) => {
  const { start, end } = req.query;
  try {
    let data;
    if (start && end) {
      data = await prisma.sensorData.findMany({
        where: {
          timestamp: {
            gte: new Date(start),
            lte: new Date(end),
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });
    } else {
      data = await prisma.sensorData.findMany({
        orderBy: {
          timestamp: 'desc',
        },
      });
    }

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch data: ' + err.message });
  }
});


app.post('/data', async (req, res) => {
  const { tdsvalue, turbidityvalue, phvalue } = req.body;
  if (
    typeof tdsvalue !== 'number' ||
    typeof turbidityvalue !== 'number' ||
    typeof phvalue !== 'number'
  ) {
    return res.status(400).json({ error: 'Invalid or missing sensor data' });
  }

  try {
    const newEntry = await prisma.sensorData.create({
      data: {
        tdsvalue,
        turbidityvalue,
        phvalue,
      },
    });
    res.status(201).json({ message: 'Data inserted successfully', data: newEntry });
  } catch (err) {
    res.status(500).json({ error: 'Failed to insert data: ' + err.message });
  }
});

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
