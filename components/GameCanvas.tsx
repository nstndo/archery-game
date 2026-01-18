"use client";

import { useEffect, useRef, useState } from "react";

const BASE_BLUE = "#0000ff";

type FlyingArrow = {
  angle: number;
  progress: number; // 0 → 1
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [level, setLevel] = useState(1);
  const [arrowsLeft, setArrowsLeft] = useState(5);
  const [gameOver, setGameOver] = useState(false);

  const stuckArrows = useRef<number[]>([]);
  const flyingArrows = useRef<FlyingArrow[]>([]);

  const rotation = useRef(0);
  const speed = useRef(
    (Math.random() * 0.04 + 0.02) * (Math.random() > 0.5 ? 1 : -1)
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const center = { x: canvas.width / 2, y: canvas.height / 2 - 40 };
    const radius = 90;

    const targetImg = new Image();
    targetImg.src = "/base-logo.png";

    let lastDirectionChange = Date.now();

    function maybeChangeDirection() {
      if (Date.now() - lastDirectionChange > 1500) {
        if (Math.random() < 0.4) {
          speed.current *= -1;
        } else {
          speed.current =
            (Math.random() * 0.05 + 0.015) *
            (Math.random() > 0.5 ? 1 : -1);
        }
        lastDirectionChange = Date.now();
      }
    }

    function drawTarget() {
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(rotation.current);
      ctx.drawImage(targetImg, -radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }

    function drawStuckArrows() {
      stuckArrows.current.forEach(angle => {
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(angle);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(0, -radius - 32);
        ctx.stroke();
        ctx.restore();
      });
    }

    function drawFlyingArrows() {
      flyingArrows.current.forEach(a => {
        const dist = a.progress * (radius + 60); // ВАЖНО: старт снизу
        ctx.save();
        ctx.translate(center.x, center.y + 200); // стрелы летят СНИЗУ
        ctx.rotate(a.angle);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -dist);
        ctx.lineTo(0, -dist - 32);
        ctx.stroke();
        ctx.restore();
      });
    }

    function checkCollision(newAngle: number) {
      return stuckArrows.current.some(a => Math.abs(a - newAngle) < 0.25);
    }

    function drawUI() {
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px Arial";
      ctx.fillText(`Level ${level}`, 20, 40);
      ctx.fillText(`Arrows: ${arrowsLeft}`, 20, 70);

      const total = 5 + (level - 1);
      const done = total - arrowsLeft;

      ctx.fillStyle = BASE_BLUE;
      ctx.fillRect(20, 90, (done / total) * 200, 8);
    }

    function drawHitEffect(angle: number) {
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(angle);
      ctx.fillStyle = BASE_BLUE;
      ctx.beginPath();
      ctx.arc(0, -radius, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      maybeChangeDirection();

      drawTarget();
      drawStuckArrows();
      drawFlyingArrows();
      drawUI();

      rotation.current += speed.current;

      // Анимация полёта
      flyingArrows.current.forEach(a => {
        a.progress += 0.08;
      });

      // Когда стрела долетела
      for (let i = flyingArrows.current.length - 1; i >= 0; i--) {
        if (flyingArrows.current[i].progress >= 1) {
          const angle = flyingArrows.current[i].angle;

          if (checkCollision(angle)) {
            setGameOver(true);
            flyingArrows.current = [];
            return;
          }

          stuckArrows.current.push(angle);
          drawHitEffect(angle);
          flyingArrows.current.splice(i, 1);
        }
      }

      requestAnimationFrame(loop);
    }

    loop();

    canvas.onclick = () => {
      if (gameOver || arrowsLeft <= 0) return;

      const angle = rotation.current % (Math.PI * 2);

      flyingArrows.current.push({ angle, progress: 0 });
      setArrowsLeft(a => a - 1);

      if (arrowsLeft - 1 === 0) {
        setTimeout(() => {
          stuckArrows.current = [];
          flyingArrows.current = [];
          setLevel(l => l + 1);
          setArrowsLeft(5 + level);
        }, 800);
      }
    };
  }, [level, arrowsLeft, gameOver]);

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #000020, #0000ff)",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <canvas
        ref={canvasRef}
        width={360}
        height={640}
        style={{
          borderRadius: 16,
          background: "#000010",
        }}
      />

      {gameOver && (
        <div
          style={{
            position: "absolute",
            color: "white",
            fontSize: 32,
            fontWeight: "bold",
          }}
        >
          Game Over
        </div>
      )}
    </div>
  );
}