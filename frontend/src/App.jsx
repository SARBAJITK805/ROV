import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

const TDS_THRESHOLD = 700;
const TURBIDITY_THRESHOLD = 1200;
const PH_MIN = 5.80;
const PH_MAX = 5.60;

const markThresholdViolations = (data, threshold, comparator) =>
  data.map(value => (comparator(value, threshold) ? 'red' : 'rgba(0,0,0,0)'));

const createChartData = (label, labels, data, color, highlightFn) => ({
  labels,
  datasets: [
    {
      label,
      data,
      borderColor: color,
      borderWidth: 2,
      fill: false,
      tension: 0.3,
      pointBackgroundColor: highlightFn ? highlightFn(data) : color,
    },
  ],
});

const createChartOptions = (label, data, threshold = null) => {
  const minY = Math.min(...data);
  const maxY = Math.max(...data);
  const margin = (maxY - minY) * 0.3 || 1;

  return {
    plugins: {
      legend: { display: true },
      ...(threshold && {
        annotation: {
          annotations: {
            line1: {
              type: 'line',
              yMin: threshold.value,
              yMax: threshold.value,
              borderColor: threshold.color,
              borderWidth: 1,
              borderDash: [5, 5],
              label: {
                display: true,
                content: `${label} Threshold`,
              },
            },
          },
        },
      }),
    },
    scales: {
      x: { title: { display: true, text: 'Timestamp' } },
      y: { min: minY - margin, max: maxY + margin },
    },
  };
};

const Main = () => {
  const [sensorData, setSensorData] = useState([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (start = '', end = '') => {
    try {
      let url = 'http://localhost:5000/data';
      if (start && end) {
        url += `?start=${start}&end=${end}`;
      }
      const res = await axios.get(url);
      setSensorData(res.data.data.reverse());
    } catch (err) {
      console.error('Error fetching sensor data:', err);
    }
  };

  const handleFilter = (e) => {
    e.preventDefault();
    if (start && end) fetchData(start, end);
  };

  const labels = sensorData.map((item) => new Date(item.timestamp).toLocaleString());
  const tdsValues = sensorData.map((item) => item.tdsvalue);
  const turbidityValues = sensorData.map((item) => item.turbidityvalue);
  const phValues = sensorData.map((item) => item.phvalue);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Sensor Data Graphs</h2>

      <form onSubmit={handleFilter} style={{ marginBottom: '2rem' }}>
        <label>
          Start Time:
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={{ margin: '0 1rem' }}
          />
        </label>
        <label>
          End Time:
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={{ margin: '0 1rem' }}
          />
        </label>
        <button type="submit">Filter</button>
      </form>

      <Line
        data={createChartData('TDS Value', labels, tdsValues, 'blue', (data) =>
          markThresholdViolations(data, TDS_THRESHOLD, (v, t) => v > t)
        )}
        options={createChartOptions('TDS', tdsValues, { value: TDS_THRESHOLD, color: 'red' })}
      />

      <Line
        data={createChartData('Turbidity Value', labels, turbidityValues, 'green', (data) =>
          markThresholdViolations(data, TURBIDITY_THRESHOLD, (v, t) => v > t)
        )}
        options={createChartOptions('Turbidity', turbidityValues, {
          value: TURBIDITY_THRESHOLD,
          color: 'orange',
        })}
      />

      <Line
        data={createChartData('pH Value', labels, phValues, 'yellow', (data) =>
          phValues.map((v) => (v < PH_MIN || v > PH_MAX ? 'red' : 'rgba(0,0,0,0)'))
        )}
        options={createChartOptions('pH', phValues)}
      />
    </div>
  );
};

export default Main;
