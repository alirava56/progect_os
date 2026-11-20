export type MachineObservation = {
  resourceId: string;
  checkedAt: string;
  cpuPercent: number;
  usedBytes: number;
  totalBytes: number;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  source: 'machine-agent';
  state: 'observed' | 'stale';
};

export function machineObservationFresh(checkedAt: string, now: number) {
  const age = now - Date.parse(checkedAt);
  return age >= -120_000 && age <= 15 * 60_000;
}
