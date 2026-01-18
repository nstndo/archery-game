"use client";

import { useEffect, useRef, useState } from "react";

const BASE_BLUE = "#0000ff";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [level, setLevel] = useState(1);
  const [arrowsLeft, setArrowsLeft] = useState(5);
  const [gameOver, setGameOver] = useState(false);

  const arrows: number[] = [];

  let rotation = 0;
  let speed = (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const center = { x: canvas.width / 2, y: canvas.height / 2 };
    const radius = 90;

    function drawTarget() {
      const img = new Image();
      img.src = "/base-logo.png"; // добавим ниже
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(rotation);
      ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }

    function drawArrows() {
      arrows.forEach(angle => {
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(angle);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(0, -radius - 30);
        ctx.stroke();
        ctx.restore();
      });
    }

    function checkCollision(newAngle: number) {
      return arrows.some(a => Math.abs(a - newAngle) < 0.25);
    }

    function drawUI() {
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px Arial";
      ctx.fillText(`Level ${level}`, 20, 40);
      ctx.fillText(`Arrows: ${arrowsLeft}`, 20, 70);
    }

    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawTarget();
      drawArrows();
      drawUI();

      rotation += speed;
      requestAnimationFrame(loop);
    }

    loop();

    canvas.onclick = () => {
      if (gameOver || arrowsLeft <= 0) return;

      const angle = rotation % (Math.PI * 2);

      if (checkCollision(angle)) {
        setGameOver(true);
        return;
      }

      arrows.push(angle);
      setArrowsLeft(a => a - 1);

      if (arrowsLeft - 1 === 0) {
        setTimeout(() => {
          arrows.length = 0;
          setLevel(l => l + 1);
          setArrowsLeft(5 + level);
          speed =
            (Math.random() * 0.03 + 0.01) *
            (Math.random() > 0.5 ? 1 : -1);
        }, 600);
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
          borderRadius: 12,
          background: "#000010",
        }}
      />
      {gameOver && (
        <div
          style={{
            position: "absolute",
            color: "white",
            fontSize: 32,
          }}
        >
          Game Over
        </div>
      )}
    </div>
  );
}