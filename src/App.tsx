import { useEffect, useRef, useState } from "react";

type PlaneName = "GILL" | "BAINS" | "GHUMAN";

type Plane = {
  name: PlaneName;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  started: boolean;
  airborne: boolean;
  done: boolean;
  takeoffSoundPlayed: boolean;
};

const planeNames: PlaneName[] = ["GILL", "BAINS", "GHUMAN"];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const planesRef = useRef<Plane[]>([]);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(performance.now());

  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicNodesRef = useRef<{
    gain?: GainNode;
    oscillators?: OscillatorNode[];
    lfo?: OscillatorNode;
  }>({});

  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);

  const [status, setStatus] = useState<Record<PlaneName, string>>({
    GILL: "Ready at runway",
    BAINS: "Ready at runway",
    GHUMAN: "Ready at runway",
  });

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }

    return audioCtxRef.current;
  };

  const playEngineSound = () => {
    if (!soundOn) return;

    const audio = getAudioContext();
    const now = audio.currentTime;

    const master = audio.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.28, now + 0.25);
    master.gain.exponentialRampToValueAtTime(0.10, now + 1.8);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
    master.connect(audio.destination);

    const osc1 = audio.createOscillator();
    const osc2 = audio.createOscillator();
    const filter = audio.createBiquadFilter();

    osc1.type = "sawtooth";
    osc2.type = "triangle";
    osc1.frequency.setValueAtTime(55, now);
    osc1.frequency.exponentialRampToValueAtTime(170, now + 2.2);
    osc2.frequency.setValueAtTime(90, now);
    osc2.frequency.exponentialRampToValueAtTime(310, now + 2.2);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 2.0);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(master);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.5);
    osc2.stop(now + 2.5);
  };

  const playTakeoffSound = () => {
    if (!soundOn) return;

    const audio = getAudioContext();
    const now = audio.currentTime;

    const bufferSize = Math.floor(audio.sampleRate * 3.2);
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const fade = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * fade;
    }

    const noise = audio.createBufferSource();
    noise.buffer = buffer;

    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 1.8);
    filter.Q.value = 0.7;

    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);

    noise.start(now);
    noise.stop(now + 3.2);
  };

  const startMusic = () => {
    const audio = getAudioContext();
    const now = audio.currentTime;

    stopMusic();

    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.8);
    gain.connect(audio.destination);

    const freqs = [130.81, 164.81, 196.0];
    const oscillators = freqs.map((freq, i) => {
      const osc = audio.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;

      const localGain = audio.createGain();
      localGain.gain.value = i === 0 ? 0.5 : 0.22;

      osc.connect(localGain);
      localGain.connect(gain);
      osc.start();
      return osc;
    });

    const lfo = audio.createOscillator();
    const lfoGain = audio.createGain();

    lfo.type = "sine";
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 0.018;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();

    musicNodesRef.current = { gain, oscillators, lfo };
  };

  const stopMusic = () => {
    const nodes = musicNodesRef.current;

    try {
      nodes.oscillators?.forEach((osc) => osc.stop());
      nodes.lfo?.stop();
    } catch {}

    try {
      nodes.gain?.disconnect();
    } catch {}

    musicNodesRef.current = {};
  };

  const toggleMusic = () => {
    const next = !musicOn;
    setMusicOn(next);

    if (next) startMusic();
    else stopMusic();
  };

  const toggleSound = () => {
    setSoundOn((old) => !old);
  };

  const startPlaneAudio = () => {
    playEngineSound();
  };

  const startAll = () => {
    planesRef.current.forEach((plane, index) => {
      setTimeout(() => {
        if (!plane.started || plane.done) {
          plane.started = true;
          plane.done = false;
          plane.airborne = false;
          plane.takeoffSoundPlayed = false;
          plane.vx = 40;
          plane.vy = 0;
          plane.rot = 0;

          startPlaneAudio();

          setStatus((old) => ({
            ...old,
            [plane.name]: "Rolling for takeoff...",
          }));
        }
      }, index * 450);
    });
  };

  const resetAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const runwayY = (i: number) => height * 0.50 + i * height * 0.15;

    planesRef.current = planeNames.map((name, i) => ({
      name,
      x: width * 0.15,
      y: runwayY(i),
      vx: 0,
      vy: 0,
      rot: 0,
      started: false,
      airborne: false,
      done: false,
      takeoffSoundPlayed: false,
    }));

    setStatus({
      GILL: "Ready at runway",
      BAINS: "Ready at runway",
      GHUMAN: "Ready at runway",
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

    const runwayY = (i: number) => height * 0.50 + i * height * 0.15;

    const resetInternal = () => {
      planesRef.current = planeNames.map((name, i) => ({
        name,
        x: width * 0.15,
        y: runwayY(i),
        vx: 0,
        vy: 0,
        rot: 0,
        started: false,
        airborne: false,
        done: false,
        takeoffSoundPlayed: false,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!planesRef.current.length) resetInternal();
      else {
        planesRef.current.forEach((p, i) => {
          if (!p.started) {
            p.x = width * 0.15;
            p.y = runwayY(i);
          }
        });
      }
    };

    const drawSky = () => {
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, "#57afea");
      g.addColorStop(0.42, "#acdff7");
      g.addColorStop(0.43, "#627d8b");
      g.addColorStop(1, "#172329");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#fff2aa";
      ctx.beginPath();
      ctx.arc(width * 0.82, height * 0.12, 34, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#263a46";
      ctx.fillRect(width * 0.04, height * 0.30, width * 0.52, height * 0.12);
      ctx.fillStyle = "#314f60";
      ctx.fillRect(width * 0.07, height * 0.25, width * 0.30, height * 0.05);

      ctx.fillStyle = "#dff5ff";
      ctx.font = `800 ${Math.max(14, width * 0.018)}px system-ui`;
      ctx.textAlign = "left";
      ctx.fillText("KHAAS BANDE", width * 0.085, height * 0.285);

      ctx.font = `600 ${Math.max(9, width * 0.0085)}px system-ui`;
      ctx.fillStyle = "#9bc8df";
      ctx.fillText("INTERNATIONAL AIRPORT", width * 0.085, height * 0.307);
    };

    const drawAirport = () => {
      ctx.fillStyle = "#2f644b";
      ctx.fillRect(0, height * 0.44, width, height * 0.56);

      for (let i = 0; i < 3; i++) {
        const y = runwayY(i);
        const runwayHeight = Math.max(58, height * 0.11);

        ctx.fillStyle = "#30363d";
        ctx.fillRect(0, y - runwayHeight / 2, width, runwayHeight);

        ctx.strokeStyle = "#f5f5f5";
        ctx.lineWidth = 3;
        ctx.setLineDash([26, 24]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(255,255,255,.82)";
        ctx.font = "700 12px system-ui";
        ctx.textAlign = "left";
        ctx.fillText(`RUNWAY ${i + 1}`, 18, y - runwayHeight / 2 + 18);

        for (let x = 28; x < width; x += 55) {
          ctx.fillStyle = "#ffe88f";
          ctx.beginPath();
          ctx.arc(x, y - runwayHeight / 2 + 6, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y + runwayHeight / 2 - 6, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const drawPlane = (p: Plane) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      const scale = Math.max(0.72, Math.min(1.1, width / 1000));
      ctx.scale(scale, scale);

      if (!p.airborne) {
        ctx.globalAlpha = 0.23;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(4, 22, 67, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = "#2268ad";
      ctx.beginPath();
      ctx.moveTo(-42, -8);
      ctx.lineTo(-62, -35);
      ctx.lineTo(-30, -22);
      ctx.lineTo(-18, -5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#c8d4dd";
      ctx.beginPath();
      ctx.moveTo(-5, -3);
      ctx.lineTo(27, -42);
      ctx.lineTo(40, -39);
      ctx.lineTo(21, -2);
      ctx.lineTo(36, 31);
      ctx.lineTo(22, 33);
      ctx.lineTo(-9, 5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#f5f7f9";
      ctx.strokeStyle = "#8396a5";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-60, -10);
      ctx.lineTo(35, -10);
      ctx.quadraticCurveTo(67, -7, 80, 0);
      ctx.quadraticCurveTo(67, 8, 35, 10);
      ctx.lineTo(-60, 10);
      ctx.quadraticCurveTo(-71, 0, -60, -10);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "#2268ad";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-50, 4);
      ctx.lineTo(58, 4);
      ctx.stroke();

      ctx.fillStyle = "#417da4";
      for (let x = -35; x <= 42; x += 11) {
        ctx.beginPath();
        ctx.arc(x, -3, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#14354b";
      ctx.beginPath();
      ctx.moveTo(58, -6);
      ctx.lineTo(69, -3);
      ctx.lineTo(58, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#8799a6";
      ctx.beginPath();
      ctx.ellipse(14, 16, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#0d2537";
      ctx.font = "800 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(p.name, 0, 0);

      ctx.restore();

      ctx.save();
      ctx.fillStyle = "rgba(3,12,22,.82)";
      ctx.beginPath();
      ctx.roundRect(p.x - 40, p.y - 64, 80, 28, 14);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "800 13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(p.name, p.x, p.y - 45);
      ctx.restore();
    };

    const updatePlane = (p: Plane, dt: number) => {
      if (!p.started || p.done) return;

      if (!p.airborne) {
        p.vx += 120 * dt;
        p.x += p.vx * dt;

        if (p.x > width * 0.58) {
          p.airborne = true;
          p.vy = -36;

          if (!p.takeoffSoundPlayed) {
            p.takeoffSoundPlayed = true;
            playTakeoffSound();
          }

          setStatus((old) => ({ ...old, [p.name]: "Airborne ✈" }));
        }
      } else {
        p.vx += 31 * dt;
        p.vy -= 24 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot = Math.max(-0.34, p.rot - 0.17 * dt);

        if (p.x > width + 140 || p.y < -130) {
          p.done = true;
          setStatus((old) => ({ ...old, [p.name]: "Flight departed" }));
        }
      }
    };

    const startPlane = (p: Plane) => {
      if (p.started && !p.done) return;

      if (p.done) {
        const i = planeNames.indexOf(p.name);
        p.x = width * 0.15;
        p.y = runwayY(i);
        p.vx = 0;
        p.vy = 0;
        p.rot = 0;
        p.airborne = false;
        p.done = false;
        p.takeoffSoundPlayed = false;
      }

      p.started = true;
      p.vx = 40;
      playEngineSound();

      setStatus((old) => ({
        ...old,
        [p.name]: "Rolling for takeoff...",
      }));
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (const p of planesRef.current) {
        if (Math.abs(mx - p.x) < 90 && Math.abs(my - p.y) < 55) {
          startPlane(p);
          break;
        }
      }
    };

    const loop = (time: number) => {
      const dt = Math.min(0.032, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;

      drawSky();
      drawAirport();

      planesRef.current.forEach((p) => {
        updatePlane(p, dt);
        drawPlane(p);
      });

      animationRef.current = requestAnimationFrame(loop);
    };

    resize();
    canvas.addEventListener("click", onClick);
    window.addEventListener("resize", resize);
    animationRef.current = requestAnimationFrame(loop);

    return () => {
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      stopMusic();
      audioCtxRef.current?.close();
    };
  }, [soundOn]);

  return (
    <main className="page">
      <div className="shell">
        <section className="hero">
          <div className="eyebrow">KHAAS BANDE INTERNATIONAL AIRPORT</div>
          <h1>Runway Takeoff</h1>
          <p>Click GILL, BAINS, or GHUMAN to launch the plane.</p>

          <div className="buttons">
            <button onClick={startAll}>Take Off All</button>
            <button className="secondary" onClick={resetAll}>Reset</button>
            <button className="secondary" onClick={toggleSound}>
              {soundOn ? "🔊 Plane Sound On" : "🔇 Plane Sound Off"}
            </button>
            <button className="secondary" onClick={toggleMusic}>
              {musicOn ? "🎵 Music On" : "🎵 Music Off"}
            </button>
          </div>
        </section>

        <section className="canvasWrap">
          <div className="hint">✈ Click a plane to take off</div>
          <canvas ref={canvasRef} />
        </section>

        <section className="statusGrid">
          {planeNames.map((name) => (
            <div className="statusCard" key={name}>
              <div className="dot" />
              <div>
                <strong>{name}</strong>
                <span>{status[name]}</span>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
