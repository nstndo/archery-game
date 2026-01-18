"use client";

import { useEffect, useRef, useState } from "react";

const BASE_BLUE = "#0000ff";

type StuckArrow = {
  angle: number; // угол относительно круга
};

type FlyingArrow = {
  y: number;
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [level, setLevel] = useState(1);
  const [arrowsLeft, setArrowsLeft] = useState(6);
  const [gameOver, setGameOver] = useState(false);

  const stuckArrows = useRef<StuckArrow[]>([]);
  const flyingArrow = useRef<FlyingArrow | null>(null);

  const rotation = useRef(0);
  const speed = useRef(0.008);
  const targetSpeed = useRef(0.008);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const center = { x: canvas.width / 2, y: canvas.height / 2 - 40 };
    const radius = 90;

    const targetImg = new Image();
    targetImg.src = "/base-logo.png";

    function updateRotation() {
      // Плавное приближение к целевой скорости
      speed.current += (targetSpeed.current - speed.current) * 0.02;
      rotation.current += speed.current;

      // Редко меняем скорость / направление
      if (Math.random() < 0.002) {
        targetSpeed.current =
          (Math.random() * 0.02 + 0.004) * (Math.random() > 0.5 ? 1 : -1);
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
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(rotation.current);

      stuckArrows.current.forEach(a => {
        ctx.save();
        ctx.rotate(a.angle);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(0, -radius - 32);
        ctx.stroke();
        ctx.restore();
      });

      ctx.restore();
    }

    function drawFlyingArrow() {
      if (!flyingArrow.current) return;

      ctx.save();
      ctx.translate(center.x, flyingArrow.current.y);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -32);
      ctx.stroke();
      ctx.restore();
    }

    function checkCollision(newAngle: number) {
      return stuckArrows.current.some(
        a => Math.abs(a.angle - newAngle) < 0.25
      );
    }

    function drawUI() {
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px Arial";
      ctx.fillText(`Level ${level}`, 20, 40);
      ctx.fillText(`Arrows: ${arrowsLeft}`, 20, 70);
    }

    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      updateRotation();

      drawTarget();
      drawStuckArrows();
      drawFlyingArrow();
      drawUI();

      // Полёт стрелы строго вверх
      if (flyingArrow.current) {
        flyingArrow.current.y -= 14;

        const hitY = center.y - radius;

        if (flyingArrow.current.y <= hitY) {
          const hitAngle = -rotation.current;

          if (checkCollision(hitAngle)) {
            setGameOver(true);
            flyingArrow.current = null;
            return;
          }

          stuckArrows.current.push({ angle: hitAngle });
          flyingArrow.current = null;
        }
      }

      requestAnimationFrame(loop);
    }

    loop();

    canvas.onclick = () => {
      if (gameOver || arrowsLeft <= 0) return;
      if (flyingArrow.current) return;

      flyingArrow.current = {
        y: canvas.height - 60, // ВИДИМО СНИЗУ
      };

      setArrowsLeft(a => a - 1);

      if (arrowsLeft - 1 === 0) {
        setTimeout(() => {
          stuckArrows.current = [];
          setLevel(l => l + 1);
          setArrowsLeft(6 + level);
        }, 900);
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
