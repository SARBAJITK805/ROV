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
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

type SensorData = {
  id: number;
  tdsvalue: number;
  turbidityvalue: number;
  phvalue: number;
  timestamp: string;
};

const TDS_THRESHOLD = 700;
const TURBIDITY_THRESHOLD = 1200;
const PH_MIN = 5.80;
const PH_MAX = 5.60;

type Comparator = (value: number, threshold: number) => boolean;

const markThresholdViolations = (
  data: number[],
  threshold: number,
  comparator: Comparator
): string[] => data.map(value => (comparator(value, threshold) ? 'red' : 'rgba(0,0,0,0)'));

const createChartData = (
  label: string,
  labels: string[],
  data: number[],
  color: string,
  highlightFn?: (data: number[]) => string[]
) => ({
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

const createChartOptions = (
  label: string,
  data: number[],
  threshold?: { value: number; color: string }
) => {
  const minY = Math.min(...data);
  const maxY = Math.max(...data);
  const margin = (maxY - minY) * 0.3 || 1;

  return {
    plugins: {
      legend: { display: true },
    },
    scales: {
      x: { title: { display: true, text: 'Timestamp' } },
      y: {
        min: minY - margin,
        max: maxY + margin,
      },
    },
  };
};

const Main: React.FC = () => {
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);


  const fetchData = async (start: string = '', end: string = '') => {
    try {
      let url = 'http://localhost:5000/data';
      if (start && end) {
        url += `?start=${start}&end=${end}`;
      }
      const res = await axios.get<{ data: SensorData[] }>(url);
      setSensorData(res.data.data.reverse());
    } catch (err) {
      console.error('Error fetching sensor data:', err);
    }
  };


  const handleFilter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (start && end) fetchData(start, end);
  };

  const labels = sensorData.map((item) => new Date(item.timestamp).toLocaleString());
  const tdsValues = sensorData.map((item) => item.tdsvalue);
  const turbidityValues = sensorData.map((item) => item.turbidityvalue);
  const phValues = sensorData.map((item) => item.phvalue);

  return (
    <main className="p-6 space-y-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center">Sensor Data Dashboard</h1>

      <form onSubmit={handleFilter} className="flex flex-wrap gap-4 justify-center items-end">
        <div className="space-y-1">
          <Label htmlFor="start">Start Time</Label>
          <Input
            id="start"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="end">End Time</Label>
          <Input
            id="end"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <Button type="submit">Filter</Button>
      </form>

      <div className="space-y-6">
        <Card>
          <CardContent className="p-4">
            <Line
              data={createChartData('TDS Value', labels, tdsValues, 'blue', (data) =>
                markThresholdViolations(data, TDS_THRESHOLD, (v, t) => v > t)
              )}
              options={createChartOptions('TDS', tdsValues, {
                value: TDS_THRESHOLD,
                color: 'red',
              })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Line
              data={createChartData('Turbidity Value', labels, turbidityValues, 'green', (data) =>
                markThresholdViolations(data, TURBIDITY_THRESHOLD, (v, t) => v > t)
              )}
              options={createChartOptions('Turbidity', turbidityValues, {
                value: TURBIDITY_THRESHOLD,
                color: 'orange',
              })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Line
              data={createChartData('pH Value', labels, phValues, 'yellow', (data) =>
                phValues.map((v) => (v < PH_MIN || v > PH_MAX ? 'red' : 'rgba(0,0,0,0)'))
              )}
              options={createChartOptions('pH', phValues)}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Main;
