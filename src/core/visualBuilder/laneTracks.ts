import type { Lane } from './laneEdits';

// Greedy interval scheduling: a clip goes on the first track whose last clip has ended, so the timeline stays as short as it can.
export function packTracks(lanes: readonly Lane[]): Lane[][] {
  const tracks: Lane[][] = [];
  const ordered = [...lanes].sort((a, b) => a.at - b.at || a.blockIndex - b.blockIndex);
  for (const lane of ordered) {
    const track = tracks.find((candidate) => {
      const last = candidate[candidate.length - 1];
      return last.at + last.duration <= lane.at;
    });
    if (track) track.push(lane);
    else tracks.push([lane]);
  }
  return tracks;
}
