// Schedule on the audio clock so a busy page does not interrupt the rhythm.
export function scheduleTimerSound(context, seconds = 15) {
  const voices = new Set();
  const start = context.currentTime;
  for (let offset = 0; offset < seconds; offset += 2) {
    for (const [delay, frequency] of [
      [0, 880],
      [0.38, 1175],
    ]) {
      const time = start + offset + delay;
      const end = Math.min(time + 0.28, start + seconds);
      if (end - time < 0.04) continue;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.5, time + 0.015);
      gain.gain.setValueAtTime(0.5, end - 0.035);
      gain.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      const voice = { oscillator, gain };
      voices.add(voice);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        voices.delete(voice);
      };
      oscillator.start(time);
      oscillator.stop(end);
    }
  }
  return () => {
    for (const { oscillator, gain } of voices) {
      try {
        oscillator.stop();
      } catch {}
      oscillator.disconnect();
      gain.disconnect();
    }
    voices.clear();
  };
}
