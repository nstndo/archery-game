"use client";

import { useEffect, useRef, useState } from "react";

const COLOR_PRIMARY = "#0052FF";
const COLOR_DARK = "#050505";

const TARGET_RADIUS = 65;
const ARROW_LENGTH = 100;
const ARROW_WIDTH = 3;

type Pin = {
  angle: number;
};

type ActivePin = {
  y: number;
  isMoving: boolean;
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [level, setLevel] = useState(1);
  const [arrowsLeft, setArrowsLeft] = useState(6);
  const [gameOver, setGameOver] = useState(false);

  const pins = useRef<Pin[]>([]);
  const activePin = useRef<ActivePin | null>(null);

  const rotationAngle = useRef(0);
  const currentRotationSpeed = useRef(0.03);
  const targetRotationSpeed = useRef(0.03);
  const rotationChangeTimer = useRef(100);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    function resize() {
      canvas.width = canvas.parentElement!.clientWidth;
      canvas.height = canvas.parentElement!.clientHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    function setupLevel(lvl: number) {
      setLevel(lvl);
      pins.current = [];
      rotationAngle.current = 0;
      currentRotationSpeed.current = 0.03;
      targetRotationSpeed.current = 0.03;
      rotationChangeTimer.current = 80;

      const pinCount = 6 + Math.ceil(lvl / 2);
      setArrowsLeft(pinCount);

      prepareNextPin();
      setGameOver(false);
    }

    function prepareNextPin() {
      activePin.current = {
        y: canvas.height - 120,
        isMoving: false,
      };
    }

    function updateRotation() {
      rotationChangeTimer.current--;

      if (rotationChangeTimer.current <= 0) {
        rotationChangeTimer.current = 60 + Math.random() * 100;

        const maxSpeed = 0.04 + level * 0.005;
        const direction = Math.random() > 0.5 ? 1 : -1;

        if (Math.random() < 0.15) {
          targetRotationSpeed.current = 0.01 * direction;
        } else {
          targetRotationSpeed.current =
            (0.02 + Math.random() * maxSpeed) * direction;
        }
      }

      currentRotationSpeed.current +=
        (targetRotationSpeed.current - currentRotationSpeed.current) * 0.02;

      rotationAngle.current += currentRotationSpeed.current;
    }

    function checkCollision(hitAngle: number) {
      const safeZone = 0.15;

      return pins.current.some(p => {
        let diff = Math.abs(p.angle - hitAngle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        return diff < safeZone;
      });
    }

    function update() {
      updateRotation();

      if (activePin.current && activePin.current.isMoving) {
        activePin.current.y -= 45;

        const hitY = canvas.height / 2 + TARGET_RADIUS;

        if (activePin.current.y <= hitY) {
          let hitAngle = Math.PI / 2 - rotationAngle.current;
          hitAngle = hitAngle % (Math.PI * 2);
          if (hitAngle < 0) hitAngle += Math.PI * 2;

          if (checkCollision(hitAngle)) {
            setGameOver(true);
          } else {
            pins.current.push({ angle: hitAngle });
            setArrowsLeft(a => a - 1);

            if (arrowsLeft - 1 <= 0) {
              setTimeout(() => setupLevel(level + 1), 500);
            } else {
              prepareNextPin();
            }
          }
        }
      }
    }

    function drawArrow(
      x: number,
      y: number,
      rotation: number | undefined,
      color: string
    ) {
      ctx.save();

      if (rotation !== undefined) {
        ctx.rotate(rotation);
        ctx.translate(TARGET_RADIUS, 0);
      } else {
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 2);
        ctx.translate(TARGET_RADIUS, 0);
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = ARROW_WIDTH;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ARROW_LENGTH, 0);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationAngle.current);

      pins.current.forEach(p => {
        drawArrow(0, 0, p.angle, COLOR_DARK);
      });

      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_DARK;
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.font = "bold 32px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(arrowsLeft), 0, 2);

      ctx.restore();

      if (activePin.current && !gameOver) {
        drawArrow(centerX, activePin.current.y, undefined, COLOR_PRIMARY);
      }
    }

    function loop() {
      update();
      draw();
      requestAnimationFrame(loop);
    }

    function shoot() {
      if (gameOver) return;
      if (!activePin.current || activePin.current.isMoving) return;
      activePin.current.isMoving = true;
    }

    canvas.addEventListener("mousedown", shoot);
    canvas.addEventListener("touchstart", shoot, { passive: false });

    setupLevel(1);
    loop();

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, [level, arrowsLeft, gameOver]);

  return (
    <div style={{ height: "100vh", background: "#000020" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
