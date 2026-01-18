"use client";

import { useEffect, useRef, useState } from "react";

const BASE_BLUE = "#0000ff";

type Arrow = {
  angle: number;
};

type FlyingArrow = {
  y: number;
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [level, setLevel] = useState(1);
  const [arrowsLeft, setArrowsLeft] = useState(6);
  const [gameOver, setGameOver] = useState(false);

  const stuckArrows = useRef<Arrow[]>([]);
  const flyingArrow = useRef<FlyingArrow | null>(null);

  const rotation = useRef(0);
  const speed = useRef(0.01);
  const speedTarget = useRef(0.01);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const center = { x: canvas.width / 2, y: canvas.height / 2 - 40 };
    const radius = 90;

    const targetImg = new Image();
    targetImg.src = "/base-logo.png";

    function updateRotation() {
      // Плавное ускорение / замедление
      speed.current += (speedTarget.current - speed.current) * 0.01;
      rotation.current += speed.current;

      // Иногда меняем скорость и направление
      if (Math.random() < 0.005) {
        speedTarget.current =
          (Math.random() * 0.03 + 0.005) * (Math.random() > 0.5 ? 1 : -1);
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
      stuckArrows.current.forEach(a => {
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(a.angle);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(0, -radius - 32);
        ctx.stroke();
        ctx.restore();
      });
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

    function checkCollision(angle: number) {
      return stuckArrows.current.some(
        a => Math.abs(a.angle - angle) < 0.25
      );
    }

    function drawUI() {
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px Arial";
      ctx.fillText(`Level ${level}`, 20, 40);
      ctx.fillText(`Arrows: ${arrowsLeft}`, 20, 70);

      const total = 6 + (level - 1);
      const done = total - arrowsLeft;

      ctx.fillStyle = BASE_BLUE;
      ctx.fillRect(20, 90, (done / total) * 200, 8);
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

        if (flyingArrow.current.y <= center.y - radius) {
          const hitAngle = rotation.current % (Math.PI * 2);

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
      if (flyingArrow.current) return; // нельзя стрелять, пока летит другая

      flyingArrow.current = {
        y: canvas.height - 60,
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
