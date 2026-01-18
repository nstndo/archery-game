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

  const stuckArrows: number[] = [];
  const flyingArrows: FlyingArrow[] = [];

  let rotation = 0;
  let speed =
    (Math.random() * 0.04 + 0.02) * (Math.random() > 0.5 ? 1 : -1);

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
          speed *= -1;
        } else {
          speed =
            (Math.random() * 0.05 + 0.015) *
            (Math.random() > 0.5 ? 1 : -1);
        }
        lastDirectionChange = Date.now();
      }
    }

    function drawTarget() {
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(rotation);
      ctx.drawImage(targetImg, -radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }

    function drawStuckArrows() {
      stuckArrows.forEach(angle => {
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
      flyingArrows.forEach(a => {
        const dist = a.progress * radius;
        ctx.save();
        ctx.translate(center.x, center.y);
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
      return stuckArrows.some(a => Math.abs(a - newAngle) < 0.25);
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

      rotation += speed;

      // Animate flying arrows
      flyingArrows.forEach(a => {
        a.progress += 0.12;
      });

      // When arrow reaches target
      for (let i = flyingArrows.length - 1; i >= 0; i--) {
        if (flyingArrows[i].progress >= 1) {
          const angle = flyingArrows[i].angle;

          if (checkCollision(angle)) {
            setGameOver(true);
            flyingArrows.splice(i, 1);
            return;
          }

          stuckArrows.push(angle);
          drawHitEffect(angle);
          flyingArrows.splice(i, 1);
        }
      }

      requestAnimationFrame(loop);
    }

    loop();

    canvas.onclick = () => {
      if (gameOver || arrowsLeft <= 0) return;

      const angle = rotation % (Math.PI * 2);

      flyingArrows.push({ angle, progress: 0 });
      setArrowsLeft(a => a - 1);

      if (arrowsLeft - 1 === 0) {
        setTimeout(() => {
          stuckArrows.length = 0;
          flyingArrows.length = 0;
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
