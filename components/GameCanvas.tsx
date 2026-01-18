"use client";

import { useEffect, useRef } from "react";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let width, height;

    const TARGET_RADIUS = 65;
    const ARROW_LENGTH = 100;
    const ARROW_WIDTH = 3;

    const COLOR_PRIMARY = "#0052FF";
    const COLOR_DARK = "#050505";

    let gameState = "playing";
    let level = 1;
    let rotationAngle = 0;

    let currentRotationSpeed = 0.04;
    let targetRotationSpeed = 0.04;
    let rotationChangeTimer = 0;

    let pins: { angle: number }[] = [];
    let activePin: { y: number; isMoving: boolean } | null = null;
    let pinsLeftToShoot = 0;

    function resize() {
      width = canvas.parentElement!.clientWidth;
      height = canvas.parentElement!.clientHeight;
      canvas.width = width;
      canvas.height = height;
    }

    window.addEventListener("resize", resize);
    resize();

    function setupLevel(lvl: number) {
      level = lvl;
      pins = [];
      rotationAngle = 0;

      currentRotationSpeed = 0.03;
      targetRotationSpeed = 0.03;

      let pinsCount = 6 + Math.ceil(level / 2);
      pinsLeftToShoot = pinsCount;

      prepareNextPin();
      gameState = "playing";
    }

    function prepareNextPin() {
      activePin = {
        y: height - 120,
        isMoving: false,
      };
    }

    function updateRotation() {
      rotationChangeTimer--;
      if (rotationChangeTimer <= 0) {
        rotationChangeTimer = 60 + Math.random() * 100;

        const maxSpeed = 0.04 + level * 0.005;
        const direction = Math.random() > 0.5 ? 1 : -1;

        if (Math.random() < 0.15) {
          targetRotationSpeed = 0.01 * direction;
        } else {
          targetRotationSpeed =
            (0.02 + Math.random() * maxSpeed) * direction;
        }
      }

      currentRotationSpeed +=
        (targetRotationSpeed - currentRotationSpeed) * 0.02;

      rotationAngle += currentRotationSpeed;
    }

    function update() {
      if (gameState === "playing") {
        updateRotation();
      }

      if (gameState === "playing" && activePin && activePin.isMoving) {
        const speed = 45;
        activePin.y -= speed;

        if (activePin.y <= height / 2 + TARGET_RADIUS) {
          let hitAngle = Math.PI / 2 - rotationAngle;
          hitAngle = hitAngle % (Math.PI * 2);
          if (hitAngle < 0) hitAngle += Math.PI * 2;

          let collision = false;
          const safeZone = 0.15;

          for (let p of pins) {
            let diff = Math.abs(p.angle - hitAngle);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < safeZone) {
              collision = true;
              break;
            }
          }

          if (collision) {
            gameState = "failed";
          } else {
            pins.push({ angle: hitAngle });
            pinsLeftToShoot--;

            if (pinsLeftToShoot <= 0) {
              setTimeout(() => {
                setupLevel(level + 1);
              }, 500);
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
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationAngle);

      pins.forEach(p => {
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
      ctx.fillText(String(pinsLeftToShoot), 0, 2);

      ctx.restore();

      if (activePin && gameState === "playing") {
        drawArrow(centerX, activePin.y, undefined, COLOR_PRIMARY);
      }
    }

    function loop() {
      update();
      draw();
      requestAnimationFrame(loop);
    }

    function shoot() {
      if (gameState !== "playing") return;
      if (!activePin || activePin.isMoving) return;
      activePin.isMoving = true;
    }

    canvas.addEventListener("mousedown", shoot);
    canvas.addEventListener("touchstart", shoot, { passive: false });

    setupLevel(1);
    loop();

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div style={{ height: "100vh", background: "#000020" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
